"use client";

import { CheckCircle2, Building2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils";
import type { Status } from "@/types/user";

interface PlanRow { id: string; name: string; type: string; price: number; maxBranches: number; maxEmployees: number; maxUsers: number; features: string[]; status: Status; companiesCount: number; }

const PLAN_STYLES: Record<string, { gradient: string; badge: string }> = {
  STARTER:      { gradient: "from-slate-500 to-slate-700",   badge: "bg-slate-500/10 text-slate-600 border-slate-200" },
  PROFESSIONAL: { gradient: "from-blue-500 to-blue-700",     badge: "bg-blue-500/10 text-blue-600 border-blue-200" },
  ENTERPRISE:   { gradient: "from-purple-500 to-purple-700", badge: "bg-purple-500/10 text-purple-600 border-purple-200" },
};

export function PlansClient({ plans }: { plans: PlanRow[] }) {
  if (!plans.length) return <EmptyState icon={Package} title="Sin planes configurados" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Planes SaaS" description="Gestión de planes de suscripción de la plataforma" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map(plan => {
          const style = PLAN_STYLES[plan.type] ?? PLAN_STYLES.STARTER;
          return (
            <Card key={plan.id} className="overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${style.gradient}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge variant="outline" className={`text-xs ${style.badge}`}>{plan.type}</Badge>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {plan.price === 0 ? "Gratis" : formatCurrency(plan.price)}
                  {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mes</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Hasta <strong className="text-foreground">{plan.maxEmployees === 99999 ? "∞" : plan.maxEmployees}</strong> empleados</p>
                  <p>Hasta <strong className="text-foreground">{plan.maxBranches === 999 ? "∞" : plan.maxBranches}</strong> sucursales</p>
                  <p>Hasta <strong className="text-foreground">{plan.maxUsers === 999 ? "∞" : plan.maxUsers}</strong> usuarios</p>
                </div>
                {plan.features.length > 0 && (
                  <ul className="space-y-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span><strong className="text-foreground">{plan.companiesCount}</strong> empresa{plan.companiesCount !== 1 ? "s" : ""} activa{plan.companiesCount !== 1 ? "s" : ""}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
