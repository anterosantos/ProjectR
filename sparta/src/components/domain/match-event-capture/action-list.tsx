"use client";

import { ActionButton } from "./action-button";
import { MATCH_ACTIONS } from "@/lib/schemas/match-events";
import { useMatchSession } from "@/lib/stores/match-session";

export function ActionList() {
  const setSelectedAction = useMatchSession((s) => s.setSelectedAction);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Selecione uma ação</h2>
      <div className="grid grid-cols-2 gap-4">
        {MATCH_ACTIONS.map((action) => (
          <ActionButton
            key={action}
            action={action}
            onClick={() => setSelectedAction(action)}
          />
        ))}
      </div>
    </div>
  );
}
