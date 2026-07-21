"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { APP_NAME } from "@/lib/brand";
import { BrandLockup } from "@/components/brand-lockup";
import type { User } from "@/types/user";

const credentialsSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type CodeForm = z.infer<typeof codeSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [pendingEmail, setPendingEmail] = useState("");
  const setUser = useAuthStore((s) => s.setUser);

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const onCredentialsSubmit = async (data: CredentialsForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        requiresLoginCode?: boolean;
        message?: string;
        email?: string;
        devCode?: string;
      };

      if (!res.ok) {
        if (res.status === 403 && json.code === "EMAIL_NOT_VERIFIED") {
          toast.info("Verifica tu correo con el código que te enviamos.");
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
          return;
        }
        throw new Error(json.error || "Error al iniciar sesión");
      }

      if (!json.requiresLoginCode) {
        throw new Error("Respuesta de inicio de sesión inválida");
      }

      setPendingEmail(json.email ?? data.email);
      setStep("code");
      codeForm.reset({ code: "" });
      toast.success(json.message ?? "Revisa tu correo e ingresa el código");
      if (json.devCode) {
        toast.info(`Modo desarrollo: código ${json.devCode}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const onCodeSubmit = async (data: CodeForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: data.code }),
      });
      const json = (await res.json()) as {
        error?: string;
        user?: User;
        accessToken?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Código inválido");
      }

      if (!json.user || !json.accessToken) {
        throw new Error("No se pudo completar el inicio de sesión");
      }

      setUser(json.user, json.accessToken);
      toast.success(`Bienvenido, ${json.user.name}`);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al verificar código");
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/login/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Brand panel — estilo Cuenti Work */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-[#111111] text-white p-10 xl:p-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="relative z-10">
          <BrandLockup variant="on-dark" size="md" />
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight leading-tight">
            Control de asistencia simple y preciso
          </h1>
          <p className="text-white/55 text-base leading-relaxed">
            Gestiona ingresos, salidas y equipos desde un solo lugar, con reconocimiento facial.
          </p>
        </div>

        <p className="relative z-10 text-white/35 text-sm">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] space-y-8 animate-fade-in">
          <div className="lg:hidden">
            <BrandLockup variant="auto" align="start" size="md" />
          </div>

          {step === "credentials" ? (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Iniciar sesión
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ingresa con tu cuenta empresarial
                </p>
              </div>

              <form
                onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@empresa.com"
                    autoComplete="email"
                    className="h-11 bg-background"
                    {...credentialsForm.register("email")}
                  />
                  {credentialsForm.formState.errors.email && (
                    <p className="text-destructive text-sm">
                      {credentialsForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 bg-background pr-10"
                      {...credentialsForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {credentialsForm.formState.errors.password && (
                    <p className="text-destructive text-sm">
                      {credentialsForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-medium"
                >
                  {isLoading ? "Verificando..." : "Continuar"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Código de verificación
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enviamos un código de 6 dígitos a{" "}
                  <span className="text-foreground font-medium">{pendingEmail}</span>
                </p>
              </div>

              <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code">Código de acceso</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="h-12 bg-background text-center text-2xl tracking-[0.35em] font-mono"
                    {...codeForm.register("code")}
                  />
                  {codeForm.formState.errors.code && (
                    <p className="text-destructive text-sm">
                      {codeForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-11 font-medium">
                  {isLoading ? "Verificando..." : "Iniciar sesión"}
                </Button>
              </form>

              <div className="flex flex-col gap-3 text-center text-sm">
                <button
                  type="button"
                  onClick={onResendCode}
                  disabled={isResending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {isResending ? "Reenviando..." : "Reenviar código"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    codeForm.reset();
                  }}
                  className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a credenciales
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-foreground font-medium hover:underline underline-offset-4">
              Crear cuenta empresarial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
