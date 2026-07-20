import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  ScanFace,
  Clock,
  BarChart3,
  Settings,
  UserCheck,
  ShieldCheck,
  Package,
  Briefcase,
  CalendarDays,
  AlertCircle,
  Key,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  integrationOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "REPORT_VIEWER"],
  },
  {
    label: "Consola admin",
    href: "/super-admin",
    icon: Building2,
    roles: ["SAAS_SUPER_ADMIN"],
  },
  {
    label: "Sucursales",
    href: "/branches",
    icon: GitBranch,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Empleados",
    href: "/employees",
    icon: Users,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
  },
  {
    label: "Cargos",
    href: "/positions",
    icon: Briefcase,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Turnos",
    href: "/shifts",
    icon: CalendarDays,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Novedades",
    href: "/incidents",
    icon: AlertCircle,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
  },
  {
    label: "Tipos de Novedad",
    href: "/incident-types",
    icon: FileText,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Registro Facial",
    href: "/facial-registration",
    icon: ScanFace,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "FACE_REGISTRAR"],
  },
  {
    label: "Asistencia",
    href: "/attendance",
    icon: Clock,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
  },
  {
    label: "Informes",
    href: "/reports",
    icon: BarChart3,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "REPORT_VIEWER"],
  },
  {
    label: "Usuarios",
    href: "/users",
    icon: UserCheck,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Planes SaaS",
    href: "/plans",
    icon: Package,
    roles: ["SAAS_SUPER_ADMIN"],
  },
  {
    label: "Auditoría",
    href: "/audit",
    icon: ShieldCheck,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    label: "Configuración",
    href: "/settings",
    icon: Settings,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "DEVELOPER"],
  },
  {
    label: "Integraciones",
    href: "/settings/integrations",
    icon: Key,
    roles: [],
    integrationOnly: true,
  },
];
