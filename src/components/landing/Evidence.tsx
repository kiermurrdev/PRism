"use client";

import SectionHead from "./SectionHead";
import { useReveal } from "@/hooks/useLanding";

const TIERS = [
  {
    impact: "changed",
    name: "Modified",
    basis: "from the diff",
    verified: true,
    body: "The pull request edits these files. Read straight out of the diff, so there's nothing to doubt.",
  },
  {
    impact: "direct",
    name: "Directly affected",
    basis: "repository search",
    verified: true,
    body: "Not modified, but they name something the pull request changed. The reference count is a real count of real lines.",
  },
  {
    impact: "possible",
    name: "Possibly affected",
    basis: "model inference",
    verified: false,
    body: "A step further out. No direct reference was found, so treat this as a lead worth checking rather than a result.",
  },
  {
    impact: "unchanged",
    name: "Context",
    basis: "model inference",
    verified: false,
    body: "Drawn so the map reads as a system rather than a fragment. Believed unaffected.",
  },
];

export default function Evidence() {
  const { ref: panelRef, inView: panelInView } = useReveal<HTMLDivElement>();
  const { ref: rowsRef, inView: rowsInView } = useReveal<HTMLUListElement>();

  return (
    <section className="wrap section" id="evidence">
      <SectionHead
        title="Every finding tells you why it's here"
        note="Two tiers come from searching the repository. Two come from the model reading the result."
      />

      <div
        className={`ev panel rv${panelInView ? " is-in" : ""}`}
        ref={panelRef}
      >
        <div className="ev-fig ev-verified">
          <b>14</b>
          <span>verified references</span>
        </div>
        <div className="ev-fig ev-inferred">
          <b>3</b>
          <span>model-inferred relationships</span>
        </div>
        <p className="ev-note">
          <b>PRism doesn&apos;t blur those together.</b> A language model will
          describe a ripple effect convincingly whether or not one exists. Where
          the evidence is a count of references, you get the count.
        </p>
      </div>

      <ul className={`trows rv${rowsInView ? " is-in" : ""}`} ref={rowsRef}>
        {TIERS.map((t) => (
          <li className="trow" key={t.impact}>
            <span className="trow-name">
              <span
                className="dot"
                style={{ background: `var(--status-${t.impact})` }}
              />
              {t.name}
            </span>
            <span className={`trow-basis${t.verified ? " verified" : ""}`}>
              {t.basis}
            </span>
            <p className="trow-b">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
