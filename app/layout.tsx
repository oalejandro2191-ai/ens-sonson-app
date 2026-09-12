import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-polish.css";

const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const metadata: Metadata = {
  title: isStaging ? "ENS English — Staging Alpha" : "ENS English",
  description: "Plataforma institucional para el aprendizaje de inglés de la Escuela Normal Superior de Sonsón.",
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
      <body>
        {isStaging ? (
          <div
            data-testid="staging-alpha-banner"
            style={{
              background: "#fff3c4",
              borderBottom: "1px solid #d8b446",
              color: "#4b3a00",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              padding: "8px 16px",
              textAlign: "center",
            }}
          >
            ENS ENGLISH — STAGING ALPHA · DATOS FICTICIOS · NO PRODUCCIÓN
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
