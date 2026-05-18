import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import { getPlayer } from "@/lib/actions/players";

const EditPlayerForm = dynamicImport(() =>
  import("./edit-player-form").then(m => ({ default: m.EditPlayerForm })),
  { loading: () => <div className="p-4">Carregando...</div> }
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: "Editar Jogador" };
}

async function loadPlayer(id: string) {
  try {
    const result = await getPlayer(id);
    if (!result.ok) throw new Error("Not found");
    return result.data;
  } catch {
    return null;
  }
}

export default async function EditarJogadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const player = await loadPlayer(id);
  if (!player) notFound();

  return <EditPlayerForm player={player} />;
}
