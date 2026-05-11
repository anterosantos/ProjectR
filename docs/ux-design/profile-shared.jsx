// Shared tokens, data, and UI primitives for Project R · Player Profile mockups.
// Aesthetic: Editorial Performance Dossier — Instrument Serif display +
// Inter Tight UI + JetBrains Mono tabular numerics. Near-monochrome with
// semantic signal colors; warm off-white / deep ink themes.

const PR_TOKENS_LIGHT = {
  bg: '#FFFFFF',
  surface: '#FAFAFA',
  surface2: '#F5F5F5',
  ink: '#0A0A0A',
  ink2: '#525252',
  ink3: '#737373',
  ink4: '#A3A3A3',
  hairline: '#E5E5E5',
  hairlineStrong: '#D4D4D4',
  ready: '#16A34A',
  readyBg: '#F0FDF4',
  readyInk: '#166534',
  caution: '#CA8A04',
  cautionBg: '#FEFCE8',
  cautionInk: '#854D0E',
  alert: '#DC2626',
  alertBg: '#FEF2F2',
  alertInk: '#991B1B',
  accent: '#2563EB',
  field: '#10B981',
  fieldDeep: '#059669',
};

const PR_TOKENS_DARK = {
  bg: '#0A0A0A',
  surface: '#171717',
  surface2: '#262626',
  ink: '#FAFAFA',
  ink2: '#D4D4D4',
  ink3: '#A3A3A3',
  ink4: '#737373',
  hairline: '#262626',
  hairlineStrong: '#404040',
  ready: '#22C55E',
  readyBg: 'rgba(34,197,94,0.12)',
  readyInk: '#86EFAC',
  caution: '#EAB308',
  cautionBg: 'rgba(234,179,8,0.14)',
  cautionInk: '#FDE68A',
  alert: '#EF4444',
  alertBg: 'rgba(239,68,68,0.14)',
  alertInk: '#FCA5A5',
  accent: '#3B82F6',
  field: '#10B981',
  fieldDeep: '#059669',
};

const PR_FONT = {
  display: '"Inter Tight", "Inter", system-ui, sans-serif',
  ui: '"Inter Tight", "Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace',
};

// ─────────── Player data — based on the existing UX doc roster ───────────
const TOMAS = {
  num: 10,
  nameFirst: 'Tomás',
  nameLast: 'Silva',
  fullName: 'Tomás Silva',
  age: 16,
  born: '12 mar 2009',
  height: 178,
  weight: 68,
  foot: 'Direito',
  tier: 'Sub-17',
  posPrimary: 'MED',
  posPrimaryFull: 'Médio Centro',
  posAlt: ['MED-O', 'MED-D', 'AVA-E'],
  state: 'alert',
  acwr: 1.82,
  acwrZone: 'alert',
  acwrAcute: 412,  // au · last 7d
  acwrChronic: 226, // au · last 28d avg
  joined: '2023/2024',
  matchesCareer: 41,
  matchesSeason: 14,
  minutesSeason: 1147,
  goalsSeason: 4,
  assistsSeason: 7,
  attendance: 0.93,
  // last 14 days of session-RPE × duration (au) for sparkline
  load14: [180, 0, 220, 240, 0, 280, 360, 0, 320, 410, 0, 380, 460, 520],
  // last 14 days of fatigue 1–5 (post-session, 0 = no session)
  fatigue14: [3, 0, 3, 4, 0, 4, 4, 0, 4, 5, 0, 5, 5, 5],
  // 5 dimensions of last questionnaire (1-5, lower = worse)
  q5: { energia: 2, foco: 3, sono: 2, dor: 2, animo: 3 },
  // attendance grid — last 8 weeks × 7 days
  // values: 0 none · 1 trained · 2 match · -1 missed · -2 rest
  cal: [
    [-2, 1, 1, -1, 1, 1, 2],
    [-2, 1, 1, 1, 1, -2, 2],
    [-2, 1, 1, 1, 1, 1, 2],
    [-2, 1, 1, -1, 1, 1, 2],
    [-2, 1, 1, 1, 1, 1, 2],
    [-2, 1, 1, 1, 1, 1, 2],
    [-2, 1, 1, 1, 1, 1, 2],
    [-2, 1, 1, 1, 1, 1, 0],
  ],
  // career stats (per season)
  career: [
    { season: '23/24', tier: 'Sub-15', m: 22, min: 1480, g: 8, a: 11, ypc: 12.4 },
    { season: '24/25', tier: 'Sub-17', m: 19, min: 1390, g: 6, a: 9, ypc: 13.1 },
    { season: '25/26', tier: 'Sub-17', m: 14, min: 1147, g: 4, a: 7, ypc: 14.8 },
  ],
  // recovery curve — fatigue score days after a heavy session (most recent)
  recovery: [5, 5, 4, 4, 3, 3, 3],
  // pitch stats (per 90, season)
  pitch: {
    perdas: 8.4, recuperacoes: 6.1, remates: 1.9, remEnq: 0.7,
    passes: 38.2, pressoes: 14.6, defOk: 4.2, ofeOk: 3.1,
  },
  notes: 'Picos de fadiga após blocos de 3 sessões. Mantém intensidade mas atenção ao volume cumulativo.',
};

// Next match
const NEXT_MATCH = {
  opponent: 'CD Estrela',
  date: 'Sáb · 11 abr',
  time: '16:00',
  competition: 'Liga Distrital Sub-17',
  home: true,
};

// Next training
const NEXT_TRAINING = {
  type: 'Treino Tático',
  date: 'Hoje · 10 abr',
  time: '18:30',
  duration: 90,
  intensity: 'Médio-alto',
};

// ─────────── Primitive components ───────────

// Hairline — 0.5px-feel rule. Use for editorial separation.
function Rule({ T, vertical = false, style = {} }) {
  return (
    <div style={{
      background: T.hairline,
      ...(vertical ? { width: 1, alignSelf: 'stretch' } : { height: 1, width: '100%' }),
      ...style,
    }} />
  );
}

// Eyebrow — small-caps section marker with leading dash.
function Eyebrow({ T, children, style = {} }) {
  return (
    <div style={{
      fontFamily: PR_FONT.mono,
      fontSize: 9.5,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: T.ink3,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      ...style,
    }}>
      <span style={{ width: 12, height: 1, background: T.ink3 }} />
      {children}
    </div>
  );
}

// Mono datum — value + label stacked, tabular nums, optional unit.
function Datum({ T, value, unit, label, valueSize = 22, color, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, ...style }}>
      <div style={{
        fontFamily: PR_FONT.mono, fontWeight: 500,
        fontSize: valueSize, lineHeight: 1, letterSpacing: '-0.02em',
        color: color || T.ink, fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'baseline', gap: 3,
      }}>
        {value}
        {unit && <span style={{
          fontSize: Math.max(9, valueSize * 0.42),
          color: T.ink3, fontWeight: 400, letterSpacing: '0.04em',
        }}>{unit}</span>}
      </div>
      <div style={{
        fontFamily: PR_FONT.mono, fontSize: 8.5, letterSpacing: '0.12em',
        color: T.ink3, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

// Status badge — pill with dot, uses semantic colors.
function StatusPill({ T, state = 'ready', size = 'md', children }) {
  const map = {
    ready: { c: T.ready, bg: T.readyBg, ink: T.readyInk, label: 'Pronto' },
    caution: { c: T.caution, bg: T.cautionBg, ink: T.cautionInk, label: 'Atenção' },
    alert: { c: T.alert, bg: T.alertBg, ink: T.alertInk, label: 'Não pronto' },
  };
  const s = map[state];
  const sz = size === 'sm' ? { p: '3px 8px', fs: 10, dot: 5 } : { p: '5px 11px', fs: 11, dot: 6 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: sz.p, borderRadius: 999,
      background: s.bg, color: s.ink,
      border: `1px solid ${s.c}33`,
      fontFamily: PR_FONT.mono, fontSize: sz.fs, fontWeight: 500,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      <span style={{ width: sz.dot, height: sz.dot, borderRadius: 999, background: s.c }} />
      {children || s.label}
    </span>
  );
}

// Sparkline — load (au) over n days, draws bars + a line.
function LoadSpark({ T, data, w = 220, h = 36, color }) {
  const max = Math.max(...data, 1);
  const bw = w / data.length;
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 4);
        return (
          <rect
            key={i}
            x={i * bw + 1}
            y={h - bh}
            width={bw - 2}
            height={bh || 1}
            fill={v === 0 ? T.hairline : (color || T.ink2)}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// Trend line — fatigue 0–5 line chart with dots.
function TrendLine({ T, data, w = 220, h = 36, color }) {
  const xs = data.map((_, i) => (i / (data.length - 1)) * (w - 8) + 4);
  const ys = data.map((v) => h - 4 - ((v - 1) / 4) * (h - 8));
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${v === 0 ? h - 4 : ys[i]}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color || T.ink2} strokeWidth={1.2} />
      {data.map((v, i) => v > 0 && (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={2} fill={v >= 5 ? T.alert : v >= 4 ? T.caution : T.ready} />
      ))}
    </svg>
  );
}

// ACWR gauge — semicircle with zone bands and needle.
function ACWRGauge({ T, value = 1.82, size = 160 }) {
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2 + 4;
  // Map value 0.4..2.0 to angle -180..0
  const v = Math.max(0.4, Math.min(2.0, value));
  const angle = -180 + ((v - 0.4) / (2.0 - 0.4)) * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + Math.cos(rad) * r;
  const ny = cy + Math.sin(rad) * r;
  // Zone bounds in same scale
  const a = (val) => -180 + ((val - 0.4) / 1.6) * 180;
  const arcPath = (start, end, color) => {
    const s = (start * Math.PI) / 180, e = (end * Math.PI) / 180;
    const x1 = cx + Math.cos(s) * r, y1 = cy + Math.sin(s) * r;
    const x2 = cx + Math.cos(e) * r, y2 = cy + Math.sin(e) * r;
    const large = end - start > 180 ? 1 : 0;
    return <path d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`} fill="none" stroke={color} strokeWidth={6} strokeLinecap="butt" />;
  };
  return (
    <svg width={size} height={size / 2 + 24} style={{ overflow: 'visible', display: 'block' }}>
      {/* arcs */}
      {arcPath(-180, a(0.8), T.ink4)}
      {arcPath(a(0.8), a(1.3), T.ready)}
      {arcPath(a(1.3), a(1.5), T.caution)}
      {arcPath(a(1.5), 0, T.alert)}
      {/* tick marks */}
      {[0.8, 1.3, 1.5].map((tv) => {
        const ta = (a(tv) * Math.PI) / 180;
        const x1 = cx + Math.cos(ta) * (r - 6), y1 = cy + Math.sin(ta) * (r - 6);
        const x2 = cx + Math.cos(ta) * (r + 6), y2 = cy + Math.sin(ta) * (r + 6);
        return <line key={tv} x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.ink} strokeWidth={1} />;
      })}
      {[0.8, 1.3, 1.5].map((tv) => {
        const ta = (a(tv) * Math.PI) / 180;
        const lx = cx + Math.cos(ta) * (r + 16);
        const ly = cy + Math.sin(ta) * (r + 16) + 3;
        return <text key={`l${tv}`} x={lx} y={ly} fontFamily={PR_FONT.mono} fontSize={9}
                     fill={T.ink3} textAnchor="middle">{tv.toFixed(1)}</text>;
      })}
      {/* needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={T.ink} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={T.ink} />
    </svg>
  );
}

// 5-dimension fatigue radar
function FatigueRadar({ T, q, size = 140, color }) {
  const dims = [
    { key: 'energia', label: 'Energ.' },
    { key: 'foco', label: 'Foco' },
    { key: 'sono', label: 'Sono' },
    { key: 'dor', label: 'Dor' },
    { key: 'animo', label: 'Ânimo' },
  ];
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 18;
  const angle = (i) => -Math.PI / 2 + (i / dims.length) * Math.PI * 2;
  const point = (i, v) => {
    const a = angle(i);
    const rr = (v / 5) * r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };
  const ringPath = (v) =>
    dims.map((_, i) => {
      const [x, y] = point(i, v);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ') + ' Z';
  const data = dims.map((d, i) => point(i, q[d.key]));
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <path key={v} d={ringPath(v)} fill="none" stroke={T.hairline} strokeWidth={0.8} />
      ))}
      {dims.map((d, i) => {
        const [x, y] = point(i, 5);
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke={T.hairline} strokeWidth={0.8} />;
      })}
      <path
        d={data.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z'}
        fill={(color || T.ink2) + '22'}
        stroke={color || T.ink}
        strokeWidth={1.2}
      />
      {data.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill={color || T.ink} />
      ))}
      {dims.map((d, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 12);
        const ly = cy + Math.sin(a) * (r + 12) + 3;
        return <text key={d.key} x={lx} y={ly} fontFamily={PR_FONT.mono} fontSize={8.5}
                     fill={T.ink3} textAnchor="middle" letterSpacing={1}>{d.label.toUpperCase()}</text>;
      })}
    </svg>
  );
}

// Player monogram avatar — placeholder; striped fill + initials.
function Avatar({ T, player, size = 44, radius = 999 }) {
  const initials = player.fullName.split(' ').map((s) => s[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: `repeating-linear-gradient(45deg, ${T.surface2}, ${T.surface2} 4px, ${T.bg} 4px, ${T.bg} 8px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: PR_FONT.display, fontSize: size * 0.42,
      color: T.ink, position: 'relative', overflow: 'hidden',
      border: `1px solid ${T.hairline}`,
      flexShrink: 0,
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>{initials}</span>
    </div>
  );
}

// Pos diagram — vertical pitch with primary + alt position dots.
function PosDiagram({ T, primary = 'MED', alt = ['MED-O', 'MED-D', 'AVA-E'], w = 76, h = 110 }) {
  // simple zone coordinates 0..1
  const map = {
    'GR':    [0.5, 0.92],
    'DEF-C': [0.5, 0.78], 'DEF-D': [0.78, 0.78], 'DEF-E': [0.22, 0.78],
    'MED':   [0.5, 0.55], 'MED-D': [0.78, 0.55], 'MED-E': [0.22, 0.55],
    'MED-O': [0.5, 0.40], 'MED-C': [0.5, 0.55],
    'AVA':   [0.5, 0.20], 'AVA-D': [0.78, 0.22], 'AVA-E': [0.22, 0.22],
  };
  const pPrimary = map[primary] || [0.5, 0.55];
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <rect x={1} y={1} width={w - 2} height={h - 2} fill="none" stroke={T.hairlineStrong} strokeWidth={1} />
      <line x1={1} y1={h / 2} x2={w - 1} y2={h / 2} stroke={T.hairlineStrong} strokeWidth={0.8} />
      <circle cx={w / 2} cy={h / 2} r={9} fill="none" stroke={T.hairlineStrong} strokeWidth={0.8} />
      {/* boxes */}
      <rect x={w * 0.25} y={1} width={w * 0.5} height={h * 0.12} fill="none" stroke={T.hairlineStrong} strokeWidth={0.8} />
      <rect x={w * 0.25} y={h * 0.88 - 1} width={w * 0.5} height={h * 0.12} fill="none" stroke={T.hairlineStrong} strokeWidth={0.8} />
      {alt.map((a) => {
        const p = map[a]; if (!p) return null;
        return <circle key={a} cx={p[0] * w} cy={p[1] * h} r={3.2} fill="none" stroke={T.ink3} strokeWidth={1} strokeDasharray="2 2" />;
      })}
      <circle cx={pPrimary[0] * w} cy={pPrimary[1] * h} r={5} fill={T.ink} />
    </svg>
  );
}

// Cal heatmap — 8 weeks × 7 days
function CalHeat({ T, cal, cellSize = 14, gap = 3 }) {
  const colorFor = (v) => {
    if (v === 0) return T.hairline;
    if (v === -1) return T.alert;       // missed
    if (v === -2) return T.surface2;    // rest day
    if (v === 1) return T.ink2;         // training
    if (v === 2) return T.accent;       // match
    return T.hairline;
  };
  return (
    <div style={{ display: 'inline-grid', gridAutoFlow: 'column',
                  gridTemplateRows: `repeat(7, ${cellSize}px)`, gap }}>
      {cal.flatMap((week) => week.map((v, i) => (
        <div key={Math.random()} style={{
          width: cellSize, height: cellSize, borderRadius: 2,
          background: colorFor(v),
        }} />
      )))}
    </div>
  );
}

// Crosshair / asterisk — editorial detail
function Cross({ T, size = 8 }) {
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke={T.ink3} strokeWidth={0.8} />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke={T.ink3} strokeWidth={0.8} />
    </svg>
  );
}

Object.assign(window, {
  PR_TOKENS_LIGHT, PR_TOKENS_DARK, PR_FONT,
  TOMAS, NEXT_MATCH, NEXT_TRAINING,
  Rule, Eyebrow, Datum, StatusPill, LoadSpark, TrendLine,
  ACWRGauge, FatigueRadar, Avatar, PosDiagram, CalHeat, Cross,
});
