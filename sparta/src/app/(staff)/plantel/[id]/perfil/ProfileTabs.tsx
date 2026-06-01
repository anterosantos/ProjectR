"use client";

import { useState, useEffect } from "react";
import { FadigaTab } from "./FadigaTab";
import { CargaAcwrTab } from "./CargaAcwrTab";
import { MetricasFisicasTab } from "./MetricasFisicasTab";
import { PresencasTab } from "./PresencasTab";
import { EstatisticasTab } from "./EstatisticasTab";
import { DecisoesTab } from "./DecisoesTab";
import { RecuperacaoTab } from "./RecuperacaoTab";

type TabId = "fadiga" | "acwr" | "fisicas" | "presencas" | "estatisticas" | "decisoes" | "recuperacao";

const TABS: { id: TabId; label: string }[] = [
  { id: "fadiga", label: "Fadiga" },
  { id: "acwr", label: "Carga & ACWR" },
  { id: "fisicas", label: "Métricas físicas" },
  { id: "presencas", label: "Presenças" },
  { id: "estatisticas", label: "Estatísticas" },
  { id: "decisoes", label: "Decisões data-driven" },
  { id: "recuperacao", label: "Recuperação" },
];

const storageKey = (playerId: string) => `sparta-profile-tab-${playerId}`;

interface ProfileTabsProps {
  playerId: string;
  isCumulative: boolean;
}

export function ProfileTabs({ playerId, isCumulative }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("fadiga");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey(playerId));
      if (stored && TABS.some((t) => t.id === stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(stored as TabId);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [playerId]);

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    try {
      sessionStorage.setItem(storageKey(playerId), tab);
    } catch {
      // sessionStorage unavailable
    }
  }

  return (
    <div>
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Secções do perfil do jogador"
        className="flex gap-0.5 overflow-x-auto pb-0 border-b border-border mb-6"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`profile-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`profile-panel-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — lazy loading: only active panel is rendered */}
      <div
        id="profile-panel-fadiga"
        role="tabpanel"
        aria-labelledby="profile-tab-fadiga"
        hidden={activeTab !== "fadiga"}
      >
        {activeTab === "fadiga" && <FadigaTab playerId={playerId} isCumulative={isCumulative} />}
      </div>

      <div
        id="profile-panel-acwr"
        role="tabpanel"
        aria-labelledby="profile-tab-acwr"
        hidden={activeTab !== "acwr"}
      >
        {activeTab === "acwr" && <CargaAcwrTab playerId={playerId} isCumulative={isCumulative} />}
      </div>

      <div
        id="profile-panel-fisicas"
        role="tabpanel"
        aria-labelledby="profile-tab-fisicas"
        hidden={activeTab !== "fisicas"}
      >
        {activeTab === "fisicas" && <MetricasFisicasTab playerId={playerId} isCumulative={isCumulative} />}
      </div>

      <div
        id="profile-panel-presencas"
        role="tabpanel"
        aria-labelledby="profile-tab-presencas"
        hidden={activeTab !== "presencas"}
      >
        {activeTab === "presencas" && <PresencasTab playerId={playerId} />}
      </div>

      <div
        id="profile-panel-estatisticas"
        role="tabpanel"
        aria-labelledby="profile-tab-estatisticas"
        hidden={activeTab !== "estatisticas"}
      >
        {activeTab === "estatisticas" && <EstatisticasTab playerId={playerId} isCumulative={isCumulative} />}
      </div>

      <div
        id="profile-panel-decisoes"
        role="tabpanel"
        aria-labelledby="profile-tab-decisoes"
        hidden={activeTab !== "decisoes"}
      >
        {activeTab === "decisoes" && <DecisoesTab playerId={playerId} />}
      </div>

      <div
        id="profile-panel-recuperacao"
        role="tabpanel"
        aria-labelledby="profile-tab-recuperacao"
        hidden={activeTab !== "recuperacao"}
      >
        {activeTab === "recuperacao" && <RecuperacaoTab playerId={playerId} />}
      </div>
    </div>
  );
}
