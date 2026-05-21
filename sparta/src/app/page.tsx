import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login");
  }

  // Get user role to determine default redirect
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

    // Redirect based on role
    if (role === "player") {
      redirect("/hoje");
    } else if (role === "coach") {
      redirect("/prontidao");
    } else if (role === "analyst") {
      redirect("/sessoes");
    }
  } catch {
    // Database error or missing profile; redirect to login
    redirect("/login");
  }

  // Fallback to login if role is not recognized
  redirect("/login");
}
