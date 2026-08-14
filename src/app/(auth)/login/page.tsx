"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { APP_NAME } from "@/lib/brand";
import { BrandLockup } from "@/components/brand-lockup";
import type { User } from "@/types/user";
import { getPostLoginPath } from "@/lib/post-login-path";
import { PhoneInput } from "@/components/shared/phone-input";
import { normalizeToE164 } from "@/lib/phone/e164";

const credentialsSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const emailOnlySchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

const whatsappSchema = z.object({
  phoneE164: z
    .string()
    .refine((value) => Boolean(normalizeToE164(value)), "Ingresa un celular válido"),
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type EmailOnlyForm = z.infer<typeof emailOnlySchema>;
type WhatsappForm = z.infer<typeof whatsappSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type LoginMethod = "password" | "email_code" | "whatsapp";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [method, setMethod] = useState<LoginMethod>("password");
  const [step, setStep] = useState<"form" | "code">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const setUser = useAuthStore((s) => s.setUser);

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
  });

  const emailOnlyForm = useForm<EmailOnlyForm>({
    resolver: zodResolver(emailOnlySchema),
  });

  const whatsappForm = useForm<WhatsappForm>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: { phoneE164: "" },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  function switchMethod(next: LoginMethod) {
    setMethod(next);
    setStep("form");
    codeForm.reset({ code: "" });
    setPendingPhone("");
  }

  const finishWithSession = (user: User, accessToken: string) => {
    setUser(user, accessToken);
    toast.success(`Bienvenido, ${user.name}`);
    router.push(getPostLoginPath(user.role));
  };

  const onPasswordSubmit = async (data: CredentialsForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, method: "password" }),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        requiresLoginCode?: boolean;
        message?: string;
        email?: string;
        devCode?: string;
        user?: User;
        accessToken?: string;
      };

      if (!res.ok) {
        if (res.status === 403 && json.code === "EMAIL_NOT_VERIFIED") {
          toast.info("Verifica tu correo con el código que te enviamos.");
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
          return;
        }
        throw new Error(json.error || "Error al iniciar sesión");
      }

      if (json.user && json.accessToken && !json.requiresLoginCode) {
        finishWithSession(json.user, json.accessToken);
        return;
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

  const onEmailCodeSubmit = async (data: EmailOnlyForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, method: "email_code" }),
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
        throw new Error(json.error || "Error al enviar el código");
      }

      setPendingEmail(json.email ?? data.email);
      setStep("code");
      codeForm.reset({ code: "" });
      toast.success(json.message ?? "Revisa tu correo e ingresa el código");
      if (json.devCode) {
        toast.info(`Modo desarrollo: código ${json.devCode}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al enviar el código");
    } finally {
      setIsLoading(false);
    }
  };

  const onWhatsappSubmit = async (data: WhatsappForm) => {
    setIsLoading(true);
    try {
      const phoneE164 = normalizeToE164(data.phoneE164);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "whatsapp", phoneE164 }),
      });
      const json = (await res.json()) as {
        error?: string;
        requiresLoginCode?: boolean;
        message?: string;
        phoneE164?: string;
        devCode?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Error al enviar el código");
      }

      setPendingPhone(phoneE164 ?? data.phoneE164);
      setPendingEmail("");
      setStep("code");
      codeForm.reset({ code: "" });
      toast.success(json.message ?? "Revisa WhatsApp e ingresa el código");
      if (json.devCode) {
        toast.info(`Modo desarrollo: código ${json.devCode}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al enviar el código");
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
        body: JSON.stringify(
          pendingPhone
            ? { phoneE164: pendingPhone, code: data.code }
            : { email: pendingEmail, code: data.code }
        ),
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

      finishWithSession(json.user, json.accessToken);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al verificar código");
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    if (!pendingEmail && !pendingPhone) return;
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/login/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pendingPhone
            ? { phoneE164: pendingPhone, channel: "whatsapp" }
            : { email: pendingEmail, channel: "email" }
        ),
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

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] space-y-8 animate-fade-in">
          <div className="lg:hidden">
            <BrandLockup variant="auto" align="start" size="md" />
          </div>

          {step === "form" ? (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Iniciar sesión
                </h2>
                <p className="text-sm text-muted-foreground">
                  Elige cómo quieres acceder a tu cuenta
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-lg border p-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => switchMethod("password")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] sm:text-sm font-medium transition-colors",
                    method === "password"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  Contraseña
                </button>
                <button
                  type="button"
                  onClick={() => switchMethod("email_code")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] sm:text-sm font-medium transition-colors",
                    method === "email_code"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  Correo
                </button>
                <button
                  type="button"
                  onClick={() => switchMethod("whatsapp")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] sm:text-sm font-medium transition-colors",
                    method === "whatsapp"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  WhatsApp
                </button>
              </div>

              {method === "password" ? (
                <form
                  onSubmit={credentialsForm.handleSubmit(onPasswordSubmit)}
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
              ) : method === "email_code" ? (
                <form
                  onSubmit={emailOnlyForm.handleSubmit(onEmailCodeSubmit)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email-code">Correo electrónico</Label>
                    <Input
                      id="email-code"
                      type="email"
                      placeholder="admin@empresa.com"
                      autoComplete="email"
                      className="h-11 bg-background"
                      {...emailOnlyForm.register("email")}
                    />
                    {emailOnlyForm.formState.errors.email && (
                      <p className="text-destructive text-sm">
                        {emailOnlyForm.formState.errors.email.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Te enviaremos un código de 6 dígitos. No necesitas contraseña.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 font-medium"
                  >
                    {isLoading ? "Enviando..." : "Enviar código"}
                  </Button>
                </form>
              ) : (
                <form
                  onSubmit={whatsappForm.handleSubmit(onWhatsappSubmit)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label>Celular WhatsApp</Label>
                    <PhoneInput
                      value={whatsappForm.watch("phoneE164")}
                      onChange={(value) =>
                        whatsappForm.setValue("phoneE164", value, { shouldValidate: true })
                      }
                    />
                    {whatsappForm.formState.errors.phoneE164 && (
                      <p className="text-destructive text-sm">
                        {whatsappForm.formState.errors.phoneE164.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Elige el indicativo del país y te enviaremos un código por WhatsApp.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 font-medium"
                  >
                    {isLoading ? "Enviando..." : "Enviar código por WhatsApp"}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Código de verificación
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enviamos un código de 6 dígitos a{" "}
                  <span className="text-foreground font-medium">
                    {pendingPhone || pendingEmail}
                  </span>
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
                    setStep("form");
                    codeForm.reset();
                  }}
                  className="inline-flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
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
