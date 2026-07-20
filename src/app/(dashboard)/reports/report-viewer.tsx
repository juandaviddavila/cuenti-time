"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DayOutcome, HrReportKind } from "@/lib/hr/day-evaluation";
import {
  EMPTY_REPORT_MESSAGES,
  getReportBySlug,
} from "@/lib/hr/report-catalog";

interface FilterOption {
  id: string;
  name?: string;
  fullName?: string;
  branchId?: string;
  positionId?: string;
}

interface DayRow {
  date: string;
  dayName: string;
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  branchName: string;
  positionName: string;
  shiftName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  toleranceMinutes: number;
  earlyLeaveToleranceMinutes?: number;
  outcome: DayOutcome;
  outcomeLabel: string;
  novelty: {
    typeName: string;
    reason: string | null;
    excusesLate?: boolean;
    excusesEarlyLeave?: boolean;
  } | null;
}

interface EmployeeSummaryRow {
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  branchName: string;
  workDays: number;
  presentDays: number;
  absentDays: number;
  justifiedAbsenceDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  openDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  punctualityRate: number;
}

interface BranchSummaryRow {
  branchId: string;
  branchName: string;
  employees: number;
  workDays: number;
  presentDays: number;
  absentDays: number;
  justifiedAbsenceDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  openDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  punctualityRate: number;
}

interface ReportViewerProps {
  reportSlug: string;
  forcedBranchId: string | null;
  branches: FilterOption[];
  employees: FilterOption[];
  shifts: FilterOption[];
  positions: FilterOption[];
}

const OUTCOME_VARIANT: Record<
  DayOutcome,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PRESENTE: "default",
  TARDE: "destructive",
  SALIDA_ANTICIPADA: "destructive",
  TARDE_Y_SALIDA_ANTICIPADA: "destructive",
  SIN_SALIDA: "secondary",
  AUSENTE: "destructive",
  AUSENCIA_JUSTIFICADA: "outline",
  SIN_TURNO: "secondary",
};

function OutcomeBadge({
  outcome,
  label,
}: {
  outcome: DayOutcome;
  label: string;
}) {
  return <Badge variant={OUTCOME_VARIANT[outcome]}>{label}</Badge>;
}

export function ReportViewer(props: ReportViewerProps) {
  const report = getReportBySlug(props.reportSlug);
  if (!report) {
    return (
      <EmptyState
        icon={FileText}
        title="Informe no encontrado"
        description="Vuelve a la galería e intenta con otro informe."
        action={
          <Button asChild>
            <Link href="/reports">Ir a la galería</Link>
          </Button>
        }
      />
    );
  }

  return <ReportViewerBody {...props} report={report} />;
}

function defaultRangeForKind(kind: HrReportKind): { from: string; to: string } {
  const today = new Date();
  // Informes operativos día a día: mismo rango que el diario (hoy).
  // Resúmenes: mes calendario.
  if (
    kind === "daily" ||
    kind === "absences" ||
    kind === "lates" ||
    kind === "early_leaves" ||
    kind === "open_days"
  ) {
    const d = format(today, "yyyy-MM-dd");
    return { from: d, to: d };
  }
  return {
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  };
}

function ReportViewerBody({
  report,
  forcedBranchId,
  branches,
  employees,
  shifts,
  positions,
}: ReportViewerProps & { report: NonNullable<ReturnType<typeof getReportBySlug>> }) {
  const kind: HrReportKind = report.kind;
  // Fechas solo en cliente: evita mismatch de hidratación por huso horario SSR vs browser.
  const [rangeReady, setRangeReady] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState(forcedBranchId ?? "all");
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [shiftId, setShiftId] = useState("all");
  const [onlyUnjustified, setOnlyUnjustified] = useState(false);
  const [includeJustified, setIncludeJustified] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [employeeRows, setEmployeeRows] = useState<EmployeeSummaryRow[]>([]);
  const [branchRows, setBranchRows] = useState<BranchSummaryRow[]>([]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (branchId !== "all" && e.branchId !== branchId) return false;
      if (
        positionIds.length > 0 &&
        (!e.positionId || !positionIds.includes(e.positionId))
      ) {
        return false;
      }
      return true;
    });
  }, [employees, branchId, positionIds]);

  useEffect(() => {
    const allowed = new Set(filteredEmployees.map((e) => e.id));
    setEmployeeIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredEmployees]);

  useEffect(() => {
    const range = defaultRangeForKind(kind);
    setFrom(range.from);
    setTo(range.to);
    setRangeReady(true);
  }, [kind]);

  const loadReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        report: kind,
        from,
        to,
      });
      if (branchId !== "all") params.set("branchId", branchId);
      for (const id of positionIds) {
        params.append("positionId", id);
      }
      for (const id of employeeIds) {
        params.append("employeeId", id);
      }
      if (shiftId !== "all") params.set("shiftId", shiftId);
      if (kind === "absences") {
        params.set("onlyUnjustified", onlyUnjustified ? "true" : "false");
        params.set("includeJustified", includeJustified ? "true" : "false");
      }

      const res = await fetch(`/api/reports/hr?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Error al cargar el informe");
      }
      const json = (await res.json()) as {
        data: DayRow[] | EmployeeSummaryRow[] | BranchSummaryRow[];
      };

      if (kind === "employee_summary") {
        setEmployeeRows(json.data as EmployeeSummaryRow[]);
        setDayRows([]);
        setBranchRows([]);
      } else if (kind === "branch_summary") {
        setBranchRows(json.data as BranchSummaryRow[]);
        setDayRows([]);
        setEmployeeRows([]);
      } else {
        setDayRows(json.data as DayRow[]);
        setEmployeeRows([]);
        setBranchRows([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [
    kind,
    from,
    to,
    branchId,
    positionIds,
    employeeIds,
    shiftId,
    onlyUnjustified,
    includeJustified,
  ]);

  useEffect(() => {
    if (!rangeReady) return;
    void loadReport();
  }, [rangeReady, loadReport]);

  function setQuickRange(days: number) {
    const end = new Date();
    const start = subDays(end, days - 1);
    setFrom(format(start, "yyyy-MM-dd"));
    setTo(format(end, "yyyy-MM-dd"));
  }

  function exportExcel() {
    let sheetData: Record<string, unknown>[] = [];

    if (kind === "employee_summary") {
      sheetData = employeeRows.map((r) => ({
        Empleado: r.employeeName,
        Documento: r.documentNumber,
        Sucursal: r.branchName,
        "Días laborales": r.workDays,
        Presentes: r.presentDays,
        Ausentes: r.absentDays,
        "Ausencias justificadas": r.justifiedAbsenceDays,
        Tardanzas: r.lateDays,
        "Min. tarde": r.totalLateMinutes,
        "Salidas anticipadas": r.earlyLeaveDays,
        "Min. anticipados": r.totalEarlyLeaveMinutes,
        "Sin salida": r.openDays,
        "% puntualidad": r.punctualityRate,
      }));
    } else if (kind === "branch_summary") {
      sheetData = branchRows.map((r) => ({
        Sucursal: r.branchName,
        Empleados: r.employees,
        "Días laborales": r.workDays,
        Presentes: r.presentDays,
        Ausentes: r.absentDays,
        "Ausencias justificadas": r.justifiedAbsenceDays,
        Tardanzas: r.lateDays,
        "Min. tarde": r.totalLateMinutes,
        "Salidas anticipadas": r.earlyLeaveDays,
        "% puntualidad": r.punctualityRate,
      }));
    } else {
      sheetData = dayRows.map((r) => ({
        Fecha: r.date,
        Día: r.dayName,
        Empleado: r.employeeName,
        Documento: r.documentNumber,
        Sucursal: r.branchName,
        Turno: r.shiftName ?? "—",
        "Inicio esperado": r.scheduledStart ?? "—",
        "Fin esperado": r.scheduledEnd ?? "—",
        Entrada: r.checkIn ?? "—",
        Salida: r.checkOut ?? "—",
        "Min. tarde": r.lateMinutes,
        "Min. anticipados": r.earlyLeaveMinutes,
        Estado: r.outcomeLabel,
        Novedad: r.novelty?.typeName ?? "—",
        Razón: r.novelty?.reason ?? "—",
      }));
    }

    if (sheetData.length === 0) {
      toast.message("No hay filas para exportar");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Informe");
    XLSX.writeFile(wb, `informe-${report.slug}-${from}_${to}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(report.title, 14, 16);
    doc.setFontSize(10);
    doc.text(`Período: ${from} — ${to}`, 14, 24);

    let head: string[][] = [];
    let body: string[][] = [];

    if (kind === "employee_summary") {
      head = [
        [
          "Empleado",
          "Sucursal",
          "Laborales",
          "Presentes",
          "Ausentes",
          "Justif.",
          "Tarde",
          "Min tarde",
          "% punt.",
        ],
      ];
      body = employeeRows.map((r) => [
        r.employeeName,
        r.branchName,
        String(r.workDays),
        String(r.presentDays),
        String(r.absentDays),
        String(r.justifiedAbsenceDays),
        String(r.lateDays),
        String(r.totalLateMinutes),
        `${r.punctualityRate}%`,
      ]);
    } else if (kind === "branch_summary") {
      head = [
        [
          "Sucursal",
          "Empleados",
          "Laborales",
          "Presentes",
          "Ausentes",
          "Tarde",
          "% punt.",
        ],
      ];
      body = branchRows.map((r) => [
        r.branchName,
        String(r.employees),
        String(r.workDays),
        String(r.presentDays),
        String(r.absentDays),
        String(r.lateDays),
        `${r.punctualityRate}%`,
      ]);
    } else {
      head = [["Fecha", "Empleado", "Esperado", "Real", "Min", "Estado", "Novedad"]];
      body = dayRows.map((r) => {
        const expected = [r.scheduledStart, r.scheduledEnd]
          .filter(Boolean)
          .join("–");
        const real = [r.checkIn, r.checkOut].filter(Boolean).join("–") || "—";
        const mins =
          kind === "lates"
            ? `${r.lateMinutes} min tarde`
            : kind === "early_leaves"
              ? `${r.earlyLeaveMinutes} min ant.`
              : r.lateMinutes > 0
                ? `${r.lateMinutes} min tarde`
                : r.earlyLeaveMinutes > 0
                  ? `${r.earlyLeaveMinutes} min ant.`
                  : "—";
        return [
          r.date,
          r.employeeName,
          expected || "—",
          real,
          mins,
          r.outcomeLabel,
          r.novelty?.typeName ?? "—",
        ];
      });
    }

    if (body.length === 0) {
      toast.message("No hay filas para exportar");
      return;
    }

    autoTable(doc, { startY: 30, head, body, styles: { fontSize: 8 } });
    doc.save(`informe-${report.slug}-${from}_${to}.pdf`);
  }

  const isEmpty =
    kind === "employee_summary"
      ? employeeRows.length === 0
      : kind === "branch_summary"
        ? branchRows.length === 0
        : dayRows.length === 0;

  const Icon = report.icon;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Galería
          </Link>
        </Button>
        <PageHeader
          title={report.title}
          description={report.description}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                size="sm"
                onClick={() => void loadReport()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Actualizar
              </Button>
            </div>
          }
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Ajusta el rango y el alcance del equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickRange(1)}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickRange(7)}
            >
              7 días
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
                setTo(format(endOfMonth(now), "yyyy-MM-dd"));
              }}
            >
              Este mes
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="from">Desde</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Hasta</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sucursal</Label>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                disabled={Boolean(forcedBranchId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {!forcedBranchId && (
                    <SelectItem value="all">Todas</SelectItem>
                  )}
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <SearchableSelect
                multiple
                value={positionIds}
                onValueChange={setPositionIds}
                placeholder="Todos"
                allLabel="Todos"
                searchPlaceholder="Buscar cargo..."
                options={positions.map((p) => ({
                  value: p.id,
                  label: p.name ?? "",
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empleado</Label>
              <SearchableSelect
                multiple
                value={employeeIds}
                onValueChange={setEmployeeIds}
                placeholder="Todos"
                allLabel="Todos"
                searchPlaceholder="Buscar empleado..."
                options={filteredEmployees.map((e) => ({
                  value: e.id,
                  label: e.fullName ?? "",
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Turno</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {kind === "absences" && (
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={onlyUnjustified}
                  onCheckedChange={(v) => setOnlyUnjustified(v === true)}
                />
                Solo injustificadas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeJustified}
                  onCheckedChange={(v) => setIncludeJustified(v === true)}
                  disabled={onlyUnjustified}
                />
                Incluir justificadas
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Calculando informe…
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={Icon}
          title={EMPTY_REPORT_MESSAGES[kind]}
          description="Prueba ampliando el rango de fechas o quitando filtros."
        />
      ) : kind === "employee_summary" ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Laborales</TableHead>
                <TableHead className="text-right">Presentes</TableHead>
                <TableHead className="text-right">Ausentes</TableHead>
                <TableHead className="text-right">Justif.</TableHead>
                <TableHead className="text-right">Tardanzas</TableHead>
                <TableHead className="text-right">Min. tarde</TableHead>
                <TableHead className="text-right">Sal. ant.</TableHead>
                <TableHead className="text-right">% puntualidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeRows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{r.employeeName}</TableCell>
                  <TableCell>{r.branchName}</TableCell>
                  <TableCell className="text-right">{r.workDays}</TableCell>
                  <TableCell className="text-right">{r.presentDays}</TableCell>
                  <TableCell className="text-right">{r.absentDays}</TableCell>
                  <TableCell className="text-right">
                    {r.justifiedAbsenceDays}
                  </TableCell>
                  <TableCell className="text-right">{r.lateDays}</TableCell>
                  <TableCell className="text-right">
                    {r.totalLateMinutes}
                  </TableCell>
                  <TableCell className="text-right">{r.earlyLeaveDays}</TableCell>
                  <TableCell className="text-right">
                    {r.punctualityRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : kind === "branch_summary" ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Empleados</TableHead>
                <TableHead className="text-right">Laborales</TableHead>
                <TableHead className="text-right">Presentes</TableHead>
                <TableHead className="text-right">Ausentes</TableHead>
                <TableHead className="text-right">Justif.</TableHead>
                <TableHead className="text-right">Tardanzas</TableHead>
                <TableHead className="text-right">Min. tarde</TableHead>
                <TableHead className="text-right">% puntualidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchRows.map((r) => (
                <TableRow key={r.branchId}>
                  <TableCell className="font-medium">{r.branchName}</TableCell>
                  <TableCell className="text-right">{r.employees}</TableCell>
                  <TableCell className="text-right">{r.workDays}</TableCell>
                  <TableCell className="text-right">{r.presentDays}</TableCell>
                  <TableCell className="text-right">{r.absentDays}</TableCell>
                  <TableCell className="text-right">
                    {r.justifiedAbsenceDays}
                  </TableCell>
                  <TableCell className="text-right">{r.lateDays}</TableCell>
                  <TableCell className="text-right">
                    {r.totalLateMinutes}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.punctualityRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Real</TableHead>
                {(kind === "lates" ||
                  kind === "early_leaves" ||
                  kind === "daily") && <TableHead>Minutos</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead>Novedad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayRows.map((r) => (
                <TableRow key={`${r.employeeId}-${r.date}`}>
                  <TableCell>
                    <div className="text-sm font-medium">{r.date}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {r.dayName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.documentNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.branchName}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {[r.scheduledStart, r.scheduledEnd]
                      .filter(Boolean)
                      .join(" – ") || "—"}
                    {r.shiftName && (
                      <div className="text-xs text-muted-foreground">
                        {r.shiftName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {[r.checkIn, r.checkOut].filter(Boolean).join(" – ") || "—"}
                  </TableCell>
                  {(kind === "lates" ||
                    kind === "early_leaves" ||
                    kind === "daily") && (
                    <TableCell className="text-sm">
                      {r.lateMinutes > 0 && (
                        <div>llegó {r.lateMinutes} min tarde</div>
                      )}
                      {r.earlyLeaveMinutes > 0 && (
                        <div>salió {r.earlyLeaveMinutes} min antes</div>
                      )}
                      {r.lateMinutes === 0 && r.earlyLeaveMinutes === 0 && "—"}
                      {kind === "lates" && r.toleranceMinutes > 0 && (
                        <div className="text-xs text-muted-foreground">
                          tolerancia entrada {r.toleranceMinutes} min
                        </div>
                      )}
                      {kind === "early_leaves" &&
                        (r.earlyLeaveToleranceMinutes ?? 0) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          tolerancia salida {r.earlyLeaveToleranceMinutes} min
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <OutcomeBadge outcome={r.outcome} label={r.outcomeLabel} />
                  </TableCell>
                  <TableCell>
                    {r.novelty ? (
                      <div>
                        <Badge variant="secondary">{r.novelty.typeName}</Badge>
                        {r.novelty.reason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[180px] truncate">
                            {r.novelty.reason}
                          </p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
