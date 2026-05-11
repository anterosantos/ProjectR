// Variation A — Editorial Dossier
// iPhone 390×844. Inspired by sport-magazine feature spreads:
// big serif name across two lines, small-caps eyebrow markers,
// hairline rules, mono numerics. Optimized for José the head coach
// reading the file like a scout report.

function ProfileMobileA({ T, persona, mode }) {
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
        fontFamily: PR_FONT.ui, fontSize: 14, fontWeight: 600, color: T.ink,
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

      {/* nav row */}
      <div style={{
        padding: '14px 22px 0', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{
          background: 'transparent', border: 'none', color: T.ink2,
          fontFamily: PR_FONT.mono, fontSize: 11, letterSpacing: '0.1em',
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          <span>←</span> Plantel
        </button>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.14em',
          color: T.ink3, textTransform: 'uppercase',
        }}>Dossier · 25/26</div>
        <button style={{
          background: 'transparent', border: 'none', color: T.ink2,
          fontFamily: PR_FONT.mono, fontSize: 16, padding: 0, lineHeight: 1,
        }}>···</button>
      </div>

      {/* SCROLL CONTENT */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '18px 22px 0' }}>
        {/* HEADER: jersey number + name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, marginBottom: 16 }}>
          <div style={{
            fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 88, lineHeight: 0.85,
            color: T.ink, letterSpacing: '-0.04em', fontWeight: 400,
            flexShrink: 0, width: 90, paddingRight: 8,
          }}>
            {player.num}
          </div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 9.5, letterSpacing: '0.16em',
              color: T.ink3, textTransform: 'uppercase', marginBottom: 2,
            }}>
              {player.posPrimary} · {player.tier}
            </div>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 30, lineHeight: 1,
              color: T.ink, letterSpacing: '-0.02em', fontWeight: 400,
            }}>
              {player.nameFirst}
            </div>
            <div style={{
              fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 30, lineHeight: 1,
              color: T.ink, letterSpacing: '-0.02em', marginBottom: 8,
            }}>
              {player.nameLast}
            </div>
            <StatusPill T={T} state={player.state}>{isPlayer ? 'Em recuperação' : 'Não pronto'}</StatusPill>
          </div>
        </div>

        <Rule T={T} style={{ marginBottom: 14 }} />

        {/* CONTEXT BAND: match-day / training-day */}
        <div style={{
          padding: '10px 12px', marginBottom: 16,
          background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 9, letterSpacing: '0.14em',
              color: T.ink3, textTransform: 'uppercase', marginBottom: 3,
            }}>
              {isMatch ? 'Próximo jogo' : 'Próximo treino'}
            </div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 500, letterSpacing: '-0.005em' }}>
              {isMatch ? `vs ${NEXT_MATCH.opponent}` : NEXT_TRAINING.type}
            </div>
            <div style={{ fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3, marginTop: 2 }}>
              {isMatch ? `${NEXT_MATCH.date} · ${NEXT_MATCH.time}` : `${NEXT_TRAINING.date} · ${NEXT_TRAINING.time}`}
            </div>
          </div>
          {!isPlayer && (
            <button style={{
              padding: '8px 14px', borderRadius: 999,
              background: T.ink, color: T.bg, border: 'none',
              fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500,
            }}>
              {isMatch ? 'Convocar' : 'Ajustar carga'}
            </button>
          )}
        </div>

        {/* ACWR row */}
        {!isPlayer && (
          <>
            <Eyebrow T={T} style={{ marginBottom: 10 }}>Carga · ACWR 7/28</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 56, lineHeight: 1,
                color: T.alert, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
              }}>
                {player.acwr.toFixed(2)}
              </div>
              <div style={{ flex: 1 }}>
                {/* horizontal zone bar */}
                <div style={{
                  height: 8, borderRadius: 999, position: 'relative',
                  background: `linear-gradient(90deg,
                    ${T.ink4} 0%, ${T.ink4} 25%,
                    ${T.ready} 25%, ${T.ready} 56%,
                    ${T.caution} 56%, ${T.caution} 69%,
                    ${T.alert} 69%, ${T.alert} 100%)`,
                  marginBottom: 6,
                }}>
                  <div style={{
                    position: 'absolute',
                    left: `${((player.acwr - 0.4) / 1.6) * 100}%`,
                    top: -3, width: 2, height: 14, background: T.ink,
                    transform: 'translateX(-1px)',
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: PR_FONT.mono, fontSize: 8.5, color: T.ink3, letterSpacing: '0.06em',
                }}>
                  <span>0.4</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span>
                </div>
                <div style={{
                  fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.alertInk,
                  marginTop: 6, letterSpacing: '0.04em',
                }}>
                  +5–7× risco lesão · zona vermelha
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
              <Datum T={T} value={player.acwrAcute} unit="au" label="Aguda · 7d" valueSize={16} />
              <Rule T={T} vertical />
              <Datum T={T} value={player.acwrChronic} unit="au" label="Crónica · 28d" valueSize={16} />
              <Rule T={T} vertical />
              <Datum T={T} value="+82" unit="%" label="Δ vs equipa" color={T.alert} valueSize={16} />
            </div>
          </>
        )}

        <Rule T={T} style={{ marginBottom: 14 }} />

        {/* Fatigue trend */}
        <Eyebrow T={T} style={{ marginBottom: 10 }}>
          {isPlayer ? 'A tua semana' : 'Fadiga · últimas 14 sessões'}
        </Eyebrow>
        <div style={{ marginBottom: 6 }}>
          <TrendLine T={T} data={player.fatigue14} w={346} h={48} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3,
          letterSpacing: '0.06em', marginBottom: 18,
        }}>
          <span>2 abr</span>
          <span>9 abr</span>
        </div>

        {/* 5 dimensions */}
        <Eyebrow T={T} style={{ marginBottom: 10 }}>Último questionário · 09 abr 20:14</Eyebrow>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16,
        }}>
          {[
            { k: 'energia', l: 'Energ.' },
            { k: 'foco', l: 'Foco' },
            { k: 'sono', l: 'Sono' },
            { k: 'dor', l: 'Dor' },
            { k: 'animo', l: 'Ânimo' },
          ].map((d) => {
            const v = player.q5[d.k];
            const c = v <= 2 ? T.alert : v <= 3 ? T.caution : T.ready;
            return (
              <div key={d.k} style={{
                padding: '10px 4px 8px', textAlign: 'center',
                border: `1px solid ${T.hairline}`, borderRadius: 3,
                background: T.surface,
              }}>
                <div style={{
                  fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 22, lineHeight: 1,
                  color: c, }}>{v}</div>
                <div style={{
                  fontFamily: PR_FONT.mono, fontSize: 8, letterSpacing: '0.1em',
                  color: T.ink3, textTransform: 'uppercase', marginTop: 4,
                }}>{d.l}</div>
              </div>
            );
          })}
        </div>

        {/* Coach note (only when not player) */}
        {!isPlayer && (
          <>
            <Eyebrow T={T} style={{ marginBottom: 8 }}>Nota equipa técnica</Eyebrow>
            <div style={{
              padding: '12px 14px', borderLeft: `2px solid ${T.ink}`,
              background: T.surface, marginBottom: 18,
              fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 15, lineHeight: 1.4, color: T.ink,
            }}>
              {`"${player.notes}"`}
            </div>
          </>
        )}

        {/* Stats grid */}
        {!isPlayer && (
          <>
            <Eyebrow T={T} style={{ marginBottom: 10 }}>Estatísticas · época {player.career[2].season}</Eyebrow>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px 0', marginBottom: 18,
            }}>
              <Datum T={T} value={player.matchesSeason} label="Jogos" />
              <Datum T={T} value={player.minutesSeason} label="Min." />
              <Datum T={T} value={player.goalsSeason} label="Golos" />
              <Datum T={T} value={player.assistsSeason} label="Assist." />
            </div>
          </>
        )}

        <div style={{ height: 60 }} />
      </div>

      {/* Tab bar */}
      <div style={{
        height: 88, padding: '10px 0 24px',
        background: T.surface, borderTop: `1px solid ${T.hairline}`,
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start',
      }}>
        {[
          { l: 'Prontidão', a: false },
          { l: 'Calendário', a: false },
          { l: 'Plantel', a: true },
          { l: 'Eu', a: false },
        ].map((t) => (
          <div key={t.l} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: t.a ? T.ink : T.ink3,
          }}>
            <div style={{ width: 4, height: 4, background: t.a ? T.ink : 'transparent', borderRadius: 999 }} />
            <span style={{
              fontFamily: PR_FONT.mono, fontSize: 9, letterSpacing: '0.14em',
              textTransform: 'uppercase', fontWeight: t.a ? 600 : 400,
            }}>{t.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ProfileMobileA = ProfileMobileA;
