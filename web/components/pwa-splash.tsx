"use client";

import { useEffect } from "react";

import { RyvoLoadingScreen } from "@/components/ryvo-loading-screen";
import { SPLASH_SESSION_KEY } from "@/lib/pwa-splash-boot";

/**
 * Splash for the installed app: the Ryvo ink-pass logo over a slowly morphing
 * brand background, then an opening reveal into the app.
 *
 * Shown only in standalone mode, only to signed-in players, on a fresh launch
 * or after 10+ minutes away. `SPLASH_BOOT` (lib/pwa-splash-boot) runs in <head> before first paint
 * and sets <html data-splash>, so the app never flashes underneath; this
 * component only times the exit and handles long returns.
 */
const AWAY_FOR = 10 * 60 * 1000;
const MIN_VISIBLE = 1700;
const EXIT_MS = 700;


const root = () => document.documentElement;
const signedIn = () => { try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)); } catch { return false; } };
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function PwaSplash() {
  useEffect(() => {
    let timers: number[] = [];
    const clear = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };

    const leave = (after: number) => {
      clear();
      timers.push(window.setTimeout(() => {
        root().setAttribute("data-splash", "out");
        timers.push(window.setTimeout(() => root().removeAttribute("data-splash"), EXIT_MS));
      }, after));
    };

    // Fresh launch: stay at least one full ink pass, and until the page has loaded.
    if (root().getAttribute("data-splash") === "in") {
      try { sessionStorage.setItem(SPLASH_SESSION_KEY, "1"); } catch { /* storage blocked */ }
      // performance.now() counts from the start of this launch.
      let finished = false;
      const finish = () => { if (finished) return; finished = true; leave(Math.max(0, MIN_VISIBLE - performance.now())); };
      if (document.readyState === "complete") finish();
      else {
        window.addEventListener("load", finish, { once: true });
        timers.push(window.setTimeout(finish, 4000)); // never hold the app back on a slow load
      }
    }

    // Long return: replay the splash over the app that was left behind.
    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_FOR && standalone() && signedIn()) {
        root().setAttribute("data-splash", "in");
        leave(MIN_VISIBLE - 300);
      }
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clear(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return (
    <div className="pwa-splash" aria-hidden="true">
      <div className="pwa-splash-fluid">
        <i className="pwa-blob is-pink" />
        <i className="pwa-blob is-green" />
        <i className="pwa-blob is-purple" />
      </div>
      <RyvoLoadingScreen label="Opening Ryvo" />
    </div>
  );
}
