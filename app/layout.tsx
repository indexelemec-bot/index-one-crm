import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { CrmProvider } from "@/components/crm-provider";

export const metadata: Metadata = {
  title: "INDEX ONE CRM",
  description: "CRM B2B para soluciones de administración condominial",
  applicationName: "INDEX ONE CRM",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  appleWebApp: {
    capable: true,
    title: "INDEX ONE",
    statusBarStyle: "black-translucent"
  }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body><CrmProvider><AppShell>{children}</AppShell></CrmProvider></body></html>; }
