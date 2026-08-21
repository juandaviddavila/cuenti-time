import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { canAccessSettings, getPostLoginPath } from "@/lib/post-login-path";
import { FaceMigrationClient } from "./face-migration-client";

export default async function FaceMigrationPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (!canAccessSettings(session.role)) {
    redirect(getPostLoginPath(session.role));
  }

  return <FaceMigrationClient />;
}
