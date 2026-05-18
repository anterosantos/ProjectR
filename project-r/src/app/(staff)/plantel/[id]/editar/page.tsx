import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/actions/players";
import { EditPlayerForm } from "./edit-player-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Skip database call during build - use default title
  // Full name will be shown by the page component once loaded
  return { title: "Editar Jogador" };
}

export default async function EditarJogadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // During CI build without env vars, return early
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <div>Loading...</div>;
  }

  const result = await getPlayer(id);
  if (!result.ok) notFound();

  const player = result.data;

  return <EditPlayerForm player={player} />;
}
