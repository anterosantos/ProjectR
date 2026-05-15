import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MFASection } from "@/components/mfa/MFASection";

export default async function SegurancaPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? null;
  const email = user.email ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">
        Segurança da Conta
      </h1>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Informações da Conta
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Email</p>
          <p className="font-medium text-gray-900">{email}</p>
        </div>
      </section>

      {role !== "player" ? (
        <MFASection />
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Autenticação Multi-Fator (MFA)
          </h2>
          <p className="text-sm text-gray-500">
            O MFA não está disponível para jogadores.
          </p>
        </section>
      )}
    </div>
  );
}
