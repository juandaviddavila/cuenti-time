import { redirect } from "next/navigation";

export default function LegacyApiTokensPage() {
  redirect("/settings/integrations/api-tokens");
}
