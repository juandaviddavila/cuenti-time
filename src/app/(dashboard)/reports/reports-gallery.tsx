"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { REPORT_CATALOG } from "@/lib/hr/report-catalog";

export function ReportsGallery() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Informes RR.HH."
        description="Responde en segundos: ausencias, tardanzas y salidas anticipadas cruzando turnos, tolerancia y novedades."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_CATALOG.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.slug}
              href={item.href}
              className="text-left rounded-xl border bg-card p-5 transition hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg border bg-muted/40 p-2">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-base leading-snug">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.question}</p>
                  <p className="text-xs text-muted-foreground pt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
