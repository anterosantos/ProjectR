import { redirect } from "next/navigation";

export const metadata = {
  title: "Tendências",
};

export default function TendenciasPage() {
  redirect("/tendencias/fadiga");
}
