import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { getReportBySlug } from "@/lib/hr/report-catalog";
import { loadReportPageFilters } from "../load-report-filters";
import { ReportViewer } from "../report-viewer";

type PageProps = {
  params: { report: string };
};

export default async function ReportDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (!getReportBySlug(params.report)) notFound();

  const filters = await loadReportPageFilters(session);

  return (
    <ReportViewer
      reportSlug={params.report}
      forcedBranchId={filters.forcedBranchId}
      branches={filters.branches}
      employees={filters.employees}
      shifts={filters.shifts}
      positions={filters.positions}
    />
  );
}
