import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/actions/players";
import { EditPlayerForm } from "./edit-player-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPlayer(id);
  if (!result.ok) return { title: "Editar Jogador" };
  return { title: `Editar — ${result.data.full_name}` };
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
