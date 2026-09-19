"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useLanding";

interface FieldNode {
  ox: number; oy: number; x: number; y: number;
  r: number; ph: number; am: number; sp: number; e: number;
}
type FieldEdge = [number, number, number];
interface Wave { x: number; y: number; age: number; str: number }

const C_CTX: [number, number, number] = [100, 116, 139];
const C_DIR: [number, number, number] = [249, 115, 22];
const C_CHG: [number, number, number] = [234, 179, 8];

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    (a[0] + (b[0] - a[0]) * t) | 0,
    (a[1] + (b[1] - a[1]) * t) | 0,
    (a[2] + (b[2] - a[2]) * t) | 0,
  ] as [number, number, number];
}

function heat(e: number) {
  const c = e < 0.5 ? mix(C_CTX, C_DIR, e / 0.5) : mix(C_DIR, C_CHG, (e - 0.5) / 0.5);
  return `${c[0]},${c[1]},${c[2]}`;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Background: a sparse node graph. The pointer acts as a change origin —
 * nearby nodes warm from context grey through direct orange to changed
 * yellow, and movement spawns wavefronts that propagate outward.
 */
export default function ReferenceField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    let nodes: FieldNode[] = [];
    let edges: FieldEdge[] = [];
    const waves: Wave[] = [];
    let px = -9999, py = -9999, lastWave = 0;
    let raf = 0;
    let resizeTimer: number | undefined;

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rand = seeded(20260919);
      const count = Math.max(52, Math.min(120, Math.round((W * H) / 14500)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          ox: rand() * W, oy: rand() * H, x: 0, y: 0,
          r: 0.8 + rand() * 1.4,
          ph: rand() * Math.PI * 2,
          am: 3 + rand() * 7,
          sp: 0.12 + rand() * 0.22,
          e: 0,
        });
      }

      const maxD = Math.min(W, H) * 0.17;
      edges = [];
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const dx = nodes[a].ox - nodes[b].ox;
          const dy = nodes[a].oy - nodes[b].oy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) edges.push([a, b, 1 - d / maxD]);
        }
      }
    }

    function staticDraw() {
      ctx!.clearRect(0, 0, W, H);
      for (const n of nodes) { n.x = n.ox; n.y = n.oy; }
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = "rgba(100,116,139,.05)";
      for (const [a, b] of edges) {
        ctx!.beginPath();
        ctx!.moveTo(nodes[a].x, nodes[a].y);
        ctx!.lineTo(nodes[b].x, nodes[b].y);
        ctx!.stroke();
      }
      ctx!.fillStyle = "rgba(100,116,139,.2)";
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, 6.2832);
        ctx!.fill();
      }
    }

    function frame(t: number) {
      const ts = t / 1000;
      const R = 250;
      ctx!.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x = n.ox + Math.sin(ts * n.sp + n.ph) * n.am;
        n.y = n.oy + Math.cos(ts * n.sp * 0.8 + n.ph) * n.am * 0.7;

        let dx = n.x - px, dy = n.y - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        let e = d < R ? Math.pow(1 - d / R, 1.7) : 0;

        for (const w of waves) {
          dx = n.x - w.x; dy = n.y - w.y;
          const band = Math.abs(Math.sqrt(dx * dx + dy * dy) - w.age * 620);
          if (band < 70) e = Math.max(e, (1 - band / 70) * w.str);
        }
        n.e += (e - n.e) * 0.12;
      }

      ctx!.lineWidth = 1;
      for (const [ai, bi, prox] of edges) {
        const A = nodes[ai], B = nodes[bi];
        const ee = A.e > B.e ? A.e : B.e;
        const al = 0.02 * prox + ee * 0.28 * prox;
        if (al < 0.006) continue;
        ctx!.strokeStyle = `rgba(${heat(ee)},${al.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.moveTo(A.x, A.y);
        ctx!.lineTo(B.x, B.y);
        ctx!.stroke();
      }

      for (const n of nodes) {
        ctx!.fillStyle = `rgba(${heat(n.e)},${(0.12 + n.e * 0.7).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r + n.e * 1.9, 0, 6.2832);
        ctx!.fill();
        if (n.e > 0.45) {
          ctx!.fillStyle = `rgba(${heat(n.e)},${((n.e - 0.45) * 0.12).toFixed(3)})`;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, (n.r + 2) * 4.5, 0, 6.2832);
          ctx!.fill();
        }
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].age += 0.0165;
        waves[i].str *= 0.972;
        if (waves[i].str < 0.04 || waves[i].age > 2.4) waves.splice(i, 1);
      }

      raf = requestAnimationFrame(frame);
    }

    function spawn(x: number, y: number, str: number) {
      if (waves.length > 5) waves.shift();
      waves.push({ x, y, age: 0, str });
    }

    const onMove = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      const now = performance.now();
      if (now - lastWave > 240) { lastWave = now; spawn(px, py, 0.55); }
    };
    const onDown = (e: PointerEvent) => spawn(e.clientX, e.clientY, 1);
    const onLeave = () => { px = -9999; py = -9999; };
    const onResizeStatic = () => { build(); staticDraw(); };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 140);
    };

    build();
    cv.classList.add("is-lit");

    if (reduced) {
      staticDraw();
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced]);

  return (
    <>
      <canvas id="field" ref={canvasRef} aria-hidden="true" />
      <div className="bloom" aria-hidden="true" />
    </>
  );
}
