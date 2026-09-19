"use client";

import SectionHead from "./SectionHead";
import { useReveal } from "@/hooks/useLanding";

const STEPS = [
  {
    n: "01",
    title: "Paste a pull request",
    body: "PRism reads the diff and makes a shallow clone of the repository.",
  },
  {
    n: "02",
    title: "PRism traces the callers",
    body: "It pulls the changed function, class and export names out of the diff, searches the working copy for each one, and subtracts the files the pull request already touches. What's left references your change and wasn't updated alongside it.",
  },
  {
    n: "03",
    title: "Turn impact into a merge checklist",
    body: "The map comes with a plain-English account of the change and a manual QA checklist to work through before you merge.",
  },
];

export default function HowItWorks() {
  const { ref, inView } = useReveal<HTMLOListElement>();

  return (
    <section className="wrap section" id="how">
      <SectionHead
        title="Three steps, about a minute"
        note="Nothing is installed and nothing is written back to your repository."
      />
      <ol className={`steps rv${inView ? " is-in" : ""}`} ref={ref}>
        {STEPS.map((s) => (
          <li className="step" key={s.n}>
            <span className="step-n">{s.n}</span>
            <h3 className="step-t">{s.title}</h3>
            <p className="step-b">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
