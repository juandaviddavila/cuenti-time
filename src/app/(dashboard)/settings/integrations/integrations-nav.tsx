"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Key, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/integrations/api-tokens", label: "Tokens API", icon: Key },
  { href: "/settings/integrations/mcp", label: "MCP", icon: Bot },
  { href: "/settings/integrations/webhooks", label: "Webhooks", icon: Webhook },
] as const;

export function IntegrationsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
      <Link
        href="/api/v1/docs"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-muted text-muted-foreground hover:text-foreground ml-auto"
      >
        Documentación API
      </Link>
    </div>
  );
}
