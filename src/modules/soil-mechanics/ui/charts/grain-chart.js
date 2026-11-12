/**
 * grain-chart.js - منحنى توزيع الحبيبات (SVG ساكن). المحور الأفقي لوغاريتمي ويتناقص يميناً كالمحاضرة.
 */
const W = 560, H = 340, X0 = 50, Y0 = 290, PW = 490, PH = 260;
const MAXLOG = 2, MINLOG = -3; // من 100 mm إلى 0.001 mm
const clampLog = (mm) => Math.min(MAXLOG, Math.max(MINLOG, Math.log10(mm)));
const X = (mm) => (X0 + ((MAXLOG - clampLog(mm)) / (MAXLOG - MINLOG)) * PW).toFixed(1);
const Y = (p) => (Y0 - (p / 100) * PH).toFixed(1);

export function renderGrainChart({ points = [], D = {} } = {}) {
  const g = [];
  for (let e = MAXLOG; e >= MINLOG; e--) {
    const mm = 10 ** e;
    g.push(`<line x1="${X(mm)}" y1="${Y(0)}" x2="${X(mm)}" y2="${Y(100)}" stroke="var(--line)" stroke-width="0.8"/>`);
    g.push(`<text x="${X(mm)}" y="${Y(0) + 16}" text-anchor="middle" font-size="11" fill="var(--ink-soft)">${mm}</text>`);
  }
  for (let p = 0; p <= 100; p += 10) {
    g.push(`<line x1="${X0}" y1="${Y(p)}" x2="${X0 + PW}" y2="${Y(p)}" stroke="var(--line)" stroke-width="0.6"/>`);
    g.push(`<text x="${X0 - 8}" y="${Number(Y(p)) + 4}" text-anchor="end" font-size="11" fill="var(--ink-soft)">${p}</text>`);
  }
  const marks = [[4.75, 'No.4'], [0.075, 'No.200'], [0.002, '0.002']].map(([mm, t]) =>
    `<line x1="${X(mm)}" y1="${Y(0)}" x2="${X(mm)}" y2="${Y(100)}" stroke="var(--violet-300)" stroke-width="1" stroke-dasharray="3 3"/>
     <text x="${X(mm)}" y="${Y(100) - 4}" text-anchor="middle" font-size="10" fill="var(--violet-700)">${t}</text>`).join('');

  const pts = [...points].filter((p) => p.mm > 0).sort((a, b) => b.mm - a.mm);
  const line = pts.length ? `<polyline points="${pts.map((p) => `${X(p.mm)},${Y(p.finer)}`).join(' ')}" fill="none" stroke="var(--violet-600)" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${X(p.mm)}" cy="${Y(p.finer)}" r="3.5" fill="var(--violet-600)"/>`).join('')}` : '';

  const dm = [['D10', 10], ['D30', 30], ['D60', 60]].filter(([k]) => D[k] > 0).map(([k, p]) =>
    `<line x1="${X0}" y1="${Y(p)}" x2="${X(D[k])}" y2="${Y(p)}" stroke="var(--ink-soft)" stroke-dasharray="4 3"/>
     <line x1="${X(D[k])}" y1="${Y(p)}" x2="${X(D[k])}" y2="${Y(0)}" stroke="var(--ink-soft)" stroke-dasharray="4 3"/>
     <text x="${Number(X(D[k])) + 4}" y="${Number(Y(p)) - 4}" font-size="11" fill="var(--ink)">${k} = ${+D[k].toPrecision(3)}</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="منحنى توزيع الحبيبات: النسبة المارة مقابل حجم الحبيبة" style="width:100%;height:auto;direction:ltr;">
    ${g.join('')}${marks}${line}${dm}
    <text x="${X0 + PW / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--ink)">حجم الحبيبة (mm) - يتناقص نحو اليمين</text>
    <text x="14" y="${Y(50)}" font-size="12" fill="var(--ink)" transform="rotate(-90 14 ${Y(50)})" text-anchor="middle">النسبة المارة (%)</text>
  </svg>`;
}