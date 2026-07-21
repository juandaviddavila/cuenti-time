import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { IncidentTypesClient } from "./incident-types-client";
import type { IncidentType } from "@/types/incident-type";
import { bigintToString } from "@/lib/bigint";

export default async function IncidentTypesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const token = cookieStore.get("access-token")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let incidentTypes: IncidentType[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/incident-types`, {
      headers: token ? { Cookie: `access-token=${token}` } : undefined,
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { data: IncidentType[] };
      incidentTypes = json.data ?? [];
    }
  } catch (err) {
    console.error("Error fetching incident types:", err);
  }

  return (
    <IncidentTypesClient
      userRole={session.role}
      companyId={bigintToString(session.companyId) ?? ""}
      initialIncidentTypes={incidentTypes}
    />
  );
}
