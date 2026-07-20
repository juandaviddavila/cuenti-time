import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";

export default async function CompaniesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (session.role === "SAAS_SUPER_ADMIN") {
    redirect("/super-admin");
  }

  redirect("/settings");
}
