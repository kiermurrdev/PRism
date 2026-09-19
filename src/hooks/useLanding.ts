"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** True when the user has asked for reduced motion. */
export function useReducedMotion(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  }, []);
  const getSnapshot = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Adds `is-in` once the element scrolls into view, then stops observing.
 * `onEnter` fires at the same moment — used to start the ticker only when
 * it is actually on screen.
 */
export function useReveal<T extends HTMLElement>(onEnter?: () => void) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  // keep the callback out of the effect's deps so the observer isn't rebuilt
  const cb = useRef(onEnter);
  useEffect(() => {
    cb.current = onEnter;
  }, [onEnter]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      const fallback = window.setTimeout(() => {
        setInView(true);
        cb.current?.();
      }, 0);
      return () => window.clearTimeout(fallback);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          setInView(true);
          cb.current?.();
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
}

/** Scrolls to the top and focuses the PR input. Used by both Analyze buttons. */
export function useFocusPrInput() {
  const reduced = useReducedMotion();
  return useCallback(() => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    window.setTimeout(
      () => document.getElementById("pr")?.focus(),
      reduced ? 0 : 420
    );
  }, [reduced]);
}

/** True on macOS, so the shortcut chip can show the right modifier. */
export function useIsMac(): boolean {
  const [mac] = useState(() =>
    typeof navigator !== "undefined" &&
    /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)
  );
  return mac;
}
