import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ryvo — Collect. Connect. Complete.",
    short_name: "Ryvo",
    description: "Choose a competition, collect the pieces and race to complete your board.",
    start_url: "/explore?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#050505",
    theme_color: "#050505",
    categories: ["games", "entertainment"],
    lang: "en",
    dir: "ltr",
    // Android draws its launch screen from the "any" icons and the home-screen
    // icon from the "maskable" ones. The "any" icons are a plain canvas-black
    // tile so the launch screen reveals nothing and flows straight into Ryvo's
    // own splash, where the ink pass draws the logo. The logo lives in the
    // maskable icons, which Android uses on the home screen.
    icons: [
      { src: "/icon-launch-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-launch-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore", short_name: "Explore", url: "/explore?source=shortcut", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "My boards", short_name: "Boards", url: "/boards?source=shortcut", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Wallet", short_name: "Wallet", url: "/wallet?source=shortcut", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
