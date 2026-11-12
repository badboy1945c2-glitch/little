/**
 * plasticity-chart.js - مخطط اللدونة (Casagrande) كـ SVG ساكن (الحركة في S8)
 * خط A: PI = 0.73 (LL - 20)  |  خط U: PI = 0.9 (LL - 8)  |  خط عمودي عند LL = 50
 * منطقة CL-ML المظللة [افتراض]: 4 <= PI <= 7 على خط A أو فوقه
 */
const W = 520, H = 360, X0 = 50, Y0 = 320, SX = 4.5, SY = 5; // LL: 0..100 ، PI: 0..60
const X = (ll) => (X0 + ll * SX).toFixed(1);
const Y = (pi) => (Y0 - pi * SY).toFixed(1);

export function renderPlasticityChart({ LL = null, PI = null } = {}) {
  const grid = [];
  for (let v = 0; v <= 100; v += 10) {
    grid.push(`<line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${Y(60)}" stroke="var(--line)" stroke-width="0.6"/>`);
    grid.push(`<text x="${X(v)}" y="${Y(0) + 16}" text-anchor="middle" font-size="11" fill="var(--ink-soft)">${v}</text>`);
  }
  for (let v = 0; v <= 60; v += 10) {
    grid.push(`<line x1="${X(0)}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="0.6"/>`);
    grid.push(`<text x="${X0 - 8}" y="${Number(Y(v)) + 4}" text-anchor="end" font-size="11" fill="var(--ink-soft)">${v}</text>`);
  }
  const aEnd = 100, aEndPI = 0.73 * (aEnd - 20);
  const uStart = 16, uEndLL = 8 + 60 / 0.9;
  const hatchPts = [[0, 4], [20 + 4 / 0.73, 4], [20 + 7 / 0.73, 7], [0, 7]].map(([l, p]) => `${X(l)},${Y(p)}`).join(' ');

  let point = '';
  if (LL != null && PI != null && LL >= 0 && LL <= 100 && PI >= 0 && PI <= 60) {
    point = `<circle cx="${X(LL)}" cy="${Y(PI)}" r="6" fill="var(--violet-600)" stroke="#fff" stroke-width="2"/>
      <text x="${Number(X(LL)) + 10}" y="${Number(Y(PI)) - 8}" font-size="12" fill="var(--violet-700)" font-weight="600">(${+LL.toFixed(1)}, ${+PI.toFixed(1)})</text>`;
  }
  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="مخطط اللدونة: الحد السائل مقابل مؤشر اللدونة" style="width:100%;height:auto;direction:ltr;">
    ${grid.join('')}
    <polygon points="${hatchPts}" fill="var(--violet-200)" opacity="0.7"/>
    <line x1="${X(50)}" y1="${Y(0)}" x2="${X(50)}" y2="${Y(60)}" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="4 3"/>
    <line x1="${X(20)}" y1="${Y(0)}" x2="${X(aEnd)}" y2="${Y(aEndPI)}" stroke="var(--violet-700)" stroke-width="1.6"/>
    <line x1="${X(uStart)}" y1="${Y(0.9 * (uStart - 8))}" x2="${X(uEndLL)}" y2="${Y(60)}" stroke="var(--ink-soft)" stroke-width="1.2"/>
    <text x="${X(88)}" y="${Number(Y(0.73 * 68)) - 6}" font-size="12" fill="var(--violet-700)">خط A</text>
    <text x="${X(68)}" y="${Number(Y(52)) - 4}" font-size="12" fill="var(--ink-soft)">خط U</text>
    <text x="${Number(X(50)) + 4}" y="${Number(Y(57))}" font-size="11" fill="var(--ink-soft)">LL = 50</text>
    <text x="${X(2)}" y="${Number(Y(5.5)) + 4}" font-size="11" fill="var(--violet-800)">CL-ML</text>
    <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--ink)">LL الحد السائل (%)</text>
    <text x="14" y="${Y(30)}" font-size="12" fill="var(--ink)" transform="rotate(-90 14 ${Y(30)})" text-anchor="middle">PI مؤشر اللدونة (%)</text>
    ${point}
  </svg>`;
}