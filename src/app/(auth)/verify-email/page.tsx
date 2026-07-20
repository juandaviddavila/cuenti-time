import { Suspense } from "react";
import { VerifyEmailForm } from "./verify-email-form";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Cargando...
          </div>
        }
      >
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
