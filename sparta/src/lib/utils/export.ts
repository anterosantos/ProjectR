import type { PlayerLoadData } from "@/lib/actions/load";
import type { SeasonView } from "@/hooks/useSeasonView";

function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  // Formula injection prevention
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportLoadCsv(players: PlayerLoadData[], view: SeasonView): void {
  if (players.length === 0) return;

  // Collect all months across all players
  const allMonthsSet = new Set<string>();
  for (const p of players) {
    const monthly = view === "current" ? p.currentSeasonMonthly : p.allTimeMonthly;
    for (const m of monthly) {
      allMonthsSet.add(m.month);
    }
  }
  const allMonths = Array.from(allMonthsSet).sort();

  // Build CSV header
  const headers = ["Nome", "Posição", "Escalão", "Carga Total", "Sessões", ...allMonths];
  const rows: string[][] = [headers];

  for (const p of players) {
    const load = view === "current" ? p.currentSeasonLoad : p.totalLoad;
    const sessions = view === "current" ? p.currentSeasonSessions : p.totalSessions;
    const monthly = view === "current" ? p.currentSeasonMonthly : p.allTimeMonthly;

    const monthMap = new Map<string, number>();
    for (const m of monthly) {
      monthMap.set(m.month, m.load);
    }

    // Note: Missing months are filled with 0 (intentional). If no data exists for a month, it represents zero load that month.
    const monthCols = allMonths.map((month) => String(monthMap.get(month) ?? 0));

    rows.push([
      escapeCSV(p.playerName),
      escapeCSV(p.position),
      escapeCSV(p.ageGroup),
      escapeCSV(load),
      escapeCSV(sessions),
      ...monthCols,
    ]);
  }

  const csvContent = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sparta-carga-${today}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
