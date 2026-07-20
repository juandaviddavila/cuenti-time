import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { ReportsGallery } from "./reports-gallery";

export default async function ReportsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <ReportsGallery />;
}
