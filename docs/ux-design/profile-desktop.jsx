// Desktop Player Profile — Analyst Dashboard
// 1440 wide editorial layout. Treats the player like a dossier / scouting report.
// Four-column masthead, hero banner with serif name, then a 12-col grid of cards.

function ProfileDesktop({ T, persona, mode }) {
  const player = TOMAS;
  const isMatch = mode === 'match';
  const isAna = persona === 'ana';
  const W = 1440;

  return (
    <div style={{
      width: W, background: T.bg, color: T.ink,
      fontFamily: PR_FONT.ui, position: 'relative',
    }}>

      {/* ── Masthead ── */}
      <div style={{
        padding: '20px 56px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.hairlineStrong}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 28, height: 28, border: `1.5px solid ${T.ink}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 16, }}>R</div>
          <div style={{
            fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 22, lineHeight: 1,
            letterSpacing: '-0.01em',
          }}>Project R</div>
          <span style={{
            fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingLeft: 16, borderLeft: `1px solid ${T.hairline}`,
          }}>Plantel · Perfil</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {['Painel', 'Plantel', 'Calendário', 'Análise', 'Equipa'].map((l, i) => (
            <span key={l} style={{
              fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: i === 1 ? T.ink : T.ink3,
              fontWeight: i === 1 ? 600 : 400,
              borderBottom: i === 1 ? `1.5px solid ${T.ink}` : 'none', paddingBottom: 4,
            }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{
            fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>{isAna ? 'Ana Costa · Analista' : (persona === 'tomas' ? 'Tomás Silva · Atleta' : 'José Almeida · Treinador')}</span>
          <Avatar T={T} player={{ fullName: isAna ? 'Ana Costa' : (persona === 'tomas' ? 'Tomás Silva' : 'José Almeida') }} size={28} radius={999} />
        </div>
      </div>

      {/* ── Breadcrumb / context ── */}
      <div style={{
        padding: '14px 56px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: `1px solid ${T.hairline}`,
      }}>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>Plantel</span>
          <span style={{ color: T.ink4 }}>/</span>
          <span>Sub-17</span>
          <span style={{ color: T.ink4 }}>/</span>
          <span style={{ color: T.ink, fontWeight: 600 }}>#10 Tomás Silva</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['‹ Anterior', '#10 / 41', 'Próximo ›'].map((l, i) => (
            <button key={l} style={{
              background: i === 1 ? T.surface : 'transparent',
              border: `1px solid ${T.hairline}`,
              padding: '6px 12px', borderRadius: 3,
              fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.1em',
              color: T.ink2, cursor: 'pointer', textTransform: 'uppercase',
            }}>{l}</button>
          ))}
          <button style={{
            background: T.ink, color: T.bg, border: 'none',
            padding: '6px 14px', borderRadius: 3,
            fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.12em',
            cursor: 'pointer', textTransform: 'uppercase', fontWeight: 500,
          }}>Exportar PDF</button>
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{
        padding: '36px 56px 28px', display: 'grid',
        gridTemplateColumns: '120px 1fr 360px', gap: 36, alignItems: 'flex-start',
        background: player.state === 'alert' ?
          `linear-gradient(180deg, ${T.alertBg} 0%, transparent 100%)` : T.bg,
      }}>
        <Avatar T={T} player={player} size={120} radius={4} />

        <div>
          <div style={{
            fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
            letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8,
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <span>Nº {player.num}</span>
            <span style={{ width: 1, height: 10, background: T.hairlineStrong }} />
            <span>{player.posPrimaryFull}</span>
            <span style={{ width: 1, height: 10, background: T.hairlineStrong }} />
            <span>{player.tier}</span>
            <span style={{ width: 1, height: 10, background: T.hairlineStrong }} />
            <span>{player.age} anos</span>
          </div>
          <div style={{
            fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 64, lineHeight: 1,
            letterSpacing: '-0.03em', color: T.ink,
          }}>
            {player.nameFirst}<br/>
            <span style={{ }}>{player.nameLast}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 18, alignItems: 'center' }}>
            <StatusPill T={T} state={player.state} />
            <span style={{
              fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 18, color: T.alertInk, lineHeight: 1.2,
            }}>
              "{player.notes}"
            </span>
          </div>
        </div>

        {/* Hero metric strip — vertical */}
        <div style={{
          background: T.surface, border: `1px solid ${T.hairline}`,
          padding: '20px 24px',
        }}>
          <Eyebrow T={T} style={{ marginBottom: 14 }}>Sinal vital</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ACWRGauge T={T} value={player.acwr} size={150} />
            <div>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 56, lineHeight: 0.95,
                color: T.alert, fontVariantNumeric: 'tabular-nums',
              }}>{player.acwr.toFixed(2)}</div>
              <div style={{
                fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
                letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4,
              }}>ACWR · zona alerta</div>
            </div>
          </div>
          <Rule T={T} style={{ margin: '16px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Datum T={T} value={player.acwrAcute} unit="au" label="Carga aguda · 7d" valueSize={20} />
            <Datum T={T} value={player.acwrChronic} unit="au" label="Crónica · 28d" valueSize={20} />
          </div>
        </div>
      </div>

      {/* ── 12-col content grid ── */}
      <div style={{
        padding: '0 56px 64px',
        display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20,
      }}>

        {/* Identity / measurements — 3 cols */}
        <Card T={T} title="Identidade" cols={3}>
          <Field T={T} k="Nascido" v={player.born} />
          <Field T={T} k="Altura" v={`${player.height} cm`} />
          <Field T={T} k="Peso" v={`${player.weight} kg`} />
          <Field T={T} k="Pé" v={player.foot} />
          <Field T={T} k="Clube desde" v={player.joined} />
          <Field T={T} k="Lado preferido" v="Centro / direita" />
        </Card>

        {/* Position — 3 cols */}
        <Card T={T} title="Posição em campo" cols={3}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <PosDiagram T={T} primary={player.posPrimary} alt={player.posAlt} w={92} h={130} />
            <div>
              <Field T={T} k="Primária" v={player.posPrimary} />
              <Field T={T} k="Alternativas" v={player.posAlt.join(', ')} />
              <Field T={T} k="Esta época" v="14 / 14 jogos" />
            </div>
          </div>
        </Card>

        {/* Match / training context — 6 cols */}
        <Card T={T} title={isMatch ? 'Próximo jogo · convocatória' : 'Próxima sessão · plano'} cols={6}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 28, lineHeight: 1.05, }}>{isMatch ? `vs ${NEXT_MATCH.opponent}` : NEXT_TRAINING.type}</div>
              <div style={{
                fontFamily: PR_FONT.mono, fontSize: 11, color: T.ink3,
                letterSpacing: '0.06em', marginTop: 6,
              }}>
                {isMatch
                  ? `${NEXT_MATCH.competition} · ${NEXT_MATCH.date} · ${NEXT_MATCH.time}`
                  : `${NEXT_TRAINING.date} · ${NEXT_TRAINING.time} · ${NEXT_TRAINING.duration} min · ${NEXT_TRAINING.intensity}`}
              </div>
            </div>
            <div style={{
              padding: '14px 18px', borderLeft: `1px solid ${T.hairline}`,
              minWidth: 200,
            }}>
              <Eyebrow T={T} style={{ marginBottom: 8 }}>Recomendação</Eyebrow>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 22, color: T.alertInk, lineHeight: 1.2,
              }}>
                {isMatch ? 'Suplente, ≤30 min' : 'Sessão de recuperação'}
              </div>
              <div style={{
                fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
                letterSpacing: '0.06em', marginTop: 6,
              }}>
                {isMatch ? 'ACWR 1.82 indica risco. Limitar carga.' : 'Reduzir intensidade. Monitorizar fadiga.'}
              </div>
            </div>
            {!isAna && persona !== 'tomas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button style={btnPrimary(T)}>Aceitar</button>
                <button style={btnGhost(T)}>Substituir</button>
              </div>
            )}
          </div>
        </Card>

        {/* Load 14d — 6 cols */}
        <Card T={T} title="Carga · 14 dias" cols={6} right={<span style={{ fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3 }}>session-RPE × min</span>}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <Datum T={T} value={player.acwrAcute} unit="au" label="Total · 7d" valueSize={28} />
            <Datum T={T} value={Math.round(player.load14.reduce((a, b) => a + b, 0) / player.load14.filter((v) => v > 0).length)} unit="au" label="Médio / sessão" valueSize={28} />
            <div style={{ flex: 1 }}>
              <LoadSpark T={T} data={player.load14} w={360} h={62} color={T.ink2} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3, marginTop: 4,
              }}>
                <span>27 mar</span><span>3 abr</span><span>10 abr</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Fatigue radar — 6 cols */}
        <Card T={T} title="Fadiga · último questionário" cols={6} right={<span style={{ fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3 }}>Pós-treino · 9 abr 20:14</span>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <FatigueRadar T={T} q={player.q5} size={170} color={T.alert} />
            <div style={{ flex: 1 }}>
              {[
                { k: 'Energia muscular', v: player.q5.energia, lab: 'Esgotado / pleno' },
                { k: 'Concentração', v: player.q5.foco, lab: 'Disperso / focado' },
                { k: 'Sono', v: player.q5.sono, lab: 'Insónia / profundo' },
                { k: 'Desconforto', v: player.q5.dor, lab: 'Sem dor / forte' },
                { k: 'Estado emocional', v: player.q5.animo, lab: 'Em baixo / em cima' },
              ].map((d) => (
                <div key={d.k} style={{
                  display: 'grid', gridTemplateColumns: '120px 80px 1fr',
                  alignItems: 'center', gap: 12, padding: '6px 0',
                  borderBottom: `1px solid ${T.hairline}`,
                }}>
                  <div style={{
                    fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink2,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{d.k}</div>
                  <ScaleDots T={T} v={d.v} />
                  <div style={{ fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3 }}>{d.lab}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Trend 14d fatigue — 6 cols */}
        <Card T={T} title="Tendência de fadiga · 14d" cols={6}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <Datum T={T} value="4.6" label="Média 7d" valueSize={28} color={T.alert} />
            <Datum T={T} value="↑ 0.8" label="vs 14d antes" valueSize={28} color={T.alert} />
            <div style={{ flex: 1 }}>
              <TrendLine T={T} data={player.fatigue14} w={360} h={62} color={T.ink2} />
            </div>
          </div>
        </Card>

        {/* Calendar / attendance — 6 cols */}
        <Card T={T} title="Presenças · 8 semanas" cols={6}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Datum T={T} value={Math.round(player.attendance * 100)} unit="%" label="Presenças" valueSize={36} />
            <CalHeat T={T} cal={player.cal} cellSize={22} gap={4} />
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
              letterSpacing: '0.06em', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <Legend T={T} c={T.ink2} l="Treino" />
              <Legend T={T} c={T.accent} l="Jogo" />
              <Legend T={T} c={T.alert} l="Falta" />
              <Legend T={T} c={T.surface2} l="Descanso" />
            </div>
          </div>
        </Card>

        {/* Career stats — 12 cols */}
        <Card T={T} title="Carreira no clube" cols={12}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: PR_FONT.mono, fontSize: 12,
          }}>
            <thead>
              <tr style={{ color: T.ink3 }}>
                {['Época', 'Escalão', 'Jogos', 'Min', 'G', 'A', 'Min/jogo', 'YPC', 'Forma'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 0',
                    borderBottom: `1px solid ${T.hairlineStrong}`,
                    fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {player.career.map((s, i) => (
                <tr key={s.season} style={{ color: T.ink }}>
                  <td style={tdStyle(T, i === player.career.length - 1)}>
                    <span style={{ fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 16 }}>{s.season}</span>
                  </td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.tier}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.m}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.min.toLocaleString()}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.g}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.a}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{Math.round(s.min / s.m)}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>{s.ypc}</td>
                  <td style={tdStyle(T, i === player.career.length - 1)}>
                    <BarMini T={T} v={i === 0 ? 0.65 : i === 1 ? 0.78 : 0.82} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Pitch stats — 6 cols */}
        <Card T={T} title="Por 90 min · esta época" cols={6}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {[
              { l: 'Passes', v: player.pitch.passes },
              { l: 'Recuperações', v: player.pitch.recuperacoes },
              { l: 'Pressões', v: player.pitch.pressoes },
              { l: 'Remates', v: player.pitch.remates },
              { l: 'Rem. enquadr.', v: player.pitch.remEnq },
              { l: 'Perdas', v: player.pitch.perdas },
              { l: 'Acç. defensivas OK', v: player.pitch.defOk },
              { l: 'Acç. ofensivas OK', v: player.pitch.ofeOk },
            ].map((d) => (
              <Datum key={d.l} T={T} value={d.v.toFixed(1)} label={d.l} valueSize={22} />
            ))}
          </div>
        </Card>

        {/* Recovery curve — 6 cols */}
        <Card T={T} title="Curva de recuperação · após sessão pesada" cols={6}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '8px 0' }}>
            {player.recovery.map((v, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: 6,
                }}>
                  <div style={{
                    height: `${(v / 5) * 100}%`,
                    background: v >= 5 ? T.alert : v >= 4 ? T.caution : T.ready,
                  }} />
                </div>
                <div style={{
                  fontFamily: PR_FONT.mono, fontSize: 9, color: T.ink3,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>D+{i}</div>
                <div style={{
                  fontFamily: PR_FONT.mono, fontSize: 11, color: T.ink, marginTop: 2,
                }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{
            fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
            letterSpacing: '0.06em', marginTop: 8, }}>
            Recupera lentamente — 5 dias para baixar abaixo de 4. Atenção a blocos consecutivos.
          </div>
        </Card>

      </div>
    </div>
  );
}

// ─── Sub-components for the desktop layout ───
function Card({ T, title, cols, right, children }) {
  return (
    <div style={{
      gridColumn: `span ${cols}`,
      background: T.surface,
      border: `1px solid ${T.hairline}`,
      padding: '20px 24px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <Eyebrow T={T}>{title}</Eyebrow>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ T, k, v }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: `1px solid ${T.hairline}`,
      fontFamily: PR_FONT.mono, fontSize: 11.5,
    }}>
      <span style={{
        color: T.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10,
      }}>{k}</span>
      <span style={{ color: T.ink, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function ScaleDots({ T, v }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: 999,
          background: i <= v ? (v <= 2 ? T.alert : v <= 3 ? T.caution : T.ready) : T.hairline,
        }} />
      ))}
    </div>
  );
}

function BarMini({ T, v }) {
  return (
    <div style={{
      width: 80, height: 6, background: T.hairline, borderRadius: 1, overflow: 'hidden',
    }}>
      <div style={{ width: `${v * 100}%`, height: '100%', background: T.ink }} />
    </div>
  );
}

function Legend({ T, c, l }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, background: c }} />
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</span>
    </div>
  );
}

function tdStyle(T, last) {
  return {
    padding: '12px 0',
    borderBottom: last ? 'none' : `1px solid ${T.hairline}`,
    fontFamily: PR_FONT.mono, fontVariantNumeric: 'tabular-nums',
  };
}

function btnPrimary(T) {
  return {
    background: T.ink, color: T.bg, border: 'none',
    padding: '8px 16px', borderRadius: 3, cursor: 'pointer',
    fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.14em',
    textTransform: 'uppercase', fontWeight: 500,
  };
}
function btnGhost(T) {
  return {
    background: 'transparent', color: T.ink, border: `1px solid ${T.hairlineStrong}`,
    padding: '8px 16px', borderRadius: 3, cursor: 'pointer',
    fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.14em',
    textTransform: 'uppercase', fontWeight: 500,
  };
}

window.ProfileDesktop = ProfileDesktop;
