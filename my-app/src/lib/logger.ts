type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

function emit(level: Level, message: string, context?: Context) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Minimal structured logger. Swap the `emit` sink for pino/Sentry later. */
export const logger = {
  info: (message: string, context?: Context) => emit("info", message, context),
  warn: (message: string, context?: Context) => emit("warn", message, context),
  error: (message: string, context?: Context) => emit("error", message, context),
  /**
   * Log a latency measurement. Emits `info` with `{action, latencyMs, ...context}`.
   * Log at `warn` level when latencyMs exceeds the threshold.
   */
  perf: (
    action: string,
    latencyMs: number,
    context?: Context,
    warnThresholdMs = 500,
  ) => {
    const level: Level = latencyMs >= warnThresholdMs ? "warn" : "info";
    emit(level, "perf", { action, latencyMs: Math.round(latencyMs), ...context });
  },
};
