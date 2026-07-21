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

export interface NavLink {
  kind: "link";
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  integrationOnly?: boolean;
}

export interface NavGroup {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** Ruta principal al hacer clic en el grupo (opcional). */
  href?: string;
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

/** @deprecated use NavLink — alias for older imports */
export type NavItem = NavLink;

/**
 * Menú lateral: pocos grupos, etiquetas cortas.
 * Bottom nav móvil sigue con los 5 atajos principales.
 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    kind: "link",
    label: "Inicio",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "REPORT_VIEWER"],
  },
  {
    kind: "link",
    label: "Consola admin",
    href: "/super-admin",
    icon: Building2,
    roles: ["SAAS_SUPER_ADMIN"],
  },
  {
    kind: "link",
    label: "Sucursales",
    href: "/branches",
    icon: GitBranch,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    kind: "group",
    id: "empleados",
    label: "Empleados",
    icon: Users,
    href: "/employees",
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
    children: [
      {
        kind: "link",
        label: "Listado",
        href: "/employees",
        icon: Users,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
      },
      {
        kind: "link",
        label: "Cargos",
        href: "/positions",
        icon: Briefcase,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
      },
      {
        kind: "link",
        label: "Turnos",
        href: "/shifts",
        icon: CalendarDays,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    kind: "link",
    label: "Registro facial",
    href: "/facial-registration",
    icon: ScanFace,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "FACE_REGISTRAR"],
  },
  {
    kind: "link",
    label: "Asistencia",
    href: "/attendance",
    icon: Clock,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
  },
  {
    kind: "group",
    id: "novedades",
    label: "Novedades",
    icon: AlertCircle,
    href: "/incidents",
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
    children: [
      {
        kind: "link",
        label: "Registro",
        href: "/incidents",
        icon: AlertCircle,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"],
      },
      {
        kind: "link",
        label: "Tipos",
        href: "/incident-types",
        icon: FileText,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    kind: "group",
    id: "informes",
    label: "Informes",
    icon: BarChart3,
    href: "/reports",
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "REPORT_VIEWER"],
    children: [
      {
        kind: "link",
        label: "Reportes",
        href: "/reports",
        icon: BarChart3,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR", "REPORT_VIEWER"],
      },
      {
        kind: "link",
        label: "Auditoría",
        href: "/audit",
        icon: ShieldCheck,
        roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
      },
    ],
  },
  {
    kind: "link",
    label: "Usuarios",
    href: "/users",
    icon: UserCheck,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"],
  },
  {
    kind: "link",
    label: "Planes SaaS",
    href: "/plans",
    icon: Package,
    roles: ["SAAS_SUPER_ADMIN"],
  },
  {
    kind: "link",
    label: "Configuración",
    href: "/settings",
    icon: Settings,
    roles: ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "DEVELOPER"],
  },
  {
    kind: "link",
    label: "Integraciones",
    href: "/settings/integrations",
    icon: Key,
    roles: [],
    integrationOnly: true,
  },
];

/** Flat list kept for callers that only need links (e.g. tests). */
export const NAV_ITEMS: NavLink[] = NAV_ENTRIES.flatMap((entry) =>
  entry.kind === "group" ? entry.children : [entry]
);

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return entry.kind === "group";
}

export function linkIsVisible(
  item: NavLink,
  role: UserRole | undefined,
  hasIntegrationAccess: boolean
): boolean {
  if (!role) return false;
  if (item.integrationOnly) return hasIntegrationAccess;
  return item.roles.includes(role);
}

export function filterNavEntries(
  role: UserRole | undefined,
  hasIntegrationAccess: boolean
): NavEntry[] {
  if (!role) return [];

  return NAV_ENTRIES.map((entry) => {
    if (entry.kind === "link") {
      return linkIsVisible(entry, role, hasIntegrationAccess) ? entry : null;
    }

    const children = entry.children.filter((child) =>
      linkIsVisible(child, role, hasIntegrationAccess)
    );
    if (children.length === 0) return null;

    // Group visible if user sees the group role OR any child
    const groupVisible =
      entry.roles.includes(role) || children.length > 0;
    if (!groupVisible) return null;

    return { ...entry, children };
  }).filter((entry): entry is NavEntry => entry !== null);
}

export function isPathActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Avoid /settings matching /settings/integrations when both appear
  if (href === "/settings") {
    return pathname === "/settings" || pathname.startsWith("/settings?");
  }
  if (href === "/reports") {
    return pathname === "/reports" || pathname.startsWith("/reports/");
  }
  if (href === "/employees") {
    return pathname === "/employees" || pathname.startsWith("/employees/");
  }
  if (href === "/incidents") {
    return pathname === "/incidents" || pathname.startsWith("/incidents/");
  }
  return pathname.startsWith(`${href}/`);
}

export function groupContainsActivePath(
  group: NavGroup,
  pathname: string
): boolean {
  return group.children.some((child) => isPathActive(pathname, child.href));
}
