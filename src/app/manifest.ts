import type { MetadataRoute } from "next";

// Web app manifest. Makes "Add to Home Screen" launch the dashboards as a
// STANDALONE, chromeless app — no Safari toolbar, no tab bar. That removes the
// browser chrome entirely, so the viewport is the full screen and the
// clipping/fitting problems those bars cause simply don't exist in this mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CMG Dashboard",
    short_name: "CMG",
    description: "Charlton Media Group dashboards",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
