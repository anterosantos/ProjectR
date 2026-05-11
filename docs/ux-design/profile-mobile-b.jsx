// Variation B — Performance Cockpit
// iPhone 390×844. More visual: ACWR gauge dial, fatigue radar, heatmap calendar,
// position diagram. Modular cards with semantic alert glow.

function ProfileMobileB({ T, persona, mode }) {
  const player = TOMAS;
  const isMatch = mode === 'match';
  const isPlayer = persona === 'tomas';

  return (
    <div style={{
      width: 390, height: 844, background: T.bg, color: T.ink,
      fontFamily: PR_FONT.ui, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* status bar */}
      <div style={{
        height: 44, padding: '14px 24px 0', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'space-between',
        fontSize: 14, fontWeight: 600, color: T.ink,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 16, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 14, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 24, height: 11, border: `1px solid ${T.ink}`, borderRadius: 2, padding: 1 }}>
            <span style={{ display: 'block', width: '85%', height: '100%', background: T.ink, borderRadius: 1 }} />
          </span>
        </span>
      </div>

      {/* HERO — alert state colors the top */}
      <div style={{
        padding: '18px 22px 22px',
        background: player.state === 'alert' ? `linear-gradient(180deg, ${T.alertBg} 0%, transparent 100%)` : T.bg,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button style={{
            background: 'transparent', border: 'none', color: T.ink2, padding: 0,
            fontFamily: PR_FONT.mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>← Plantel</button>
          <button style={{
            background: 'transparent', border: 'none', color: T.ink2, padding: 0,
            fontFamily: PR_FONT.mono, fontSize: 16,
          }}>···</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          <Avatar T={T} player={player} size={64} radius={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 26, lineHeight: 1,
              color: T.ink, letterSpacing: '-0.015em',
            }}>
              {player.fullName}
            </div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.12em',
              color: T.ink3, textTransform: 'uppercase', marginTop: 4, marginBottom: 8,
            }}>
              Nº {player.num} · {player.posPrimaryFull} · {player.tier}
            </div>
            <StatusPill T={T} state={player.state} size="sm" />
          </div>
        </div>

        {/* Hero metrics — 3 columns */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
        }}>
          <div style={{ padding: '12px 14px', borderRight: `1px solid ${T.hairline}` }}>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 26, lineHeight: 1,
              color: T.alert, fontVariantNumeric: 'tabular-nums',
            }}>{player.acwr.toFixed(2)}</div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 8.5, letterSpacing: '0.1em',
              color: T.ink3, textTransform: 'uppercase', marginTop: 4,
            }}>ACWR</div>
          </div>
          <div style={{ padding: '12px 14px', borderRight: `1px solid ${T.hairline}` }}>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 26, lineHeight: 1,
              color: T.ink, fontVariantNumeric: 'tabular-nums',
            }}>{Math.round(player.attendance * 100)}<span style={{ fontSize: 14, color: T.ink3 }}>%</span></div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 8.5, letterSpacing: '0.1em',
              color: T.ink3, textTransform: 'uppercase', marginTop: 4,
            }}>Presenças</div>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 26, lineHeight: 1,
              color: T.ink, fontVariantNumeric: 'tabular-nums',
            }}>{player.minutesSeason}</div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 8.5, letterSpacing: '0.1em',
              color: T.ink3, textTransform: 'uppercase', marginTop: 4,
            }}>Min · 25/26</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '0 22px' }}>

        {/* ACWR gauge card */}
        {!isPlayer && (
          <div style={{
            background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
            padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <Eyebrow T={T}>Carga aguda · crónica</Eyebrow>
              <div style={{ fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3 }}>7d / 28d</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ACWRGauge T={T} value={player.acwr} size={140} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3,
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
                }}>Recomendação</div>
                <div style={{
                  fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 16, color: T.alertInk, lineHeight: 1.25,
                }}>
                  Reduzir intensidade. Considerar gestão de minutos.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match-day / training-day decision card */}
        <div style={{
          background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <Eyebrow T={T}>{isMatch ? 'Próximo jogo' : 'Próxima sessão'}</Eyebrow>
              <div style={{ fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 18, marginTop: 2, lineHeight: 1.1 }}>
                {isMatch ? `vs ${NEXT_MATCH.opponent}` : NEXT_TRAINING.type}
              </div>
              <div style={{ fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3, marginTop: 3 }}>
                {isMatch ? `${NEXT_MATCH.date} · ${NEXT_MATCH.time}` : `${NEXT_TRAINING.date} · ${NEXT_TRAINING.time}`}
              </div>
            </div>
            {!isPlayer && (
              <button style={{
                padding: '10px 14px', borderRadius: 4,
                background: T.ink, color: T.bg, border: 'none',
                fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.12em',
                textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
              }}>{isMatch ? 'Decidir' : 'Adaptar'}</button>
            )}
          </div>
        </div>

        {/* Two-column: position + radar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
            padding: '12px 14px',
          }}>
            <Eyebrow T={T} style={{ marginBottom: 10 }}>Posição</Eyebrow>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <PosDiagram T={T} primary={player.posPrimary} alt={player.posAlt} w={70} h={92} />
            </div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3,
              textAlign: 'center', letterSpacing: '0.04em',
            }}>
              <div style={{ color: T.ink, fontWeight: 500 }}>{player.posPrimary}</div>
              <div style={{ marginTop: 2 }}>+ {player.posAlt.join(' · ')}</div>
            </div>
          </div>
          <div style={{
            background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
            padding: '12px 14px',
          }}>
            <Eyebrow T={T} style={{ marginBottom: 4 }}>Fadiga · 5 dim.</Eyebrow>
            <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
              <FatigueRadar T={T} q={player.q5} size={108} color={T.alert} />
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div style={{
          background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Eyebrow T={T}>Presenças · 8 semanas</Eyebrow>
            <div style={{ fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3 }}>
              {Math.round(player.attendance * 100)}%
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CalHeat T={T} cal={player.cal} cellSize={13} gap={3} />
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 10, justifyContent: 'center',
            fontFamily: PR_FONT.mono, fontSize: 8.5, color: T.ink3, letterSpacing: '0.04em',
          }}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, background: T.ink2 }} />Treino</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, background: T.accent }} />Jogo</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, background: T.alert }} />Falta</span>
          </div>
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* Tab bar */}
      <div style={{
        height: 88, padding: '10px 0 24px', flexShrink: 0,
        background: T.surface, borderTop: `1px solid ${T.hairline}`,
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
      }}>
        {['Prontidão', 'Calendário', 'Plantel', 'Eu'].map((l, i) => (
          <div key={l} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: i === 2 ? T.ink : T.ink3,
          }}>
            <div style={{ width: 4, height: 4, background: i === 2 ? T.ink : 'transparent', borderRadius: 999 }} />
            <span style={{
              fontFamily: PR_FONT.mono, fontSize: 9, letterSpacing: '0.14em',
              textTransform: 'uppercase', fontWeight: i === 2 ? 600 : 400,
            }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ProfileMobileB = ProfileMobileB;
