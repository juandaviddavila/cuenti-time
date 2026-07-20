import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PricingSuccessPage({
  searchParams,
}: {
  searchParams: { reference?: string };
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-green-500/30 bg-slate-900/90 text-white">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Pago recibido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-slate-300">
            Tu pago está siendo confirmado. La suscripción se activará en cuanto Wompi
            confirme la transacción
            {searchParams.reference ? ` (${searchParams.reference})` : ""}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
              <Link href="/dashboard">Ir al panel</Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
              <Link href="/pricing">Volver a precios</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
