import type { Metadata } from "next";
import "./globals.css";
import "./product-polish.css";
import "./game-room.css";
export const metadata: Metadata = { title: "Ryvo — Collect. Connect. Complete.", description: "Choose a competition. Collect the pieces. Complete your board. Get in the Ryvo game." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
