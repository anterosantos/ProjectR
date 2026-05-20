"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function submitConsentDecision(formData: FormData): Promise<void> {
  const token = formData.get("token") as string;
  const action = formData.get("action") as "confirm" | "withdraw";

  if (!token || !action) {
    redirect(`/consentimento/${token ?? ""}`);
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-real-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/consent-validate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ token, action, ip }),
      }
    );
  } catch (e) {
    console.error("[consent] consent-validate Edge Function failed:", e);
  }

  redirect(`/consentimento/${token}`);
}
