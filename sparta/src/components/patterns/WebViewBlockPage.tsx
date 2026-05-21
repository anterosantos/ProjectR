import { ExternalLink } from "lucide-react";
import { CopyLinkButton } from "./CopyLinkButton";

export function WebViewBlockPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background text-foreground"
      role="main"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <ExternalLink
          className="h-12 w-12 text-signal-alert"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">
            Abre o SPARTA no teu browser principal
          </h1>
          <p className="text-sm text-muted-foreground">
            Estás a usar esta aplicação dentro de outro programa. Para funcionar
            corretamente, precisas de a abrir no teu browser.
          </p>
        </div>

        <CopyLinkButton />

        <div className="w-full flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">iOS</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Toca nos três pontos (···) no canto superior direito</li>
              <li>Escolhe &quot;Abrir no Safari&quot;</li>
            </ol>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Android</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Toca nos três pontos (⋮) no canto superior direito</li>
              <li>Escolhe &quot;Abrir no Chrome&quot;</li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
