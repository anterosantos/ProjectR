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

  let staffRole!: "coach" | "analyst";
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      redirect("/login");
    }

    const role = profile.role;

    if (!role || role === "player") {
      redirect("/hoje");
    }

    staffRole = role as "coach" | "analyst";
  } catch {
    // Database error or missing profile; redirect to login
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StaffSidebar role={staffRole} />
      <div className="flex flex-1 flex-col">
        <StickyHeader title="Painel" meta="Sáb 16:00" />
        <main id="main-content" className="flex-1 pb-[60px] lg:pb-0">{children}</main>
        <BottomTabNav role={staffRole} />
      </div>
    </div>
  );
}
