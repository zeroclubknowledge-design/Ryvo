"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/** Chrome's install event; not yet in the DOM typings. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "ryvo-install-dismissed-at";
const DISMISS_FOR = 14 * 24 * 60 * 60 * 1000;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_FOR;
  } catch {
    return false;
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/* Android may close a backgrounded app and relaunch it at the manifest's
   start URL. Remember the last in-app page so a relaunch resumes there. */
const RESUME_KEY = "ryvo-resume";
const RESUME_FOR = 30 * 60 * 1000;
const resumable = (path: string) =>
  /^\/(explore|boards|board\/[a-z0-9-]+|create|referrals|wallet(\/p2p)?|notifications|profile|collection\/[a-z0-9-]+|merchant|admin)$/.test(path);

function ResumeLastPage() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!window.matchMedia("(display-mode: standalone)").matches) return;
    if (search.get("source") === "pwa") {
      try {
        const saved = JSON.parse(localStorage.getItem(RESUME_KEY) || "null") as { path: string; at: number } | null;
        if (saved && Date.now() - saved.at < RESUME_FOR && resumable(saved.path) && saved.path !== pathname) {
          router.replace(saved.path);
          return;
        }
      } catch { /* storage blocked */ }
    }
    if (resumable(pathname)) {
      try { localStorage.setItem(RESUME_KEY, JSON.stringify({ path: pathname, at: Date.now() })); } catch { /* storage blocked */ }
    }
  }, [pathname, search, router]);

  // Keep the timestamp fresh while the app is open, and on the way out.
  useEffect(() => {
    const touch = () => {
      if (!resumable(location.pathname)) return;
      try { localStorage.setItem(RESUME_KEY, JSON.stringify({ path: location.pathname, at: Date.now() })); } catch { /* storage blocked */ }
    };
    document.addEventListener("visibilitychange", touch);
    return () => document.removeEventListener("visibilitychange", touch);
  }, []);
  return null;
}

export function PwaSetup() {
  return (
    <>
      <Suspense fallback={null}><ResumeLastPage /></Suspense>
      <InstallCard />
    </>
  );
}

/**
 * Registers the service worker and offers installation: Chrome/Edge/Samsung
 * get the native install prompt (which installs Ryvo as an Android app),
 * iPhone Safari gets Add to Home Screen instructions.
 */
function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "install" | "ios">("hidden");

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    if (isStandalone()) return;

    let timer = 0;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      if (!recentlyDismissed()) timer = window.setTimeout(() => setMode("install"), 2500);
    };
    const onInstalled = () => { setMode("hidden"); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIosSafari() && !recentlyDismissed()) timer = window.setTimeout(() => setMode("ios"), 2500);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setMode("hidden");
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage blocked */ }
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setMode("hidden");
    else dismiss();
  };

  if (mode === "hidden") return null;

  return (
    <aside className="pwa-install" role="dialog" aria-labelledby="pwa-install-title" aria-describedby="pwa-install-copy">
      <Image src="/icon-192.png" alt="" width={48} height={48} />
      <div>
        <b id="pwa-install-title">Get the Ryvo app</b>
        <p id="pwa-install-copy">
          {mode === "ios" ? (
            <>Tap <ShareGlyph /> Share, then <strong>Add to Home Screen</strong>.</>
          ) : (
            "Install Ryvo on your phone for full-screen play."
          )}
        </p>
      </div>
      {mode === "install" && <button className="pwa-install-action" onClick={() => void install()}>Install</button>}
      <button className="pwa-install-close" aria-label="Not now" onClick={dismiss}>×</button>
    </aside>
  );
}

function ShareGlyph() {
  return (
    <svg className="pwa-share-glyph" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
