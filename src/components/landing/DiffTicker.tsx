"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TICKER_WORDS } from "@/lib/landing-data";
import { useReducedMotion, useReveal } from "@/hooks/useLanding";

/**
 * Types and deletes through TICKER_WORDS. Starts only once it has
 * scrolled into view — typing into an off-screen viewport wastes it.
 * The stable sentence is exposed to screen readers; the animation is
 * aria-hidden. Under reduced motion it prints one phrase and stops.
 */
export default function DiffTicker() {
  const reduced = useReducedMotion();
  const [word, setWord] = useState("");
  const [idle, setIdle] = useState(false);
  const started = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;

    let wi = 0;
    let ci = 0;
    let erasing = false;

    const tick = () => {
      const w = TICKER_WORDS[wi];
      if (!erasing) {
        ci++;
        setWord(w.slice(0, ci));
        if (ci < w.length) {
          timer.current = window.setTimeout(tick, 52);
          return;
        }
        setIdle(true);
        timer.current = window.setTimeout(() => {
          setIdle(false);
          erasing = true;
          tick();
        }, 1750);
        return;
      }
      ci--;
      setWord(w.slice(0, ci));
      if (ci > 0) {
        timer.current = window.setTimeout(tick, 26);
        return;
      }
      erasing = false;
      wi = (wi + 1) % TICKER_WORDS.length;
      timer.current = window.setTimeout(tick, 300);
    };

    timer.current = window.setTimeout(tick, 420);
  }, []);

  const { ref } = useReveal<HTMLParagraphElement>(reduced ? undefined : start);
  const displayedWord = reduced ? TICKER_WORDS[0] : word;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <p className="ticker rv" ref={ref}>
      <span className="sr-only">
        Your diff didn&apos;t mention the mailer, the auth tests, the invite
        flow, or eleven other files.
      </span>
      <span aria-hidden="true">
        Your diff didn&apos;t mention{" "}
        <span className="ticker-slot">
          <span>{displayedWord}</span>
          <span className={`ticker-caret${idle ? " is-idle" : ""}`} />
        </span>
      </span>
    </p>
  );
}
