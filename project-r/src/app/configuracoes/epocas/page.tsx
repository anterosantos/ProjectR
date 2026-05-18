import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSeasonsForClub } from "@/lib/actions/seasons";
import { StickyHeader } from "@/components/patterns/StickyHeader";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { SeasonsPageClient } from "./seasons-page-client";

export const metadata = { title: "Épocas" };

export default async function EpocasPage({
  searchParams,
}: {
  searchParams: Promise<{ criada?: string; actualizada?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["coach", "analyst"].includes(profile.role ?? "")) {
    redirect("/");
  }

  const result = await getSeasonsForClub();
  const seasons = result.ok ? result.data : [];

  const { criada, actualizada } = await searchParams;

  return (
    <main id="main-content">
      <StickyHeader title="Épocas" backHref="/configuracoes" />
      <div className="px-4 py-6 sm:px-6">
        {criada === "1" && <CalmConfirmation message="Época criada" />}
        {actualizada === "1" && (
          <CalmConfirmation message="Época actualizada" />
        )}
        <SeasonsPageClient seasons={seasons} />
      </div>
    </main>
  );
}
