import { StickyHeader } from "@/components/patterns/StickyHeader";
import { StaffSidebar } from "@/components/patterns/StaffSidebar";
import { BottomTabNav } from "@/components/patterns/BottomTabNav";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StaffLayout({
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

  const role = profile?.role ?? null;

  if (!role || role === "player") {
    redirect("/hoje");
  }

  const staffRole = role as "coach" | "analyst";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StaffSidebar role={staffRole} />
      <div className="flex flex-1 flex-col">
        <StickyHeader title="Painel" meta="Sáb 16:00" />
        <main className="flex-1 pb-[60px] lg:pb-0">{children}</main>
        <BottomTabNav role={staffRole} />
      </div>
    </div>
  );
}
