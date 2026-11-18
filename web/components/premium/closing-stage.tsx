"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/collection-art";
import { canRunRichEffects } from "@/components/premium/capability";
import { LiquidGlass } from "@/components/premium/liquid-glass";

const staticMark = <Image className="liquid-logo-fallback" src="/ryvo-logo-mark.png" alt="" width={148} height={148} />;

const BrandGradient = dynamic(() => import("@/components/premium/brand-stage").then((m) => m.BrandGradient), { ssr: false });
const LiquidLogo = dynamic(() => import("@/components/premium/brand-stage").then((m) => m.LiquidLogo), {
  ssr: false,
  loading: () => staticMark,
});

/** True while a capable device has the element close to the screen; WebGL mounts only then. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !canRunRichEffects()) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "25% 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, near] as const;
}

export function ClosingStage() {
  const [ref, near] = useNearViewport<HTMLElement>();
  return (
    <section ref={ref} className="ryvo-final ryvo-final-stage">
      <div className="ryvo-final-backdrop" aria-hidden="true">{near && <BrandGradient />}</div>
      <div className="ryvo-final-content">
        <div className="liquid-logo-frame" aria-hidden="true">{near ? <LiquidLogo /> : staticMark}</div>
        <h2>THE NEXT MOVE<br />IS YOURS.</h2>
        <p>A new challenge. A blank board. A race worth playing.</p>
        <div className="ryvo-final-actions">
          <Link className="primary" href="/onboarding">Get in the game <Icon name="arrow" /></Link>
          <LiquidGlass as={Link} href="/explore" className="glass-pill">Explore challenges</LiquidGlass>
        </div>
      </div>
    </section>
  );
}
