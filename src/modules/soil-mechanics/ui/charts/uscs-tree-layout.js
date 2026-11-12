/**
 * uscs-tree-layout.js - حساب مواضع عقد شجرة USCS (S7). بلا DOM، لذلك يمكن اختباره.
 * الجذر على اليمين والتفرع نحو اليسار (اتجاه القراءة العربي).
 * المدخل: شجرة المحرك (getUscsTree) ومعرّف الجذر. لا نتبع leaf.to: الورقة الرمزية تنتهي عند الرمز.
 */
export const DIMS = {
  colW: 330,       // المسافة بين أعمدة العمق
  marginX: 16,
  marginY: 16,
  gapY: 14,
  internalW: 200,
  symbolW: 76,
  nameW: 224,
  lineH: 15
};

/** يقسّم النص على الكلمات بحيث لا يتجاوز كل سطر maxChars حرفاً (الكلمة الطويلة تبقى سطراً كاملاً) */
export function wrapText(text, maxChars) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function sizeOf(n) {
  const { internalW, symbolW, nameW, lineH } = DIMS;
  if (n.leaf && n.stage === 'symbol') return { w: symbolW, h: 36, lines: [n.symbol] };
  if (n.leaf) {
    const lines = wrapText(n.name, 30);
    return { w: nameW, h: Math.max(36, 14 + lines.length * lineH), lines };
  }
  const lines = wrapText(n.question, 24);
  return { w: internalW, h: Math.max(40, 16 + lines.length * lineH), lines };
}

export function layoutTree(tree, rootId) {
  const { colW, marginX, marginY, gapY } = DIMS;
  const nodes = [], edges = [];
  let cursor = marginY, maxDepth = 0;

  const walk = (id, depth) => {
    const n = tree[id];
    if (!n) throw new Error(`عقدة غير موجودة في الشجرة: ${id}`);
    const rec = { id, depth, leaf: !!n.leaf, stage: n.stage, data: n, ...sizeOf(n) };
    nodes.push(rec);
    if (depth > maxDepth) maxDepth = depth;
    if (!rec.leaf) {
      const kids = n.branches.map((b) => ({ b, rec: walk(b.to, depth + 1) }));
      rec.cy = (kids[0].rec.cy + kids[kids.length - 1].rec.cy) / 2;
      for (const { b, rec: child } of kids) edges.push({ key: `${id}>${b.id}`, from: rec, to: child, label: b.label });
    } else {
      rec.cy = cursor + rec.h / 2;
      cursor += rec.h + gapY;
    }
    return rec;
  };

  const root = walk(rootId, 0);
  const widthAtMax = Math.max(...nodes.filter((n) => n.depth === maxDepth).map((n) => n.w));
  const width = marginX * 2 + maxDepth * colW + widthAtMax;
  const height = cursor - gapY + marginY;

  for (const n of nodes) {
    n.right = width - marginX - n.depth * colW;
    n.x = n.right - n.w;
    n.y = n.cy - n.h / 2;
  }
  for (const e of edges) {
    const px = e.from.x, py = e.from.cy, cx = e.to.right, cy = e.to.cy, bus = px - 16;
    e.d = `M${px} ${py}H${bus}V${cy}H${cx}`;
    e.labelLines = wrapText(e.label, 18);
    e.labelX = (bus + cx) / 2;
    e.labelY = cy - 5;
  }
  return { nodes, edges, width, height, root };
}
