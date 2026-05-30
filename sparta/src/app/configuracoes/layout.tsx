import { BottomTabNav } from "@/components/patterns/BottomTabNav";
import { StaffSidebar } from "@/components/patterns/StaffSidebar";
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
  const isStaff = role === "coach" || role === "analyst";

  return (
    <div className="flex min-h-screen">
      {isStaff && <StaffSidebar role={role as "coach" | "analyst"} />}
      <div className={`flex flex-1 flex-col ${isStaff ? "lg:pl-64" : ""}`}>
        <main id="main-content" className="flex-1 pb-[60px] lg:pb-0">
          {children}
        </main>
        <BottomTabNav role={role} />
      </div>
    </div>
  );
}
