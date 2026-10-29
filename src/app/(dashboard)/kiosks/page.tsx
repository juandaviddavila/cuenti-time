import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { KiosksClient } from "./kiosks-client";
export default async function KiosksPage() {
  if (!await getServerSession()) redirect("/login");
  return <KiosksClient />;
}
