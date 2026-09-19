"use client";

import { useFocusPrInput } from "@/hooks/useLanding";

export default function SiteFooter() {
  const focusInput = useFocusPrInput();
  return (
    <footer className="wrap foot">
      <p className="foot-mark">PRism</p>
      <p className="foot-tag">See beyond the diff.</p>
      <button className="foot-cta" type="button" onClick={focusInput}>
        Analyze a pull request
      </button>
      <div className="foot-meta">
        <a href="https://github.com/kiermurrdev/PRism">GitHub repository</a>
        <span>Prototype &middot; public repositories only</span>
      </div>
    </footer>
  );
}
