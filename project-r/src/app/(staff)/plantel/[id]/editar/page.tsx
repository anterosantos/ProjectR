import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getPlayer } from "@/lib/actions/players";

const EditPlayerForm = dynamic(() =>
  import("./edit-player-form").then(m => ({ default: m.EditPlayerForm }))
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
