import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INDEX ONE CRM",
    short_name: "INDEX ONE",
    description: "CRM B2B para soluciones de administración condominial",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7fa",
    theme_color: "#08264a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
