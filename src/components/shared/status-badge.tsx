import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusType = "ACTIVE" | "INACTIVE" | string;

const MAP: Record<string, { label: string; classes: string }> = {
  ACTIVE:   { label: "Activo",   classes: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
  INACTIVE: { label: "Inactivo", classes: "bg-red-500/10   text-red-600   border-red-200   dark:border-red-800"   },
  SUCCESS:  { label: "Exitoso",  classes: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
  FAILED:   { label: "Fallido",  classes: "bg-red-500/10   text-red-600   border-red-200   dark:border-red-800"   },
  CHECK_IN: { label: "Entrada",  classes: "bg-blue-500/10  text-blue-600  border-blue-200  dark:border-blue-800"  },
  CHECK_OUT:{ label: "Salida",   classes: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800" },
};

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  const cfg = MAP[status] ?? { label: status, classes: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn(cfg.classes, "font-medium", className)}>
      {cfg.label}
    </Badge>
  );
}
