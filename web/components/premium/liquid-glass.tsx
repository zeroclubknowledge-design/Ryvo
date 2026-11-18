"use client";

import { canRunRichEffects } from "@/components/premium/capability";
import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type ElementType } from "react";

/**
 * Liquid glass surface, after dashersw/liquid-glass-js.
 *
 * The original snapshots the page with html2canvas and refracts it in WebGL.
 * Here the same optical model (a rounded-rect height field whose bezel bends
 * light inward, with per-channel dispersion) is baked into an SVG
 * displacement map and applied as a backdrop filter, so it refracts live
 * content — including WebGL artwork — without a page snapshot.
 *
 * Chromium is the only engine that accepts an SVG filter in backdrop-filter,
 * and refraction only runs on desktop-class devices. Everywhere else, and for users who ask for reduced transparency, the
 * surface falls back to the frosted treatment in premium.css.
 */

type GlassOptions = {
  /** Corner radius in px; omit to read it from computed style. */
  radius?: number;
  /** Width of the refracting rim in px. */
  bezel?: number;
  /** Displacement strength in px. */
  refraction?: number;
  /** Extra spread between colour channels (0 disables dispersion). */
  dispersion?: number;
};

type LiquidGlassProps<T extends ElementType> = GlassOptions & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof GlassOptions | "as">;

let refractionSupport: boolean | null = null;

function supportsRefraction() {
  if (refractionSupport !== null) return refractionSupport;
  const ua = navigator.userAgent;
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/iPhone|iPad|iPod/.test(ua);
  const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  refractionSupport = chromium && !reducedTransparency && canRunRichEffects();
  return refractionSupport;
}

/** Bakes the bezel refraction of a rounded rectangle into an RG displacement map. */
function displacementMap(width: number, height: number, radius: number, bezel: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const hx = width / 2, hy = height / 2;
  const r = Math.min(radius, hx, hy);
  const ix = hx - r, iy = hy - r;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - hx, py = y + 0.5 - hy;
      const qx = Math.abs(px) - ix, qy = Math.abs(py) - iy;
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const depth = r - (outside + Math.min(Math.max(qx, qy), 0));

      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { nx = (ox / outside) * Math.sign(px); ny = (oy / outside) * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);

      let strength = 0;
      if (depth > 0 && depth < bezel) {
        // Slope of the squircle thickness profile (1-(1-t)^4)^(1/4): steep at the rim, flat inside.
        const t = depth / bezel;
        const k = 1 - t;
        const inner = 1 - k ** 4;
        strength = inner > 0 ? (k ** 3) * inner ** -0.75 : 1;
        strength = Math.min(strength, 1);
      }

      const i = (y * width + x) * 4;
      // Point the sample inward so the rim converges light like a convex lens.
      data[i] = 128 - nx * strength * 127;
      data[i + 1] = 128 - ny * strength * 127;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlass<T extends ElementType = "div">({
  as,
  radius,
  bezel = 18,
  refraction = 36,
  dispersion = 0.12,
  className,
  style,
  children,
  ...rest
}: LiquidGlassProps<T>) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  const filterId = `ryvo-glass-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [filter, setFilter] = useState<{ map: string; width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !supportsRefraction()) return;
    let frame = 0;
    let last = "";
    const render = () => {
      const box = element.getBoundingClientRect();
      const width = Math.round(box.width), height = Math.round(box.height);
      if (width < 4 || height < 4) return;
      const corner = radius ?? (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0);
      const key = `${width}x${height}:${corner}:${bezel}`;
      if (key === last) return;
      last = key;
      setFilter({ map: displacementMap(width, height, corner, Math.min(bezel, width / 2, height / 2)), width, height });
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); });
    observer.observe(element);
    render();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [radius, bezel]);

  const channels = dispersion > 0
    ? [["R", 1 - dispersion], ["G", 1], ["B", 1 + dispersion]] as const
    : null;

  return (
    <Tag
      ref={ref}
      className={`liquid-glass${filter ? " is-refracting" : ""}${className ? ` ${className}` : ""}`}
      style={filter ? { ...style, ["--glass-filter" as string]: `url(#${filterId})` } : style}
      {...rest}
    >
      {filter && (
        <svg className="liquid-glass-defs" aria-hidden="true" focusable="false" width="0" height="0">
          <filter
            id={filterId}
            x="0" y="0" width={filter.width} height={filter.height}
            filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={filter.map} x="0" y="0" width={filter.width} height={filter.height} preserveAspectRatio="none" result="map" />
            {channels ? (
              <>
                {channels.map(([channel, factor]) => (
                  <feDisplacementMap key={channel} in="SourceGraphic" in2="map" scale={refraction * factor}
                    xChannelSelector="R" yChannelSelector="G" result={`shift${channel}`} />
                ))}
                <feColorMatrix in="shiftR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
                <feColorMatrix in="shiftG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
                <feColorMatrix in="shiftB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
                <feBlend in="r" in2="g" mode="screen" result="rg" />
                <feBlend in="rg" in2="b" mode="screen" />
              </>
            ) : (
              <feDisplacementMap in="SourceGraphic" in2="map" scale={refraction} xChannelSelector="R" yChannelSelector="G" />
            )}
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}
