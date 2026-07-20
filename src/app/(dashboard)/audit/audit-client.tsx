"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { ShieldCheck, Search, ChevronDown, ChevronUp, FileJson, User } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/types/user";

interface FilterOption {
  id: string;
  name: string;
}

interface LogRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | undefined;
  companyId: string | null;
  companyName: string | undefined;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SearchResponse {
  data: LogRow[];
  pagination: PaginationInfo;
}

interface Props {
  userRole: UserRole;
  branches: FilterOption[];
  employees: FilterOption[];
  companies: FilterOption[];
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
  UPDATE: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  DELETE: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
  DUPLICATE_ATTENDANCE:
    "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
};

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Crear" },
  { value: "UPDATE", label: "Actualizar" },
  { value: "DELETE", label: "Eliminar" },
  { value: "DUPLICATE_ATTENDANCE", label: "Marcación duplicada" },
];

const ENTITY_OPTIONS = [
  { value: "COMPANY", label: "Empresa" },
  { value: "BRANCH", label: "Sucursal" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "USER", label: "Usuario" },
  { value: "POSITION", label: "Cargo" },
  { value: "SHIFT", label: "Turno" },
  { value: "EMPLOYEE_SHIFT", label: "Asignación turno" },
  { value: "INCIDENT", label: "Incidente" },
  { value: "INCIDENT_TYPE", label: "Tipo incidente" },
  { value: "API_TOKEN", label: "Token API" },
  { value: "ATTENDANCE", label: "Asistencia" },
];

const PAGE_SIZE = 20;

function buildSearchParams(filters: {
  from: string;
  to: string;
  action: string;
  entity: string;
  branchId: string;
  employeeIds: string[];
  companyId: string;
  search: string;
  page: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(PAGE_SIZE));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.action !== "all") params.set("action", filters.action);
  if (filters.entity !== "all") params.set("entity", filters.entity);
  if (filters.branchId !== "all") params.set("branchId", filters.branchId);
  for (const id of filters.employeeIds) {
    params.append("employeeId", id);
  }
  if (filters.companyId !== "all") params.set("companyId", filters.companyId);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function DiffView({ oldValues, newValues }: { oldValues: unknown; newValues: unknown }) {
  const oldRecord = isRecord(oldValues) ? oldValues : {};
  const newRecord = isRecord(newValues) ? newValues : {};
  const allKeys = Array.from(new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]));

  if (allKeys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No hay valores registrados para este evento.</p>
    );
  }

  return (
    <div className="space-y-2">
      {allKeys.map((key) => {
        const oldVal = oldRecord[key];
        const newVal = newRecord[key];
        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        return (
          <div key={key} className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs">
            <span className="font-medium text-muted-foreground truncate" title={key}>
              {key}
            </span>
            <span
              className={`font-mono truncate rounded px-2 py-1 ${changed ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted"}`}
              title={oldVal === undefined ? undefined : JSON.stringify(oldVal)}
            >
              {oldVal === undefined ? "—" : JSON.stringify(oldVal)}
            </span>
            <span
              className={`font-mono truncate rounded px-2 py-1 ${changed ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted"}`}
              title={newVal === undefined ? undefined : JSON.stringify(newVal)}
            >
              {newVal === undefined ? "—" : JSON.stringify(newVal)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AuditClient({ userRole, branches, employees, companies }: Props) {
  const isSuperAdmin = userRole === "SAAS_SUPER_ADMIN";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filters = useMemo(
    () => ({
      from,
      to,
      action,
      entity,
      branchId,
      employeeIds,
      companyId,
      search,
      page,
    }),
    [from, to, action, entity, branchId, employeeIds, companyId, search, page]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLogs() {
      setLoading(true);
      setError(null);
      try {
        const params = buildSearchParams(filters);
        const response = await fetch(`/api/audit/search?${params.toString()}`, {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Error al consultar auditoría");
        }
        const result = (await response.json()) as SearchResponse;
        setLogs(result.data);
        setPagination(result.pagination);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchLogs, search ? 350 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, search]);

  function handleFilterChange() {
    setPage(1);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearFilters() {
    setFrom("");
    setTo("");
    setAction("all");
    setEntity("all");
    setBranchId("all");
    setEmployeeIds([]);
    setCompanyId("all");
    setSearch("");
    setPage(1);
  }

  const totalPages = pagination.totalPages;
  const hasFilters =
    from ||
    to ||
    action !== "all" ||
    entity !== "all" ||
    branchId !== "all" ||
    employeeIds.length > 0 ||
    companyId !== "all" ||
    search.trim().length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <PageHeader
          title="Auditoría"
          description={`${pagination.total} evento${pagination.total === 1 ? "" : "s"} registrado${pagination.total === 1 ? "" : "s"}`}
        />

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario, entidad, acción, ID o IP..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  handleFilterChange();
                }}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={entity}
                onValueChange={(value) => {
                  setEntity(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sucursal</label>
              <Select
                value={branchId}
                onValueChange={(value) => {
                  setBranchId(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empleado</label>
              <SearchableSelect
                multiple
                value={employeeIds}
                onValueChange={(value) => {
                  setEmployeeIds(value);
                  handleFilterChange();
                }}
                placeholder="Empleado"
                allLabel="Todos"
                searchPlaceholder="Buscar empleado..."
                options={employees.map((e) => ({
                  value: e.id,
                  label: e.name,
                }))}
              />
            </div>

            {isSuperAdmin && companies.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                <Select
                  value={companyId}
                  onValueChange={(value) => {
                    setCompanyId(value);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="space-y-3">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="rounded-lg border overflow-hidden">
              <div className="h-10 bg-muted/50" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 border-t animate-pulse bg-muted/30" />
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(1)}>
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="Sin registros de auditoría"
            description="No hay eventos que coincidan con los filtros aplicados."
          />
        )}

        {!loading && !error && logs.length > 0 && (
          <>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    {isSuperAdmin && <TableHead>Empresa</TableHead>}
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => {
                    const isExpanded = expanded.has(l.id);
                    return (
                      <Fragment key={l.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleExpanded(l.id)}
                        >
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(l.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{l.userName}</p>
                                {l.userEmail && (
                                  <p className="text-xs text-muted-foreground">{l.userEmail}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${ACTION_STYLES[l.action] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {l.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium">{l.entity}</span>
                            {l.entityId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground ml-1 cursor-help">
                                    #{l.entityId.slice(-6)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-mono text-xs">{l.entityId}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell className="text-xs text-muted-foreground">
                              {l.companyName ?? "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {l.ipAddress ?? "—"}
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={isSuperAdmin ? 7 : 6} className="p-0">
                              <div className="p-4 space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <FileJson className="w-4 h-4 text-primary" />
                                  <span>Cambios registrados</span>
                                </div>
                                <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground mb-1">
                                  <span>Campo</span>
                                  <span>Valor anterior</span>
                                  <span>Valor nuevo</span>
                                </div>
                                <DiffView oldValues={l.oldValues} newValues={l.newValues} />
                                {l.userAgent && (
                                  <p className="text-xs text-muted-foreground font-mono break-all">
                                    <span className="font-semibold">User-Agent:</span> {l.userAgent}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  Página {pagination.page} de {totalPages} · {pagination.total} registros
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
