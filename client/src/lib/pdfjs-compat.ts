type AbortSignalWithAny = typeof AbortSignal & {
  any?: (signals: readonly AbortSignal[]) => AbortSignal;
};

const AbortSignalConstructor = globalThis.AbortSignal as AbortSignalWithAny;

if (
  typeof AbortSignalConstructor !== "undefined" &&
  typeof AbortSignalConstructor.any !== "function"
) {
  Object.defineProperty(AbortSignalConstructor, "any", {
    configurable: true,
    writable: true,
    value(signals: readonly AbortSignal[]) {
      const controller = new AbortController();
      const listeners: Array<{
        signal: AbortSignal;
        listener: () => void;
      }> = [];

      const cleanup = () => {
        for (const { signal, listener } of listeners) {
          signal.removeEventListener("abort", listener);
        }
        listeners.length = 0;
      };

      const abortFrom = (signal: AbortSignal) => {
        if (controller.signal.aborted) return;
        cleanup();
        controller.abort("reason" in signal ? signal.reason : undefined);
      };

      for (const signal of signals) {
        if (signal.aborted) {
          abortFrom(signal);
          break;
        }

        const listener = () => abortFrom(signal);
        listeners.push({ signal, listener });
        signal.addEventListener("abort", listener, { once: true });
      }

      return controller.signal;
    },
  });
}
