"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PixelBlast = dynamic(() => import("@/components/ui/PixelBlast"), {
  ssr: false,
});

interface NetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
}

function prefersReducedData() {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

export function DeferredPixelBlast() {
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (
      prefersReducedData() ||
      !window.matchMedia("(min-width: 768px) and (pointer: fine)").matches
    ) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => setReady(true), {
        timeout: 1_200,
      });
      return () => {
        window.cancelIdleCallback(idleId);
        motionQuery.removeEventListener("change", updateMotionPreference);
      };
    }

    const timer = globalThis.setTimeout(() => setReady(true), 600);
    return () => {
      globalThis.clearTimeout(timer);
      motionQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  if (!ready) return null;

  return (
    <PixelBlast
      antialias={false}
      color="#2227F7"
      edgeFade={0.18}
      enableRipples={!reducedMotion}
      patternDensity={0.72}
      patternScale={2.4}
      pixelSize={5}
      pixelSizeJitter={0.18}
      rippleIntensityScale={1.15}
      rippleSpeed={0.34}
      rippleThickness={0.1}
      speed={reducedMotion ? 0 : 0.16}
      transparent
      variant="square"
    />
  );
}
