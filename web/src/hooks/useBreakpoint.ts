"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "wide" | "medium" | "narrow";

const WIDE = 1024;
const MEDIUM = 768;

function getBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "wide";
  const w = window.innerWidth;
  if (w >= WIDE) return "wide";
  if (w >= MEDIUM) return "medium";
  return "narrow";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("wide");

  useEffect(() => {
    setBp(getBreakpoint());

    const wideQuery = window.matchMedia(`(min-width: ${WIDE}px)`);
    const mediumQuery = window.matchMedia(`(min-width: ${MEDIUM}px)`);

    function update() {
      setBp(getBreakpoint());
    }

    wideQuery.addEventListener("change", update);
    mediumQuery.addEventListener("change", update);
    return () => {
      wideQuery.removeEventListener("change", update);
      mediumQuery.removeEventListener("change", update);
    };
  }, []);

  return bp;
}
