"use client";

import { useEffect, useState } from "react";
import "./landing.css";

import ReferenceField from "@/components/landing/ReferenceField";
import SiteNav from "@/components/landing/SiteNav";
import PRInputForm from "@/components/landing/PRInputForm";
import ImpactMap from "@/components/landing/ImpactMap";
import DiffTicker from "@/components/landing/DiffTicker";
import FileStack from "@/components/landing/FileStack";
import SectionHead from "@/components/landing/SectionHead";
import Evidence from "@/components/landing/Evidence";
import HowItWorks from "@/components/landing/HowItWorks";
import SiteFooter from "@/components/landing/SiteFooter";

export default function Home() {
  /* `is-live` drives the staged hero entrance. Two frames so the
     initial (hidden) styles are committed before the transition runs. */
  const [live, setLive] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setLive(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <div className={`lp${live ? " is-live" : ""}`}>
      <ReferenceField />

      <div id="page">
        <SiteNav />

        <main id="top">
          <div className="wrap hero">
            <h1 className="hero-h1 rise" data-r="1">
              <span className="l">Stop reading diffs.</span>
              <span className="l">Start reading impact.</span>
            </h1>

            <p className="hero-sub rise" data-r="2">
              Paste a public GitHub pull request. PRism draws the components it
              touches, how they connect, and what sits downstream of the change.
            </p>

            <PRInputForm />
          </div>

          <div className="wrap maprow">
            <ImpactMap />
          </div>

          <section className="wrap section" id="beyond">
            <SectionHead
              title="Here's what the diff missed"
              note="GitHub shows you what changed. It doesn't show you what referenced the change and stayed as it was."
            />
            <DiffTicker />
            <FileStack />
          </section>

          <Evidence />
          <HowItWorks />
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
