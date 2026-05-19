import { BottomTabNav } from "@/components/patterns/BottomTabNav";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ConfiguracoesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "player") as "player" | "coach" | "analyst";

  return (
    <div className="flex flex-col min-h-screen">
      <main id="main-content" className="flex-1 pb-[60px] lg:pb-0">
        {children}
      </main>
      <BottomTabNav role={role} />
    </div>
  );
}
