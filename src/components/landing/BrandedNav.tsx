"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * BrandedNav — navigation for non-landing pages (/credentials, /auth/signin, etc).
 *
 * Uses the same visual tokens as SiteNav but:
 * - Links to landing-page anchors via /#section instead of bare #section
 * - "Analyze a PR" navigates home instead of focusing a non-existent input
 * - No scroll progress bar or section IntersectionObserver (those sections don't exist here)
 */
export default function BrandedNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const progRef = useRef<HTMLSpanElement | null>(null);

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

  const isCredentials = pathname === "/credentials";

  return (
    <>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="wrap nav-in">
          <Link className="logo" href="/" aria-label="PRism home">
            <Image
              className="logo-mark"
              src="/prism-logo.png"
              alt=""
              width={141}
              height={168}
              priority
            />
            <span className="logo-word">PRism</span>
          </Link>

          <div className="nav-right">
            <Link
              className="nav-link"
              href="/#evidence"
            >
              Evidence
            </Link>
            <Link
              className="nav-link"
              href="/#how"
            >
              How it works
            </Link>
            <a
              className="nav-link"
              href="https://github.com/kiermurrdev/PRism"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {!isCredentials && (
              <Link className="nav-link" href="/credentials">
                Connections
              </Link>
            )}
            <Link className="nav-primary" href="/">
              Analyze a PR
            </Link>
          </div>
        </div>
        <span className="prog" ref={progRef} aria-hidden="true" />
      </header>
      <div className="nav-spacer" aria-hidden="true" />
    </>
  );
}
