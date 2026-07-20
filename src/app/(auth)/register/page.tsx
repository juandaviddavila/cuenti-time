"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/brand";
import { BrandLockup } from "@/components/brand-lockup";

const registerSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  confirmPassword: z.string(),
  companyLegalName: z.string().min(2, "Razón social requerida"),
  companyTaxId: z.string().min(5, "NIT / Identificación fiscal requerida"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const STEPS = ["Cuenta", "Empresa", "Confirmación"];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const nextStep = async () => {
    const fields: Record<number, (keyof RegisterForm)[]> = {
      0: ["name", "email", "password", "confirmPassword"],
      1: ["companyLegalName", "companyTaxId"],
    };
    const valid = await trigger(fields[step]);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al registrar");
      toast.success(json.message || "Revisa tu correo e ingresa el código de verificación.");
      if (json.devCode) {
        toast.info(`Modo desarrollo: código ${json.devCode}`);
      }
      const email = encodeURIComponent(data.email);
      router.push(`/verify-email?email=${email}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <BrandLockup variant="auto" align="center" size="md" className="mx-auto" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Crear cuenta empresarial
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Una cuenta = una empresa. Para otra empresa, regístrate con un correo distinto.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < step
                    ? "bg-foreground text-background"
                    : i === step
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  i === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${i < step ? "bg-foreground" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input placeholder="Juan Pérez" className="h-11" {...register("name")} />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="juan@empresa.com"
                  className="h-11"
                  {...register("email")}
                />
                {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    className="h-11 pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Confirmar contraseña</Label>
                <Input
                  type="password"
                  placeholder="Repite tu contraseña"
                  className="h-11"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="button" onClick={nextStep} className="w-full h-11">
                Continuar
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Building2 className="w-5 h-5" />
                <span className="text-sm">Información de tu empresa</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Después podrás crear todas las sucursales que necesites dentro de esta empresa.
              </p>
              <div className="space-y-2">
                <Label>Razón social</Label>
                <Input
                  placeholder="Mi Empresa S.A.S."
                  className="h-11"
                  {...register("companyLegalName")}
                />
                {errors.companyLegalName && (
                  <p className="text-destructive text-sm">{errors.companyLegalName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>NIT / Identificación fiscal</Label>
                <Input
                  placeholder="900123456-7"
                  className="h-11"
                  {...register("companyTaxId")}
                />
                {errors.companyTaxId && (
                  <p className="text-destructive text-sm">{errors.companyTaxId.message}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1 h-11">
                  Atrás
                </Button>
                <Button type="button" onClick={nextStep} className="flex-1 h-11">
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-muted/50 border border-border rounded-xl p-5 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  Revisar y confirmar
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    <span className="text-foreground">Prueba inicial:</span> 7 días gratis
                  </p>
                  <p className="text-xs">
                    Incluye 10 empleados. Te enviaremos un código de 6 dígitos a tu correo.
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Al crear una cuenta, aceptas los Términos de servicio y la Política de privacidad de{" "}
                {APP_NAME}.
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">
                  Atrás
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                  {isLoading ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-foreground font-medium hover:underline underline-offset-4">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
