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
  const result = await getPlayer(id);
  if (!result.ok) notFound();

  const player = result.data;

  return <EditPlayerForm player={player} />;
}
