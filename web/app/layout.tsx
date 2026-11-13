import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Ryvo — Collect. Connect. Complete.", description: "Discover extraordinary art. Collect the pieces. Complete your board." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
