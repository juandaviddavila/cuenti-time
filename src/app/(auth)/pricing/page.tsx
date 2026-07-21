import { getServerSession } from "@/lib/server-auth";
import { PricingClient } from "./pricing-client";

export default async function PricingPage() {
  const session = await getServerSession();
  return <PricingClient isLoggedIn={Boolean(session?.companyId)} />;
}
