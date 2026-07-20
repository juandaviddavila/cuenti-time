"use client";

import Link from "next/link";
import {
  Building2,
  GitBranch,
  Users,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Sun,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { formatTime, getInitials } from "@/lib/utils";
import type { DashboardStats } from "@/types/attendance";
import type { DayOutcome } from "@/lib/hr/day-evaluation";

interface WeeklyData {
  day: string;
  entradas: number;
}

interface RecentAttendance {
  id: string;
  employeeName: string;
  employeePhoto: string | null;
  position: string | null;
  type: "CHECK_IN" | "CHECK_OUT";
  recordedAt: string;
  validationStatus: string;
  confidenceScore: number | null;
}

interface DailyQuickRow {
  employeeId: string;
  employeeName: string;
  branchName: string;
  positionName: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  outcome: DayOutcome;
  outcomeLabel: string;
  noveltyName: string | null;
}

interface DailyQuickReport {
  present: number;
  late: number;
  absent: number;
  justifiedAbsent: number;
  openDays: number;
  earlyLeave: number;
  rows: DailyQuickRow[];
  totalRows: number;
}

interface Props {
  stats: DashboardStats;
  weeklyData: WeeklyData[];
  recentAttendance: RecentAttendance[];
  dailyQuickReport: DailyQuickReport;
  userRole: string;
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

const STAT_CARDS = (stats: DashboardStats) => [
  {
    title: "Empresas activas",
    value: stats.totalCompanies,
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Sucursales",
    value: stats.totalBranches,
    icon: GitBranch,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Total empleados",
    value: stats.totalEmployees,
    icon: Users,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Presentes hoy",
    value: stats.presentToday,
    icon: UserCheck,
    color: "text-green-400",
    bg: "bg-green-500/10",
    trend: `${stats.attendanceRate}% asistencia`,
    trendPositive: stats.attendanceRate >= 80,
  },
  {
    title: "Ausentes hoy",
    value: stats.absentToday,
    icon: UserX,
    color: "text-red-400",
    bg: "bg-red-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Entradas hoy",
    value: stats.checkInsToday,
    icon: LogIn,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Salidas hoy",
    value: stats.checkOutsToday,
    icon: LogOut,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Llegadas tarde",
    value: stats.lateArrivals,
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    trend: null as string | null,
    trendPositive: undefined as boolean | undefined,
  },
  {
    title: "Alertas faciales",
    value: stats.facialAlerts,
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    trend: stats.facialAlerts > 0 ? "Requiere atención" : null,
    trendPositive: false,
  },
];

export function DashboardClient({
  stats,
  weeklyData,
  recentAttendance,
  dailyQuickReport,
  userRole,
}: Props) {
  const statCards =
    userRole === "SAAS_SUPER_ADMIN"
      ? STAT_CARDS(stats)
      : STAT_CARDS(stats).filter((c) => c.title !== "Empresas activas");

  const quickStats = [
    { label: "Presentes", value: dailyQuickReport.present, icon: UserCheck },
    { label: "Tarde", value: dailyQuickReport.late, icon: Clock },
    { label: "Ausentes", value: dailyQuickReport.absent, icon: UserX },
    { label: "Sin salida", value: dailyQuickReport.openDays, icon: CalendarClock },
    {
      label: "Salida anticipada",
      value: dailyQuickReport.earlyLeave,
      icon: LogOut,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resumen del día ·{" "}
          {new Date().toLocaleDateString("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <Card className="border-none bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="py-5 px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-blue-100 text-sm font-medium">
                Tasa de asistencia hoy
              </p>
              <p className="text-3xl font-bold mt-1">{stats.attendanceRate}%</p>
            </div>
            <div className="flex-1 max-w-xs">
              <Progress
                value={stats.attendanceRate}
                className="h-3 bg-white/20"
              />
              <div className="flex justify-between text-xs text-blue-200 mt-1">
                <span>{stats.presentToday} presentes</span>
                <span>{stats.absentToday} ausentes</span>
              </div>
            </div>
            <Activity className="w-10 h-10 text-white/30 hidden sm:block" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {card.value.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5 leading-tight">
                {card.title}
              </p>
              {card.trend && (
                <div
                  className={`flex items-center gap-1 mt-2 text-xs ${
                    card.trendPositive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {card.trendPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {card.trend}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Diario operativo
            </CardTitle>
            <CardDescription>
              Snapshot de hoy · presentes, tardanzas, ausentes y sin salida
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/reports/daily">
              Ver informe completo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {quickStats.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border bg-muted/30 px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="text-xl font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {dailyQuickReport.rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sun className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin días laborales para mostrar hoy</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Sucursal
                      </TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyQuickReport.rows.map((r) => (
                      <TableRow key={r.employeeId}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {r.employeeName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate md:hidden">
                              {r.branchName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {r.branchName}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {r.checkIn ?? "—"}
                          {r.lateMinutes > 0 ? (
                            <span className="block text-xs text-amber-600 dark:text-amber-400">
                              +{r.lateMinutes} min
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {r.checkOut ?? "—"}
                          {r.earlyLeaveMinutes > 0 ? (
                            <span className="block text-xs text-amber-600 dark:text-amber-400">
                              −{r.earlyLeaveMinutes} min
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={OUTCOME_VARIANT[r.outcome]}>
                            {r.outcomeLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {dailyQuickReport.totalRows > dailyQuickReport.rows.length ? (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando {dailyQuickReport.rows.length} de{" "}
                  {dailyQuickReport.totalRows} ·{" "}
                  <Link
                    href="/reports/daily"
                    className="underline underline-offset-2"
                  >
                    ver todos
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Entradas por día</CardTitle>
            <CardDescription>Últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="entradas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorEntradas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen semanal</CardTitle>
            <CardDescription>Entradas diarias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar dataKey="entradas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <CardDescription>Últimas marcaciones del día</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttendance.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin actividad registrada hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAttendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {getInitials(record.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {record.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {record.position || "Sin cargo"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        record.type === "CHECK_IN" ? "default" : "secondary"
                      }
                      className={
                        record.type === "CHECK_IN"
                          ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800"
                          : "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800"
                      }
                    >
                      {record.type === "CHECK_IN" ? "Entrada" : "Salida"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(record.recordedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
