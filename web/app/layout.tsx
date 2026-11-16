import type { Metadata } from "next";
import { getImageProps } from "next/image";
import "./globals.css";
import "./product-polish.css";
import "./game-room.css";
import "./ryvo-system.css";
import "./loading-screen.css";
import "./select.css";
import "./token-profile.css";
import "./live-product.css";
export const metadata: Metadata = { title: "Ryvo — Collect. Connect. Complete.", description: "Choose a competition. Collect the pieces. Complete your board. Get in the Ryvo game." };
const loaderLogo=getImageProps({src:"/ryvo-logo.png",alt:"",width:192,height:192}).props.src;
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><head><link rel="preload" as="image" href={loaderLogo}/></head><body>{children}</body></html>; }
