import { AlertCircle } from "lucide-react";

// List of supported browsers shown to users
// IMPORTANT: Keep this list in sync with unsupported browser patterns in lib/pwa/webview-detection.ts
// When adding new browser support, update both lists
const SUPPORTED_BROWSERS = [
  "Chrome",
  "Safari",
  "Firefox",
  "Microsoft Edge",
  "Samsung Internet",
];

export function UnsupportedBrowserPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background text-foreground"
      role="main"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <AlertCircle
          className="h-12 w-12 text-signal-alert"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">
            Este site precisa de um browser moderno
          </h1>
          <p className="text-sm text-muted-foreground">
            O teu browser não é compatível com esta aplicação. Por favor, abre
            esta página num dos browsers abaixo:
          </p>
        </div>

        <ul className="w-full text-sm text-left list-disc list-inside space-y-1 text-foreground" aria-label="Browsers suportados">
          {SUPPORTED_BROWSERS.map((browser) => (
            <li key={browser}>{browser}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
