import Link from "next/link";
import { CreditCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SubscriptionExpiredPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-orange-500/30 bg-slate-900/90 text-white shadow-2xl shadow-orange-950/30">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Suscripción vencida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-slate-300">
            El periodo activo de tu empresa terminó. Para volver a usar cuenti time,
            renueva el servicio o actualiza el cupo de empleados.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
              <Link href="/pricing">
                <CreditCard className="h-4 w-4" /> Ver precios
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800">
              <Link href="/login">Cambiar de cuenta</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
