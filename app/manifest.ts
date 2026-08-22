import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ENS English — Staging",
    short_name: "ENS English",
    description: "Entorno de estabilización de ENS English.",
    start_url: "/estudiante",
    display: "standalone",
    background_color: "#f5f7f8",
    theme_color: "#176a45",
    lang: "es-CO",
    icons: [{ src: "/ens-icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
