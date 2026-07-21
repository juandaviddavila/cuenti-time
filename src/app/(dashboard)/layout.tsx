import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-auth";
import { hasExpiredCompanySubscription } from "@/lib/subscription";
import { stringToBigint } from "@/lib/bigint";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (
    session?.companyId &&
    session.role !== "SAAS_SUPER_ADMIN" &&
    !session.isImpersonating &&
     await hasExpiredCompanySubscription(stringToBigint(session.companyId))
  ) {
    redirect("/subscription-expired");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background [height:100dvh]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ImpersonationBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 bg-muted/30">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
