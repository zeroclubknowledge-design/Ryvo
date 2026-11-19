import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import { getImageProps } from "next/image";
import "./globals.css";
import "./artwork-scene.css";
import "./product-polish.css";
import "./game-room.css";
import "./ryvo-system.css";
import "./loading-screen.css";
import "./select.css";
import "./token-profile.css";
import "./live-product.css";
import "./operations.css";
import "./player-profile.css";
import "./account-editing.css";
import "./premium.css";
import "./wallet.css";
import "./create.css";
import "./pwa.css";
import { PwaSetup } from "@/components/pwa-setup";
import { SolanaProvider } from "@/components/solana-provider";
const montserrat=localFont({src:"../public/fonts/Montserrat-Variable.ttf",weight:"100 900",display:"block",preload:true,variable:"--font-ryvo",adjustFontFallback:"Arial"});
export const metadata: Metadata = {
  title: "Ryvo — Collect. Connect. Complete.",
  description: "Choose a competition. Collect the pieces. Complete your board. Get in the Ryvo game.",
  applicationName: "Ryvo",
  appleWebApp: { capable: true, title: "Ryvo", statusBarStyle: "black" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#050505", colorScheme: "dark", width: "device-width", initialScale: 1 };
const loaderLogo=getImageProps({src:"/ryvo-logo.png",alt:"",width:192,height:192}).props.src;
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><head><link rel="preload" as="image" href={loaderLogo}/></head><body className={`${montserrat.className} ${montserrat.variable}`}><SolanaProvider>{children}</SolanaProvider><PwaSetup/></body></html>; }
