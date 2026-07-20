import { getServerSession } from "@/lib/server-auth";
import { getWompiPublicKey } from "@/lib/wompi";
import { PricingClient } from "./pricing-client";

export default async function PricingPage() {
  const session = await getServerSession();
  const isLoggedIn = Boolean(
    session?.companyId && session.role !== "SAAS_SUPER_ADMIN"
  );

  return (
    <PricingClient
      isLoggedIn={isLoggedIn}
      wompiEnabled={Boolean(getWompiPublicKey())}
    />
  );
}
