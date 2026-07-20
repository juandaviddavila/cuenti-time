"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, BRAND } from "@/lib/brand";

const verifySchema = z.object({
  email: z.string().email("Correo inválido"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});

type VerifyForm = z.infer<typeof verifySchema>;

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      code: "",
    },
  });

  const onSubmit = async (data: VerifyForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo verificar el código");

      setVerified(true);
      toast.success(json.message ?? "Correo verificado");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al verificar");
    } finally {
      setIsLoading(false);
    }
  };

  const onResend = async () => {
    const email = getValues("email");
    if (!email) {
      toast.error("Ingresa tu correo primero");
      return;
    }

    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { error?: string; message?: string; devCode?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo reenviar el código");

      toast.success(json.message ?? "Código reenviado");
      if (json.devCode) {
        toast.info(`Modo desarrollo: código ${json.devCode}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reenviar");
    } finally {
      setIsResending(false);
    }
  };

  if (verified) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
        <ShieldCheck className="w-14 h-14 text-foreground mx-auto" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Correo verificado</h1>
        <p className="text-muted-foreground">Redirigiendo al inicio de sesión...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6 shadow-sm">
      <div className="text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logoSymbol} alt={APP_NAME} className="h-10 w-10 mx-auto" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Verifica tu correo</h1>
        <p className="text-muted-foreground text-sm">
          Te enviamos un código de 6 dígitos. Ingrésalo aquí para activar tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Correo electrónico</Label>
          <Input
            type="email"
            placeholder="admin@empresa.com"
            autoComplete="email"
            className="h-11"
            {...register("email")}
          />
          {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Código de verificación</Label>
          <Input
            inputMode="numeric"
            placeholder="123456"
            maxLength={6}
            autoComplete="one-time-code"
            className="h-12 text-center text-2xl tracking-[0.35em] font-mono"
            {...register("code")}
          />
          {errors.code && <p className="text-destructive text-sm">{errors.code.message}</p>}
        </div>

        <Button type="submit" disabled={isLoading} className="w-full h-11">
          {isLoading ? "Verificando..." : "Verificar y continuar"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 text-center text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isResending ? "Reenviando..." : "Reenviar código"}
        </button>
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
