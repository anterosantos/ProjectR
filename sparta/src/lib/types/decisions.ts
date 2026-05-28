export type DecisionKind =
  | "roster"
  | "management"
  | "load_adjustment"
  | "rest"
  | "other";

export const DECISION_KIND_LABELS: Record<DecisionKind, string> = {
  roster: "Convocatória",
  management: "Gestão do jogador",
  load_adjustment: "Ajuste de carga",
  rest: "Descanso",
  other: "Outra",
};

export const DECISION_KINDS = Object.keys(
  DECISION_KIND_LABELS
) as DecisionKind[];

export type DataDecision = {
  id: string;
  decisionKind: DecisionKind;
  note: string | null;
  wasDataDriven: boolean;
  createdAt: string;
  actorId: string;
};

export type SaveDecisionInput = {
  playerId: string;
  sessionId?: string | null;
  decisionKind: DecisionKind;
  note?: string | null;
  wasDataDriven?: boolean;
};

export type MonthlyKpiRow = {
  month: string;
  total: number;
  byKind: Partial<Record<DecisionKind, number>>;
};
