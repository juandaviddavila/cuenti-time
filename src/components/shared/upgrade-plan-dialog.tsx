"use client";

import Link from "next/link";
import { CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxEmployees?: number;
  activeEmployees?: number;
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  maxEmployees,
  activeEmployees,
}: UpgradePlanDialogProps) {
  const quotaLine =
    typeof maxEmployees === "number" && typeof activeEmployees === "number"
      ? `Ya usas ${activeEmployees} de ${maxEmployees} cupos del plan gratis.`
      : typeof maxEmployees === "number"
        ? `Alcanzaste el cupo de ${maxEmployees} empleados del plan gratis.`
        : "Alcanzaste el cupo de empleados del plan gratis.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:rounded-2xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl">Activa tu plan de pago</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            {quotaLine} Con el plan de pago agregas más empleados, API y MCP, y
            pagas solo por el cupo que necesites.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <li>· Empleados ilimitados según lo que contrates</li>
          <li>· Cobro mensual por empleado (COP o USD)</li>
          <li>· API pública, MCP y webhooks incluidos</li>
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Ahora no
          </Button>
          <Button type="button" className="bg-orange-500 hover:bg-orange-600" asChild>
            <Link href="/pricing">
              <CreditCard className="mr-2 h-4 w-4" />
              Pagar el plan
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** True when API rejected create/update due to employee slot quota. */
export function isEmployeeSlotLimitError(payload: {
  code?: string;
  error?: string;
}): boolean {
  if (payload.code === "EMPLOYEE_SLOT_LIMIT_REACHED") return true;
  const msg = payload.error?.toLowerCase() ?? "";
  return msg.includes("cupo") && msg.includes("empleado");
}
