import { getPendingConsentsOver14Days } from "@/lib/actions/consent";
import { ResendConsentButton } from "./resend-consent-button";

export async function PendingConsentsBanner() {
  const pending = await getPendingConsentsOver14Days();
  if (pending.length === 0) return null;

  const count = pending.length;

  return (
    <div
      role="alert"
      aria-label="Consentimentos parentais pendentes"
      className="mb-6 rounded-lg border border-signal-caution bg-signal-caution/10 px-4 py-3"
    >
      <p className="mb-3 text-sm font-semibold text-signal-caution-foreground">
        {count} jogador{count !== 1 ? "es" : ""} com consentimento parental por
        confirmar
      </p>
      <ul className="max-h-60 overflow-y-auto space-y-2">
        {pending.map((row) => (
          <li
            key={row.playerId}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-foreground">{row.playerName}</span>
            <ResendConsentButton playerId={row.playerId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
