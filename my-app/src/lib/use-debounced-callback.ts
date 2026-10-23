import * as React from "react";

/**
 * Returns a stable debounced version of `fn` plus helpers to flush or cancel a
 * pending call. The latest `fn` is always used (no stale closures), so callers
 * don't need to memoize it.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
) {
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  });

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgs = React.useRef<Args | null>(null);

  const cancel = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    lastArgs.current = null;
  }, []);

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (lastArgs.current) {
      const args = lastArgs.current;
      lastArgs.current = null;
      fnRef.current(...args);
    }
  }, []);

  const debounced = React.useCallback(
    (...args: Args) => {
      lastArgs.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        lastArgs.current = null;
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );

  // Flush any pending call on unmount so edits are never lost.
  React.useEffect(() => flush, [flush]);

  return { debounced, flush, cancel };
}
