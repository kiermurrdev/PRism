"use client";

import { useReveal } from "@/hooks/useLanding";

export default function SectionHead({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <div className={`s-head${inView ? " is-in" : ""}`} ref={ref}>
      <h2 className="s-title">{title}</h2>
      <p className="s-note">{note}</p>
    </div>
  );
}
