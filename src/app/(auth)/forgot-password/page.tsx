"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME, BRAND } from "@/lib/brand";

const schema = z.object({
  email: z.string().email("Correo inválido"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (_data: ForgotForm) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setIsLoading(false);
    toast.success("Correo enviado si la cuenta existe");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoSymbol} alt={APP_NAME} className="h-10 w-10 mx-auto" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Recuperar contraseña
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                placeholder="admin@empresa.com"
                className="h-11"
                {...register("email")}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-11">
              {isLoading ? "Enviando..." : "Enviar instrucciones"}
            </Button>
          </form>
        ) : (
          <div className="bg-muted/50 border border-border rounded-xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-foreground mx-auto" />
            <p className="text-foreground font-medium">Correo enviado</p>
            <p className="text-muted-foreground text-sm">
              Si tu correo está registrado, recibirás las instrucciones en los próximos minutos.
            </p>
          </div>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
