"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFocusPrInput } from "@/hooks/useLanding";

const SECTIONS = [
  { id: "evidence", label: "Evidence" },
  { id: "how", label: "How it works" },
];

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const progRef = useRef<HTMLSpanElement | null>(null);
  const focusInput = useFocusPrInput();

  /* Separate on/off thresholds. A single threshold lets any scroll
     correction near the boundary toggle the bar back and forth.
     The bar is fixed with a constant-height spacer, so condensing it
     cannot change document height. */
  useEffect(() => {
    let condensed = false;
    const onScroll = () => {
      const y = window.scrollY;
      if (!condensed && y > 30) condensed = true;
      else if (condensed && y < 10) condensed = false;
      setScrolled(condensed);

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progRef.current) {
        progRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else if (active === e.target.id) setActive(null);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="wrap nav-in">
          <a className="logo" href="#top" aria-label="PRism home">
            <Image
              className="logo-mark"
              src="/prism-logo.png"
              alt=""
              width={141}
              height={168}
              priority
            />
            <span className="logo-word">PRism</span>
          </a>

          <div className="nav-right">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                className={`nav-link${active === s.id ? " is-active" : ""}`}
                href={`#${s.id}`}
              >
                {s.label}
              </a>
            ))}
            <a className="nav-link" href="https://github.com/kiermurrdev/PRism">
              GitHub
            </a>
            <button className="nav-primary" type="button" onClick={focusInput}>
              Analyze a PR
            </button>
          </div>
        </div>
        <span className="prog" ref={progRef} aria-hidden="true" />
      </header>
      <div className="nav-spacer" aria-hidden="true" />
    </>
  );
}
