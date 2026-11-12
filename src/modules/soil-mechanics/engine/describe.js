/**
 * describe.js - التوصيفات: اللدونة، النشاط، حالة التربة، المعادن المحتملة
 * كل القيم المدخلة هنا بالنسبة المئوية (PI = 22 تعني 22%)، ما عدا A فهي رقم بلا وحدة.
 */
import tables from '../data/tables.json';

const inBand = (v, b) => (b.min === null || v > b.min) && (b.max === null || v <= b.max);

export const plasticityByPI = (PI) => tables.plasticityDescriptions.byPI.find((b) => inBand(PI, b)) || null;
export const plasticityByLL = (LL) => tables.plasticityDescriptions.byLL.find((b) => inBand(LL, b)) || null;

// تصنيف النشاط (ص 28): أقل من 0.75 خامل، 0.75 إلى 1.25 عادي، أكبر من 1.25 نشط
export function activityClass(A) {
  if (A < 0.75) return { en: 'Inactive', ar: 'خامل' };
  if (A <= 1.25) return { en: 'Normal', ar: 'عادي' };
  return { en: 'Active', ar: 'نشط' };
}

// حالة التربة (ص 26 و29). النسب كسور عشرية. SL اختياري.
export function stateOf({ w, PL, LL, SL }) {
  if (w == null || PL == null || LL == null) return null;
  if (w > LL) return { ar: 'سائلة (Liquid)', assumption: true };
  if (w === LL) return { ar: 'عند الحد السائل (بين اللدنة والسائلة)', assumption: true };
  if (w > PL) return { ar: 'لدنة (Plastic)', assumption: false }; // منصوص عليها في مثال 8
  if (SL == null) return { ar: 'صلبة أو شبه صلبة (أقل من الحد اللدن)', assumption: true };
  if (w >= SL) return { ar: 'شبه صلبة (Semisolid)', assumption: true };
  return { ar: 'صلبة (Solid)', assumption: true };
}

// المعادن الطينية التي تقع قيمك ضمن مجالاتها النموذجية (ص 27)
export function mineralMatches({ LL, PL, A }) {
  if (LL == null && PL == null) return null;
  const within = (v, [lo, hi]) => v == null || (v >= lo && v <= hi);
  return tables.clayMinerals.filter((m) => within(LL, m.LL) && within(PL, m.PL) && within(A, m.A));
}