import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Job, type JobDoc } from "@/models/Job";
import { jobHandlers, type JobPayloads } from "@/lib/jobs/handlers";

const MAX_ATTEMPTS = 5;

export async function dispatchQueuedJob<K extends keyof JobPayloads>(
  name: K,
  payload: JobPayloads[K],
): Promise<void> {
  await jobHandlers[name](payload);
}

export type ImmediateDispatchResult =
  | { delivered: true; persisted: boolean; jobId?: string }
  | { delivered: false; persisted: boolean; retriable: boolean; error: string; jobId?: string };

export function enqueue<K extends keyof JobPayloads>(name: K, payload: JobPayloads[K]): void {
  void enqueueAndDispatch(name, payload);
}

export async function enqueueAndDispatch<K extends keyof JobPayloads>(
  name: K,
  payload: JobPayloads[K],
): Promise<ImmediateDispatchResult> {
  const persisted = await persistJobForImmediateDispatch(name, payload);

  try {
    await dispatchQueuedJob(name, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (persisted) {
      const attempts = persisted.attempts ?? 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      persisted.status = exhausted ? "FAILED" : "PENDING";
      persisted.lastError = message;
      persisted.runAfter = new Date(Date.now() + Math.min(60, attempts * attempts * 5) * 1000);
      persisted.lockedAt = null;

      try {
        await persisted.save();
      } catch (saveError) {
        logger.warn("job.persist_failed", {
          name,
          jobId: String(persisted._id),
          error: saveError instanceof Error ? saveError.message : String(saveError),
          immediate: true,
          stage: "schedule-retry",
        });

        return {
          delivered: false,
          persisted: false,
          retriable: false,
          error: message,
          jobId: String(persisted._id),
        };
      }

      logger.error("job.failed", {
        name,
        jobId: String(persisted._id),
        error: message,
        retriable: !exhausted,
      });

      return {
        delivered: false,
        persisted: true,
        retriable: !exhausted,
        error: message,
        jobId: String(persisted._id),
      };
    }

    logger.error("job.failed", {
      name,
      error: message,
      retriable: false,
      persisted: false,
    });

    return {
      delivered: false,
      persisted: false,
      retriable: false,
      error: message,
    };
  }

  if (persisted) {
    persisted.status = "DONE";
    persisted.completedAt = new Date();
    persisted.lastError = null;
    persisted.lockedAt = null;

    try {
      await persisted.save();
      logger.info("job.sent", { name, jobId: String(persisted._id) });
      return { delivered: true, persisted: true, jobId: String(persisted._id) };
    } catch (error) {
      logger.warn("job.persist_failed", {
        name,
        jobId: String(persisted._id),
        error: error instanceof Error ? error.message : String(error),
        immediate: true,
        stage: "complete",
      });
    }
  }

  logger.info("job.sent", { name, persisted: false });
  return { delivered: true, persisted: false, ...(persisted ? { jobId: String(persisted._id) } : {}) };
}

async function persistJobForImmediateDispatch<K extends keyof JobPayloads>(
  name: K,
  payload: JobPayloads[K],
): Promise<JobDoc | null> {
  try {
    await connectDB();
    const job = await Job.create({
      name,
      payload,
      status: "RUNNING",
      attempts: 1,
      lockedAt: new Date(),
    });
    logger.info("job.queued", { name, jobId: String(job._id), immediate: true });
    return job;
  } catch (error) {
    logger.warn("job.persist_failed", {
      name,
      error: error instanceof Error ? error.message : String(error),
      immediate: true,
    });
    return null;
  }
}

export async function drainJobs(limit = 25): Promise<{ processed: number; failed: number }> {
  await connectDB();
  const now = new Date();
  const jobs = await Job.find({
    status: "PENDING",
    runAfter: { $lte: now },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    job.status = "RUNNING";
    job.lockedAt = new Date();
    job.attempts = (job.attempts ?? 0) + 1;
    await job.save();

    try {
      await dispatchQueuedJob(
        job.name as keyof JobPayloads,
        job.payload as JobPayloads[keyof JobPayloads],
      );
      job.status = "DONE";
      job.completedAt = new Date();
      job.lastError = null;
      job.lockedAt = null;
      processed += 1;
    } catch (error) {
      const attempts = job.attempts ?? 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      job.status = exhausted ? "FAILED" : "PENDING";
      job.lastError = error instanceof Error ? error.message : String(error);
      job.runAfter = new Date(Date.now() + Math.min(60, attempts * attempts * 5) * 1000);
      job.lockedAt = null;
      failed += 1;
      logger.error("job drain failed", { name: job.name, attempts, error: job.lastError });
    }

    await job.save();
  }

  return { processed, failed };
}
