import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/actions/seasons";
import { SessionForm } from "@/app/(staff)/calendario/session-form";

export const metadata = { title: "Nova sessão" };

export default async function NovaSessionPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "coach") {
    redirect("/calendario");
  }

  const seasonResult = await getCurrentSeason();
  const hasSeason = seasonResult.ok && seasonResult.data !== null;

  return (
    <main id="main-content">
      <div className="px-4 py-6 sm:px-6">
        <SessionForm mode="create" hasSeason={hasSeason} />
      </div>
    </main>
  );
}
