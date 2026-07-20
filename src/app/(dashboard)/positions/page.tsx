import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { PositionsClient } from "./positions-client";
import type { Position } from "@/types/position";

export default async function PositionsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const token = cookieStore.get("access-token")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let positions: Position[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/positions`, {
      headers: token ? { Cookie: `access-token=${token}` } : undefined,
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { data: Position[] };
      positions = json.data ?? [];
    }
  } catch (err) {
    console.error("Error fetching positions:", err);
  }

  return (
    <PositionsClient
      userRole={session.role}
      companyId={session.companyId ?? ""}
      initialPositions={positions}
    />
  );
}
