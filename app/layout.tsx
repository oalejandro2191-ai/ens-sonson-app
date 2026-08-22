import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENS English — Stabilization",
  description: "Staging control plane for ENS English.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#176a45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
