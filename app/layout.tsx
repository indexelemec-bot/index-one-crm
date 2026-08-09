import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { CrmProvider } from "@/components/crm-provider";

export const metadata: Metadata = { title: "INDEX ONE CRM", description: "CRM B2B para soluciones de administración condominial" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body><CrmProvider><AppShell>{children}</AppShell></CrmProvider></body></html>; }
