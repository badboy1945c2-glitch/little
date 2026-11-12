/**
 * uscs-tree.js - شجرة قرار USCS كبيانات (عقد وفروع) تُبنى من القسم 6.3 من المواصفات
 * المستوى 1: رمز المجموعة (جدول 2، ص35)  |  المستوى 2: الاسم (أشكال 5.4 إلى 5.6، ص37-39)
 */
import names from '../data/uscs-names.json';

const EPS = 1e-9;
const ABOVE = `PI >= aLine - ${EPS}`;  // على خط A أو فوقه
const BELOW = `PI < aLine - ${EPS}`;   // تحت خط A
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

let cached = null;
export const getUscsTree = () => cached || (cached = build());
export const USCS_ROOT = 'uscs.peat';

function build() {
  const T = {};
  const add = (n) => { T[n.id] = n; return n; };
  const leaf = (id, stage, p) => add({ id, leaf: true, stage, ...p });
  const br = (id, label, test, to, reasonAr, extra = {}) => ({ id, label, test, to, reasonAr, ...extra });
  const src = (p) => `المحاضرة، ص${p}`;

  // ── قالب الأسماء للناعمة (شكل 5.5) ──
  function template(pfx, base, symbol) {
    const L = (suffix, name) => leaf(`${pfx}.${suffix}`, 'name', { symbol, name });
    add({ id: pfx, stage: 'name', question: 'كم نسبة المحتجز على منخل 200؟', source: src(38), branches: [
      br('lt15', 'أقل من 15%', 'plus200 < 15', `${pfx}.base`, 'المحتجز على منخل 200 يساوي {plus200}% وهو أقل من 15%، فيبقى الاسم الأساسي'),
      br('15to30', '15% إلى أقل من 30%', 'plus200 >= 15 && plus200 < 30', `${pfx}.mid`, 'المحتجز على منخل 200 يساوي {plus200}% (بين 15 و30)، فنضيف «with sand» أو «with gravel»'),
      br('ge30', '30% فأكثر', 'plus200 >= 30', `${pfx}.hi`, 'المحتجز على منخل 200 يساوي {plus200}% وهو 30% أو أكثر، فنضيف «Sandy» أو «Gravelly»')
    ] });
    L('base', base);
    add({ id: `${pfx}.mid`, stage: 'name', question: 'هل الرمل أكثر من الحصى أم العكس؟', source: src(38), branches: [
      br('sand', 'الرمل ≥ الحصى', 'sand >= gravel', `${pfx}.mid.sand`, 'الرمل {sand}% وهو أكبر من أو يساوي الحصى {gravel}%'),
      br('gravel', 'الحصى > الرمل', 'sand < gravel', `${pfx}.mid.gravel`, 'الحصى {gravel}% وهو أكبر من الرمل {sand}%')
    ] });
    L('mid.sand', `${base} with sand`);
    L('mid.gravel', `${base} with gravel`);
    add({ id: `${pfx}.hi`, stage: 'name', question: 'هل الرمل أكثر من الحصى أم العكس؟', source: src(38), branches: [
      br('sand', 'الرمل ≥ الحصى', 'sand >= gravel', `${pfx}.hi.s`, 'الرمل {sand}% وهو أكبر من أو يساوي الحصى {gravel}%'),
      br('gravel', 'الحصى > الرمل', 'sand < gravel', `${pfx}.hi.g`, 'الحصى {gravel}% وهو أكبر من الرمل {sand}%')
    ] });
    add({ id: `${pfx}.hi.s`, stage: 'name', question: 'هل الحصى أقل من 15%؟', source: src(38), branches: [
      br('lt15', 'أقل من 15%', 'gravel < 15', `${pfx}.hi.s.a`, 'الحصى {gravel}% وهو أقل من 15%'),
      br('ge15', '15% فأكثر', 'gravel >= 15', `${pfx}.hi.s.b`, 'الحصى {gravel}% وهو 15% أو أكثر')
    ] });
    L('hi.s.a', `Sandy ${lower(base)}`);
    L('hi.s.b', `Sandy ${lower(base)} with gravel`);
    add({ id: `${pfx}.hi.g`, stage: 'name', question: 'هل الرمل أقل من 15%؟', source: src(38), branches: [
      br('lt15', 'أقل من 15%', 'sand < 15', `${pfx}.hi.g.a`, 'الرمل {sand}% وهو أقل من 15%'),
      br('ge15', '15% فأكثر', 'sand >= 15', `${pfx}.hi.g.b`, 'الرمل {sand}% وهو 15% أو أكثر')
    ] });
    L('hi.g.a', `Gravelly ${lower(base)}`);
    L('hi.g.b', `Gravelly ${lower(base)} with sand`);
  }

  const coarseSymbol = (sym) => {
    const id = `uscs.sym.${sym}`;
    if (T[id]) return id;
    const isG = sym[0] === 'G';
    const sec = isG ? 'sand' : 'gravel';
    const secAr = isG ? 'الرمل' : 'الحصى';
    const [n0, n1] = names.coarseNames[sym];
    leaf(id, 'symbol', { symbol: sym, to: `name.${sym}` });
    add({ id: `name.${sym}`, stage: 'name', question: `هل نسبة ${secAr} أقل من 15%؟`, source: src(37), branches: [
      br('lt15', 'أقل من 15%', `${sec} < 15`, `name.${sym}.0`, `نسبة ${secAr} {${sec}}% وهي أقل من 15%`),
      br('ge15', '15% فأكثر', `${sec} >= 15`, `name.${sym}.1`, `نسبة ${secAr} {${sec}}% وهي 15% أو أكثر`)
    ] });
    leaf(`name.${sym}.0`, 'name', { symbol: sym, name: n0 });
    leaf(`name.${sym}.1`, 'name', { symbol: sym, name: n1 });
    return id;
  };

  const fineSymbol = (sym) => {
    const id = `uscs.sym.${sym}`;
    if (T[id]) return id;
    leaf(id, 'symbol', { symbol: sym, to: `name.${sym}` });
    if (sym === 'OL' || sym === 'OH') {
      const clay = sym === 'OL' ? `PI >= 4 && ${ABOVE}` : ABOVE;
      const silt = sym === 'OL' ? `PI < 4 || ${BELOW}` : BELOW;
      add({ id: `name.${sym}`, stage: 'name', question: 'هل النقطة على خط A أو فوقه (طين عضوي) أم تحته (غرين عضوي)؟', source: src(39), branches: [
        br('clay', 'طين عضوي', clay, `name.${sym}.clay`, 'النقطة (LL، PI) على خط A أو فوقه، فهو طين عضوي'),
        br('silt', 'غرين عضوي', silt, `name.${sym}.silt`, 'النقطة (LL، PI) تحت خط A أو PI صغيرة، فهو غرين عضوي')
      ] });
      template(`name.${sym}.clay`, 'Organic clay', sym);
      template(`name.${sym}.silt`, 'Organic silt', sym);
    } else {
      template(`name.${sym}`, names.fineBaseNames[sym], sym);
    }
    return id;
  };

  // ── الجذر والخث ──
  add({ id: 'uscs.peat', stage: 'symbol', question: 'هل المادة عضوية في الغالب (خث)؟', source: src(35), branches: [
    br('peat', 'نعم (خث)', 'peat == 1', 'uscs.sym.Pt', 'المادة عضوية في الغالب (لون داكن ورائحة عضوية)، فهي خث'),
    br('mineral', 'لا', 'peat == 0', 'uscs.f200', 'المادة ليست خثاً، نصنّفها حسب حجم الحبيبات')
  ] });
  leaf('uscs.sym.Pt', 'symbol', { symbol: 'Pt', to: 'name.Pt' });
  leaf('name.Pt', 'name', { symbol: 'Pt', name: 'Peat' });

  add({ id: 'uscs.f200', stage: 'symbol', question: 'ما نسبة المار من منخل 200؟', source: src(35), branches: [
    br('coarse', 'أقل من 50%', 'F200 < 50', 'uscs.coarse', 'المار من منخل 200 يساوي {F200}% وهو أقل من 50%، فالتربة خشنة الحبيبات'),
    br('fine', '50% أو أكثر', 'F200 >= 50', 'uscs.fine.ll', 'المار من منخل 200 يساوي {F200}% وهو 50% أو أكثر، فالتربة ناعمة الحبيبات')
  ] });

  add({ id: 'uscs.coarse', stage: 'symbol', question: 'هل الحصى أكثر من نصف الجزء الخشن؟', source: src(35), branches: [
    br('G', 'حصى (G)', 'gravel > sand', 'uscs.G.f', 'الحصى {gravel}% وهو أكبر من الرمل {sand}%، فالتربة حصوية (G)'),
    br('S', 'رمل (S)', 'gravel <= sand', 'uscs.S.f', 'الرمل {sand}% وهو أكبر من أو يساوي الحصى {gravel}%، فالتربة رملية (S)')
  ] });

  // ── الخشنة: لكل من G وS ──
  for (const [P, cuMin] of [['G', 4], ['S', 6]]) {
    const good = `Cu >= ${cuMin} && Cc >= 1 && Cc <= 3`;
    const poor = `Cu < ${cuMin} || Cc < 1 || Cc > 3`;
    const gradeReason = (w) => (w
      ? `Cu ≥ ${cuMin} و Cc بين 1 و3، فالتدرج جيد (W)`
      : `Cu أقل من ${cuMin} أو Cc خارج المجال 1 إلى 3، فالتدرج رديء (P)`);
    const grade = (id, mk) => add({ id, stage: 'symbol', question: 'هل التدرج جيد أم رديء؟', source: src(35), branches: [
      br('W', 'جيد التدرج (W)', good, mk('W'), gradeReason(true)),
      br('P', 'رديء التدرج (P)', poor, mk('P'), gradeReason(false))
    ] });
    const fType = (id, mkM, mkC) => add({ id, stage: 'symbol', question: 'هل الناعم غرين (M) أم طين (C)؟', source: src(35), branches: [
      br('M', 'غرين (M)', `PI < 4 || ${BELOW}`, mkM, 'PI أقل من 4 أو النقطة تحت خط A، فالناعم غرين (M)'),
      br('C', 'طين (C)', `PI >= 4 && ${ABOVE}`, mkC, 'PI من 4 فأكثر والنقطة على خط A أو فوقه، فالناعم طين (C)',
        { assumeIf: 'PI <= 7', assumeAr: 'افتراض: الناعم في المنطقة المظللة (PI بين 4 و7) ولم تحدد المحاضرة الرمز عند 5% إلى 12%، فاعتمدنا الحرف C' })
    ] });

    add({ id: `uscs.${P}.f`, stage: 'symbol', question: 'ما نسبة المار من منخل 200؟', source: src(35), branches: [
      br('clean', 'أقل من 5% (نظيفة)', 'F200 < 5', `uscs.${P}.clean`, 'المار من منخل 200 يساوي {F200}% وهو أقل من 5%، فالتربة نظيفة'),
      br('dual', '5% إلى 12% (رمز مزدوج)', 'F200 >= 5 && F200 <= 12', `uscs.${P}.dual`, 'المار من منخل 200 يساوي {F200}% (بين 5 و12)، فالرمز مزدوج'),
      br('fines', 'أكثر من 12% (مع ناعم)', 'F200 > 12', `uscs.${P}.fines`, 'المار من منخل 200 يساوي {F200}% وهو أكثر من 12%، فالتربة مع ناعم')
    ] });
    grade(`uscs.${P}.clean`, (g) => coarseSymbol(`${P}${g}`));
    grade(`uscs.${P}.dual`, (g) => `uscs.${P}.dual.${g}`);
    for (const g of ['W', 'P']) {
      fType(`uscs.${P}.dual.${g}`, coarseSymbol(`${P}${g}-${P}M`), coarseSymbol(`${P}${g}-${P}C`));
    }
    add({ id: `uscs.${P}.fines`, stage: 'symbol', question: 'هل الناعم غرين (M) أم طين (C) أم الاثنان؟', source: src(35), branches: [
      br('M', 'غرين (M)', `PI < 4 || ${BELOW}`, coarseSymbol(`${P}M`), 'PI أقل من 4 أو النقطة تحت خط A، فالناعم غرين (M)'),
      br('C', 'طين (C)', `PI > 7 && ${ABOVE}`, coarseSymbol(`${P}C`), 'PI أكبر من 7 والنقطة على خط A أو فوقه، فالناعم طين (C)'),
      br('CM', 'مزدوج (C-M)', `PI >= 4 && PI <= 7 && ${ABOVE}`, coarseSymbol(`${P}C-${P}M`), 'PI بين 4 و7 والنقطة على خط A أو فوقه (المنطقة المظللة)، فالرمز مزدوج')
    ] });
  }

  // ── الناعمة ──
  add({ id: 'uscs.fine.ll', stage: 'symbol', question: 'ما قيمة الحد السائل LL؟', source: src(35), branches: [
    br('low', 'أقل من 50', 'LL < 50', 'uscs.fine.low', 'الحد السائل LL = {LL} وهو أقل من 50، فاللدونة منخفضة (L)'),
    br('high', '50 أو أكثر', 'LL >= 50', 'uscs.fine.high', 'الحد السائل LL = {LL} وهو 50 أو أكثر، فاللدونة عالية (H)')
  ] });
  add({ id: 'uscs.fine.low', stage: 'symbol', question: 'هل التربة عضوية؟', source: src(35), branches: [
    br('org', 'عضوية', 'isOrg == 1', fineSymbol('OL'), 'نسبة LL المجففة إلى غير المجففة أقل من 0.75، فالتربة عضوية (OL)'),
    br('min', 'غير عضوية', 'isOrg == 0', 'uscs.fine.low.pi', 'التربة غير عضوية')
  ] });
  add({ id: 'uscs.fine.low.pi', stage: 'symbol', question: 'أين تقع النقطة (LL، PI) بالنسبة لخط A؟', source: src(35), branches: [
    br('ML', 'ML', `PI < 4 || ${BELOW}`, fineSymbol('ML'), 'PI أقل من 4 أو النقطة تحت خط A (خط A عند هذا LL = {aLine})، فهي ML'),
    br('CL', 'CL', `PI > 7 && ${ABOVE}`, fineSymbol('CL'), 'PI أكبر من 7 والنقطة على خط A أو فوقه (خط A = {aLine})، فهي CL'),
    br('CLML', 'CL-ML', `PI >= 4 && PI <= 7 && ${ABOVE}`, fineSymbol('CL-ML'), 'PI بين 4 و7 والنقطة على خط A أو فوقه (المنطقة المظللة)، فهي CL-ML')
  ] });
  add({ id: 'uscs.fine.high', stage: 'symbol', question: 'هل التربة عضوية، وأين النقطة بالنسبة لخط A؟', source: src(35), branches: [
    br('org', 'عضوية', 'isOrg == 1', fineSymbol('OH'), 'نسبة LL المجففة إلى غير المجففة أقل من 0.75، فالتربة عضوية (OH)'),
    br('CH', 'CH', `isOrg == 0 && ${ABOVE}`, fineSymbol('CH'), 'غير عضوية والنقطة على خط A أو فوقه (خط A = {aLine})، فهي CH'),
    br('MH', 'MH', `isOrg == 0 && ${BELOW}`, fineSymbol('MH'), 'غير عضوية والنقطة تحت خط A (خط A = {aLine})، فهي MH')
  ] });

  return T;
}