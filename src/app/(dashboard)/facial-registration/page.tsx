"use client";

import dynamic from "next/dynamic";

const FacialRegistrationContent = dynamic(
  () => import("./facial-registration-content").then(m => m.default),
  { ssr: false }
);

export default function FacialRegistrationPage() {
  return <FacialRegistrationContent />;
}
