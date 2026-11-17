import type { MetadataRoute } from "next";

/** Descrizione dell'app installabile (icona sulla schermata home, apertura a tutto schermo). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PongFu",
    short_name: "PongFu",
    description: "Circuiti amatoriali di tennis tavolo tra amici: ranking, tornei e risultati in diretta.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111113",
    theme_color: "#111113",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
