"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { processConsentDecision } from "@/lib/actions/consent";

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
    await processConsentDecision(token, action, ip);
  } catch (e) {
    console.error("[consent] submitConsentDecision falhou:", e);
  }

  redirect(`/consentimento/${token}`);
}
