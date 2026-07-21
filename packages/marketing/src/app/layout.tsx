import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "cuenti time | Control de asistencia sin enredos",
    template: "%s | cuenti time",
  },
  description:
    "Control de asistencia facial, geofence móvil y reportes para equipos en Colombia.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  applicationName: siteConfig.name,
  category: "business",
  icons: {
    icon: "/logo-simbolo.svg",
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: "cuenti time | Control de asistencia sin enredos",
    description:
      "Control de asistencia facial, geofence móvil y reportes para equipos en Colombia.",
    url: siteConfig.siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-CO">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
