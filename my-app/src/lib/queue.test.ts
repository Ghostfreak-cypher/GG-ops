import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPayloads } from "@/lib/jobs/handlers";
type QueueJob = {
  _id: string;
  name: string;
  payload: Partial<JobPayloads[keyof JobPayloads]>;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  attempts: number;
  runAfter: Date;
  lockedAt: Date | null;
  completedAt?: Date | null;
  lastError?: string | null;
  save: ReturnType<typeof vi.fn>;
};

type NewQueueJob = Omit<QueueJob, "_id" | "save">;

type JobFindQuery = {
  status: QueueJob["status"];
  runAfter?: { $lte: Date };
  attempts?: { $lt: number };
};

const state = {
  connectDB: vi.fn(async () => undefined),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  dispatchError: null as Error | null,
  createdJobs: [] as QueueJob[],
  findJobs: [] as QueueJob[],
};

vi.mock("@/lib/db", () => ({
  connectDB: state.connectDB,
}));

vi.mock("@/lib/logger", () => ({
  logger: state.logger,
}));

vi.mock("@/lib/jobs/handlers", () => ({
  jobHandlers: new Proxy({}, {
    get: () => async () => {
      if (state.dispatchError) throw state.dispatchError;
    },
  }),
}));

vi.mock("@/models/Job", () => ({
  Job: {
    create: vi.fn(async (data: NewQueueJob) => {
      const job = {
        _id: `job-${state.createdJobs.length + 1}`,
        ...data,
        save: vi.fn(async function save(this: QueueJob) {
          return this;
        }),
      };
      state.createdJobs.push(job);
      return job;
    }),
    find: vi.fn((query: JobFindQuery) => {
      const jobs = state.findJobs.filter((job) => {
        const runAfterOk = !query.runAfter?.$lte || job.runAfter <= query.runAfter.$lte;
        const attemptsOk = query.attempts?.$lt === undefined || (job.attempts ?? 0) < query.attempts.$lt;
        return job.status === query.status && runAfterOk && attemptsOk;
      });
      return {
        sort: () => ({
          limit: (limit: number) => jobs.slice(0, limit),
        }),
      };
    }),
  },
}));

beforeEach(() => {
  state.connectDB.mockClear();
  state.logger.info.mockClear();
  state.logger.warn.mockClear();
  state.logger.error.mockClear();
  state.dispatchError = null;
  state.createdJobs = [];
  state.findJobs = [];
});

describe("enqueueAndDispatch", () => {
  it("marks immediate successes as DONE", async () => {
    const { enqueueAndDispatch } = await import("@/lib/queue");

    const result = await enqueueAndDispatch("invite-email" as keyof JobPayloads, {
      email: "a@example.com",
      inviterName: "Alex",
      workspaceName: "Acme",
      inviteUrl: "https://app/invite/tok",
    });

    expect(result).toEqual({ delivered: true, persisted: true, jobId: "job-1" });
    expect(state.createdJobs[0].status).toBe("DONE");
    expect(state.createdJobs[0].attempts).toBe(1);
    expect(state.createdJobs[0].completedAt).toBeInstanceOf(Date);
  });

  it("keeps immediate failures retryable", async () => {
    const { enqueueAndDispatch } = await import("@/lib/queue");
    state.dispatchError = new Error("smtp rejected");

    const result = await enqueueAndDispatch("invite-email" as keyof JobPayloads, {
      email: "a@example.com",
      inviterName: "Alex",
      workspaceName: "Acme",
      inviteUrl: "https://app/invite/tok",
    });

    expect(result).toMatchObject({
      delivered: false,
      persisted: true,
      retriable: true,
      error: "smtp rejected",
      jobId: "job-1",
    });
    expect(state.createdJobs[0].status).toBe("PENDING");
    expect(state.createdJobs[0].lastError).toBe("smtp rejected");
    expect(state.createdJobs[0].runAfter).toBeInstanceOf(Date);
  });
});

describe("drainJobs", () => {
  it("processes only pending jobs and marks success as DONE", async () => {
    const { drainJobs } = await import("@/lib/queue");
    state.findJobs = [
      {
        _id: "pending-1",
        name: "invite-email",
        payload: {
          email: "a@example.com",
          inviterName: "Alex",
          workspaceName: "Acme",
          inviteUrl: "https://app/invite/tok",
        },
        status: "PENDING",
        attempts: 0,
        runAfter: new Date(Date.now() - 1000),
        lockedAt: null,
        completedAt: null,
        lastError: null,
        save: vi.fn(async function save(this: QueueJob) {
          return this;
        }),
      },
      {
        _id: "done-1",
        name: "invite-email",
        payload: {},
        status: "DONE",
        attempts: 1,
        runAfter: new Date(Date.now() - 1000),
        lockedAt: null,
        completedAt: new Date(),
        lastError: null,
        save: vi.fn(async function save(this: QueueJob) {
          return this;
        }),
      },
    ];

    const result = await drainJobs();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(state.findJobs[0].status).toBe("DONE");
    expect(state.findJobs[0].attempts).toBe(1);
    expect(state.findJobs[0].completedAt).toBeInstanceOf(Date);
    expect(state.findJobs[0].save).toHaveBeenCalledTimes(2);
  });
});
