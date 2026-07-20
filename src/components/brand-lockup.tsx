import { APP_NAME, BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandLockupProps {
  className?: string;
  /** Fondo oscuro: usa logo-dark. Fondo claro: usa símbolo + contraste de texto. */
  variant?: "auto" | "on-dark" | "on-light";
  align?: "start" | "center";
  size?: "sm" | "md";
}

export function BrandLockup({
  className,
  variant = "auto",
  align = "start",
  size = "md",
}: BrandLockupProps) {
  const logoHeight = size === "sm" ? "h-7" : "h-8";
  const symbolSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const labelClass =
    size === "sm"
      ? "text-[11px] tracking-[0.18em]"
      : "text-xs tracking-[0.18em]";

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 leading-none",
        align === "center" ? "items-center" : "items-start",
        className
      )}
    >
      {variant === "on-dark" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.logo} alt="cuenti" className={cn(logoHeight, "w-auto")} />
      ) : variant === "on-light" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.logoSymbol} alt="cuenti" className={symbolSize} />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoSymbol}
            alt="cuenti"
            className={cn(symbolSize, "dark:hidden")}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logo}
            alt="cuenti"
            className={cn(logoHeight, "w-auto hidden dark:block")}
          />
        </>
      )}
      <span
        className={cn(
          "font-medium uppercase",
          labelClass,
          align === "center" ? "" : "pl-0.5",
          variant === "on-dark"
            ? "text-white/50"
            : variant === "on-light"
              ? "text-muted-foreground"
              : "text-muted-foreground dark:text-white/50"
        )}
        aria-label={APP_NAME}
      >
        time
      </span>
    </div>
  );
}
