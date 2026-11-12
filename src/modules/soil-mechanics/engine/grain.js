/**
 * grain.js - التحليل الحبيبي (القسم 4 من المواصفات)
 * النسبة المارة من الكتل، استيفاء D على المقياس اللوغاريتمي، Cu وCc، نسب الأجزاء، قانون ستوكس
 */
import tables from '../data/tables.json';

export const SIEVES = tables.sieves; // [{ no, mm }]
const L = Math.log10;

// rows: [{ no, mm, mass }] ، pan: كتلة الوعاء. النسبة المارة = (ΣM − التراكمية) / ΣM × 100
export function percentFinerFromMasses(rows, pan = 0) {
  const sorted = [...rows].sort((a, b) => b.mm - a.mm);
  const total = sorted.reduce((s, r) => s + (r.mass || 0), 0) + (pan || 0);
  let cum = 0;
  const out = sorted.map((r) => {
    cum += r.mass || 0;
    return { ...r, cumulative: cum, finer: total > 0 ? ((total - cum) / total) * 100 : null };
  });
  return { rows: out, total, points: out.filter((r) => r.finer !== null).map((r) => ({ mm: r.mm, finer: r.finer })) };
}

// النسبة المارة يجب أن تتناقص مع نقصان فتحة المنخل
export function checkPoints(points) {
  const pts = [...points].sort((a, b) => b.mm - a.mm);
  const errors = [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].finer > pts[i - 1].finer + 1e-9) {
      errors.push(`النسبة المارة يجب أن تتناقص مع نقصان الفتحة (عند ${pts[i].mm} mm)`);
    }
  }
  return errors;
}

const sortDesc = (points) => [...points].sort((a, b) => b.mm - a.mm);

// النسبة المارة عند حجم d (استيفاء خطي على لوغاريتم الحجم). null إن كان d أصغر من أصغر نقطة
export function percentAt(points, d) {
  const pts = sortDesc(points);
  if (!pts.length) return null;
  if (d >= pts[0].mm) return pts[0].finer;
  if (d < pts[pts.length - 1].mm) return null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (d <= a.mm && d >= b.mm) {
      if (a.mm === b.mm) return a.finer;
      const t = (L(a.mm) - L(d)) / (L(a.mm) - L(b.mm));
      return a.finer + t * (b.finer - a.finer);
    }
  }
  return null;
}

// القطر D عند نسبة مارة p: log D = log D1 + (p − p1)/(p2 − p1) × (log D2 − log D1)
export function dAt(points, p) {
  const pts = sortDesc(points);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.finer >= p && b.finer <= p) {
      if (a.finer === b.finer) return a.mm;
      const t = (a.finer - p) / (a.finer - b.finer);
      return 10 ** (L(a.mm) + t * (L(b.mm) - L(a.mm)));
    }
  }
  return null;
}

export function gradeParams(D10, D30, D60) {
  const ok = [D10, D30, D60].every((x) => Number.isFinite(x) && x > 0);
  if (!ok) return { Cu: null, Cc: null };
  return { Cu: D60 / D10, Cc: (D30 ** 2) / (D60 * D10) };
}

export const GRAIN_SYSTEMS = {
  MIT: { label: 'MIT', gravelMin: 2, sandMin: 0.06, siltMin: 0.002, hasSilt: true },
  USDA: { label: 'USDA', gravelMin: 2, sandMin: 0.05, siltMin: 0.002, hasSilt: true },
  AASHTO: { label: 'AASHTO', gravelMin: 2, sandMin: 0.075, siltMin: 0.002, hasSilt: true },
  USCS: { label: 'USCS (الموحد)', gravelMin: 4.75, sandMin: 0.075, hasSilt: false }
};

// نسب الأجزاء (حصى/رمل/غرين/طين) حسب النظام. null إن كان الحجم خارج مجال البيانات
export function fractions(points, systemKey) {
  const s = GRAIN_SYSTEMS[systemKey];
  const fg = percentAt(points, s.gravelMin), fs = percentAt(points, s.sandMin);
  const fc = s.hasSilt ? percentAt(points, s.siltMin) : null;
  if (fg === null || fs === null || (s.hasSilt && fc === null)) return null;
  return s.hasSilt
    ? { gravel: 100 - fg, sand: fg - fs, silt: fs - fc, clay: fc }
    : { gravel: 100 - fg, sand: fg - fs, fines: fs };
}

// قانون ستوكس (ص 20): v = (ρs − ρw) D² / (18 η)  (كله بوحدات SI)
export function stokesVelocity({ rhoS, rhoW, eta, D }) {
  return ((rhoS - rhoW) * D * D) / (18 * eta);
}