// Two simple supporting flows: where you enter the profile from, and what
// you do after looking at it. Same aesthetic language as the profile.

function RosterEntry({ T, mode }) {
  // Mini-list — entry point. The "alert" players surface to the top.
  const players = [
    { num: 10, name: 'Tomás Silva', tier: 'Sub-17', pos: 'MED', state: 'alert', acwr: 1.82, focused: true },
    { num: 15, name: 'Ricardo Almeida', tier: 'Sub-19', pos: 'DEF', state: 'alert', acwr: 1.78 },
    { num: 11, name: 'Filipe Santos', tier: 'Sénior', pos: 'AVA', state: 'alert', acwr: 1.71 },
    { num: 34, name: 'Vicente Lima', tier: 'Sub-17', pos: 'AVA', state: 'alert', acwr: 1.66 },
    { num: 18, name: 'Manuel Lourenço', tier: 'Sub-17', pos: 'DEF', state: 'alert', acwr: 1.62 },
    { num: 5, name: 'Diogo Ferreira', tier: 'Sénior', pos: 'DEF', state: 'caution', acwr: 1.42 },
    { num: 39, name: 'Dinis Faria', tier: 'Sub-19', pos: 'AVA', state: 'caution', acwr: 1.40 },
    { num: 13, name: 'Hugo Martins', tier: 'Sénior', pos: 'DEF', state: 'caution', acwr: 1.38 },
  ];

  return (
    <div style={{
      width: 390, height: 844, background: T.bg, color: T.ink,
      fontFamily: PR_FONT.ui, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 44, padding: '14px 24px 0', display: 'flex',
        justifyContent: 'space-between', fontSize: 14, fontWeight: 600,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 16, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 14, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 24, height: 11, border: `1px solid ${T.ink}`, borderRadius: 2 }} />
        </span>
      </div>

      <div style={{ padding: '18px 22px 14px' }}>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>Sáb · 11 abr · 09:41</div>
        <div style={{
          fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em',
          marginTop: 4,
        }}>
          Plantel — <span style={{ color: T.alert }}>5 em alerta</span>
        </div>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 11, color: T.ink3, marginTop: 6,
        }}>{mode === 'match' ? 'Jogo às 16:00 · vs CD Estrela' : 'Treino às 18:30 · Tático'}</div>
      </div>

      <div style={{
        padding: '8px 22px', display: 'flex', gap: 6,
        borderBottom: `1px solid ${T.hairline}`, marginBottom: 4,
      }}>
        {['Alerta', 'Atenção', 'Pronto', 'Todos'].map((l, i) => (
          <span key={l} style={{
            padding: '6px 12px', borderRadius: 999,
            background: i === 0 ? T.ink : 'transparent',
            color: i === 0 ? T.bg : T.ink3,
            fontFamily: PR_FONT.mono, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: i === 0 ? 600 : 400,
            border: i === 0 ? 'none' : `1px solid ${T.hairline}`,
          }}>{l}</span>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {players.map((p, i) => (
          <div key={p.num} style={{
            padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: `1px solid ${T.hairline}`,
            background: p.focused ? T.surface : 'transparent',
            position: 'relative',
          }}>
            {p.focused && (
              <span style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: T.alert,
              }} />
            )}
            <div style={{
              width: 36, height: 36, borderRadius: 4, background: T.surface2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 16, color: T.ink2, flexShrink: 0,
            }}>{p.num}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 18, lineHeight: 1.1,
                color: p.focused ? T.ink : T.ink2,
              }}>{p.name}</div>
              <div style={{
                fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
                letterSpacing: '0.06em', marginTop: 2, textTransform: 'uppercase',
              }}>{p.tier} · {p.pos}</div>
            </div>
            <div style={{
              fontFamily: PR_FONT.mono, fontSize: 14,
              color: p.state === 'alert' ? T.alert : T.caution,
              fontVariantNumeric: 'tabular-nums',
            }}>{p.acwr.toFixed(2)}</div>
            <span style={{ color: T.ink3, fontSize: 14 }}>›</span>
          </div>
        ))}
      </div>

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

function DecisionSheet({ T, mode }) {
  return (
    <div style={{
      width: 390, height: 844, background: T.bg, color: T.ink,
      fontFamily: PR_FONT.ui, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 44, padding: '14px 24px 0', display: 'flex',
        justifyContent: 'space-between', fontSize: 14, fontWeight: 600,
      }}>
        <span>9:42</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 16, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 14, height: 10, background: T.ink, borderRadius: 1 }} />
          <span style={{ width: 24, height: 11, border: `1px solid ${T.ink}`, borderRadius: 2 }} />
        </span>
      </div>

      <div style={{
        padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.hairline}`,
      }}>
        <span style={{
          fontFamily: PR_FONT.mono, fontSize: 11, color: T.ink2,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>← Tomás Silva</span>
        <span style={{
          fontFamily: PR_FONT.mono, fontSize: 9.5, color: T.ink3,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>Decisão</span>
      </div>

      <div style={{ padding: '24px 22px 16px' }}>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
        }}>{mode === 'match' ? 'Convocatória · vs CD Estrela' : 'Sessão · 18:30 hoje'}</div>
        <div style={{
          fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em',
        }}>O que fazer com <span style={{ }}>o nº 10</span>?</div>
      </div>

      {/* The decision rec */}
      <div style={{
        margin: '0 22px', padding: '18px 20px',
        background: T.alertBg, border: `1px solid ${T.alert}33`,
      }}>
        <Eyebrow T={T}>Recomendação do sistema</Eyebrow>
        <div style={{
          fontFamily: PR_FONT.display, fontWeight: 600, fontSize: 26, color: T.alertInk, lineHeight: 1.15, marginTop: 10,
        }}>
          {mode === 'match'
            ? 'Suplente. Limitar a 30 minutos.'
            : 'Sessão de recuperação. Sem alta intensidade.'}
        </div>
        <div style={{
          fontFamily: PR_FONT.mono, fontSize: 10, color: T.ink3,
          letterSpacing: '0.04em', marginTop: 10,
        }}>
          ACWR 1.82 · zona alerta · 5 dias para recuperar de carga pesada.
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: '22px', flex: 1 }}>
        <Eyebrow T={T} style={{ marginBottom: 12 }}>Opções</Eyebrow>
        {[
          { label: mode === 'match' ? 'Aceitar — suplente' : 'Aceitar — recuperação', desc: 'Aplica recomendação do sistema', primary: true },
          { label: mode === 'match' ? 'Convocar como titular' : 'Manter intensidade plena', desc: 'Sobrepor recomendação' },
          { label: 'Marcar como dispensado', desc: 'Não convocar / não treinar' },
          { label: 'Conversar com o jogador', desc: 'Notificar Tomás antes de decidir' },
        ].map((o, i) => (
          <button key={o.label} style={{
            width: '100%', textAlign: 'left',
            padding: '14px 16px', marginBottom: 8,
            background: o.primary ? T.ink : T.surface,
            color: o.primary ? T.bg : T.ink,
            border: o.primary ? 'none' : `1px solid ${T.hairline}`,
            borderRadius: 4, cursor: 'pointer', fontFamily: PR_FONT.ui,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontFamily: PR_FONT.display, fontWeight: 500, fontSize: 18,
                fontStyle: o.primary ? 'normal' : 'italic',
              }}>{o.label}</div>
              <div style={{
                fontFamily: PR_FONT.mono, fontSize: 9.5,
                color: o.primary ? `${T.bg}99` : T.ink3,
                letterSpacing: '0.04em', marginTop: 2,
              }}>{o.desc}</div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.6 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

window.RosterEntry = RosterEntry;
window.DecisionSheet = DecisionSheet;
