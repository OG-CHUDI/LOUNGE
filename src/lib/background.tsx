import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets deep screens (e.g. a live match round) switch the global animated
 * background off without knowing where it's rendered. Reference-counted so
 * several suppressors can overlap safely.
 */
interface BackgroundCtx {
  suppressed: boolean;
  acquire: () => () => void;
}

const Ctx = createContext<BackgroundCtx | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const acquire = useCallback(() => {
    setCount((c) => c + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setCount((c) => Math.max(0, c - 1));
    };
  }, []);

  return (
    <Ctx.Provider value={{ suppressed: count > 0, acquire }}>
      {children}
    </Ctx.Provider>
  );
}

/** Read whether the background is currently suppressed. */
export function useBackgroundSuppressed(): boolean {
  return useContext(Ctx)?.suppressed ?? false;
}

/** While `active` is true, suppress the global animated background. */
export function useSuppressBackground(active: boolean): void {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (!active || !ctx) return;
    return ctx.acquire();
  }, [active, ctx]);
}
