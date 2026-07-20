"use client";

import dynamic from "next/dynamic";

const KioskContent = dynamic(
  () => import("./kiosk-content").then(m => m.default),
  { ssr: false }
);

export default function KioskPage() {
  return <KioskContent />;
}
