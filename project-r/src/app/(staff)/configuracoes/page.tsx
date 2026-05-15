import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ConfiguracoesPage() {
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Configurações</h1>

      <nav className="space-y-2" aria-label="Configurações de conta">
        {role !== "player" && (
          <Link
            href="/configuracoes/seguranca"
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>Segurança da Conta</span>
            <span className="text-gray-400" aria-hidden="true">
              →
            </span>
          </Link>
        )}
      </nav>
    </div>
  );
}
