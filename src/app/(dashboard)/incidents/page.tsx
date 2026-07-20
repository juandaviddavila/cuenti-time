import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServerSession } from "@/lib/server-auth";
import { IncidentsClient } from "./incidents-client";


interface ApiIncident {
  id: string;
  companyId: string;
  employeeId?: string | null;
  branchId?: string | null;
  incidentTypeId: string;
  date: string;
  overrideStart?: string | null;
  overrideEnd?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string } | null;
  branch?: { id: string; name: string } | null;
  incidentType: { id: string; name: string };
}

interface ApiIncidentType {
  id: string;
  name: string;
  active?: boolean;
}

interface ApiEmployee {
  id: string;
  fullName: string;
}

interface ApiBranch {
  id: string;
  name: string;
}

interface PaginatedResponse<T> {
  data: T[];
}

async function fetchApi<T>(url: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const response = await fetch(url, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Fetch error ${url}: ${response.status} ${response.statusText}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.error(`Fetch exception ${url}:`, err);
    return null;
  }
}

export default async function IncidentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:7578";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const [incidentsResult, typesResult, employeesResult, branchesResult] = await Promise.all([
    fetchApi<PaginatedResponse<ApiIncident>>(`${baseUrl}/api/incidents`),
    fetchApi<PaginatedResponse<ApiIncidentType>>(`${baseUrl}/api/incident-types?active=true`),
    fetchApi<PaginatedResponse<ApiEmployee>>(`${baseUrl}/api/employees?pageSize=1000`),
    fetchApi<PaginatedResponse<ApiBranch>>(`${baseUrl}/api/branches?pageSize=1000`),
  ]);

  return (
    <IncidentsClient
      userRole={session.role}
      incidents={incidentsResult?.data ?? []}
      incidentTypes={typesResult?.data ?? []}
      employees={employeesResult?.data ?? []}
      branches={branchesResult?.data ?? []}
    />
  );
}
