/**
 * tree-steps.js - يحوّل نتيجة classifyUSCS إلى خطوات حركة (بلا DOM، قابل للاختبار).
 * كل خطوة = عقدة واحدة على المسار، ومعها الفرع الداخل إليها (edgeIn) ونص السرد بالعربية.
 */
export function buildSteps(result) {
  const path = (result && result.path) || [];
  return path.map((p, i) => {
    const prev = path[i - 1];
    const edgeIn = prev && prev.branchId ? `${prev.nodeId}>${prev.branchId}` : null;
    const next = path[i + 1];
    let kind, text;
    if (p.question) {
      kind = 'node';
      text = `${p.question} ← ${p.label}. ${p.reasonAr} (${p.source})`;
    } else if (p.kind === 'symbol') {
      kind = 'symbol';
      text = `الرمز محسوم: ${p.symbol}${next ? ' — ننتقل الآن إلى تسمية التربة' : ''}`;
    } else {
      kind = 'name';
      text = `الاسم: ${p.name}`;
    }
    return { nodeId: p.nodeId, edgeIn, kind, text };
  });
}

/** نص الخاتمة: النتيجة إن اكتمل التصنيف، وإلا العقدة المعلقة وما ينقص */
export function describeFinal(result, tree) {
  if (!result) return '';
  if (result.status === 'complete' && result.result) return `النتيجة: ${result.result.symbol} — ${result.result.name}`;
  if (result.status === 'partial') {
    const q = result.pendingNode && tree[result.pendingNode] ? tree[result.pendingNode].question : '';
    const needs = (result.needs || []).map((n) => n.ar).join('، ');
    return `توقف المسار عند: «${q}»${needs ? ` — ينقص: ${needs}` : ''}`;
  }
  return '';
}

/** معرّفات أوراق الأسماء المطابقة لاحتمالات {symbol, name} */
export function candidateLeafIds(tree, candidates) {
  const ids = [];
  for (const c of candidates || []) {
    for (const [id, n] of Object.entries(tree)) {
      if (!n.leaf) continue;
      if (!c.name && n.stage === 'symbol' && n.symbol === c.symbol) ids.push(id);
      else if (c.name && n.stage === 'name' && n.symbol === c.symbol && n.name === c.name) ids.push(id);
    }
  }
  return ids;
}

/** بصمة تتغير فقط إذا تغير المسار أو سبب أي خطوة أو العقدة المعلقة أو الاحتمالات */
export function signature(result) {
  return JSON.stringify([
    result.status,
    (result.path || []).map((p) => [p.nodeId, p.branchId || '', p.reasonAr || '']),
    result.pendingNode,
    (result.candidates || []).map((c) => `${c.symbol}|${c.name || ''}`)
  ]);
}
