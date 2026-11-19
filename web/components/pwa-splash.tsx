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
/** Pause on the finished logo + word before revealing the app. */
const HOLD_MS = 380;
/** Never keep the splash longer than this. */
const CAP_MS = 5000;
/** Reduced motion has no sequence to wait for: show the static logo briefly. */
const REDUCED_HOLD_MS = 900;
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

    // Leave only once the whole sequence has played — ink pass, settle, then the
    // "Ryvo" word — plus a short hold, and the page has loaded. Capped so a
    // slow load or a missed event never traps the player on the splash.
    let onWord: ((e: AnimationEvent) => void) | null = null;
    const stopListening = () => { if (onWord) document.removeEventListener("animationend", onWord); onWord = null; };
    const play = (waitForLoad: boolean) => {
      stopListening();
      let wordDone = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let loaded = !waitForLoad || document.readyState === "complete";
      let exited = false;
      const tryExit = () => { if (exited || !wordDone || !loaded) return; exited = true; stopListening(); leave(HOLD_MS); };
      onWord = (e) => { if (e.animationName === "pwa-word-in") { wordDone = true; tryExit(); } };
      document.addEventListener("animationend", onWord);
      if (!loaded) window.addEventListener("load", () => { loaded = true; tryExit(); }, { once: true });
      timers.push(window.setTimeout(() => { wordDone = true; loaded = true; tryExit(); }, CAP_MS));
      if (wordDone) timers.push(window.setTimeout(tryExit, REDUCED_HOLD_MS));
      else tryExit();
    };

    // Fresh launch.
    if (root().getAttribute("data-splash") === "in") {
      try { sessionStorage.setItem(SPLASH_SESSION_KEY, "1"); } catch { /* storage blocked */ }
      play(true);
    }

    // Long return: replay the splash over the app that was left behind.
    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_FOR && standalone() && signedIn()) {
        root().setAttribute("data-splash", "in");
        play(false);
      }
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clear(); stopListening(); document.removeEventListener("visibilitychange", onVisibility); };
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
