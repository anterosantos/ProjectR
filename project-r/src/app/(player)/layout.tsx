import { BottomTabNav } from "@/components/patterns/BottomTabNav";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PlayerLayout({
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

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-[60px]">{children}</main>
      <BottomTabNav role="player" />
    </div>
  );
}
