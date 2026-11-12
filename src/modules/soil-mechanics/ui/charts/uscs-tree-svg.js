/**
 * uscs-tree-svg.js - رسم شجرة USCS كـ SVG ثابت (S7) من نتيجة uscs-tree-layout.js.
 * كل عقدة <g class="tp-node" data-id> وكل فرع <g class="tp-edge" data-key>.
 * الحالات تُعطى بإضافة أصناف CSS (is-taken / is-final / is-pending / is-cand / is-active)،
 * وهذا ما يستعمله المشغّل (S8) لإظهار المسار وتحريكه.
 */
import { DIMS } from './uscs-tree-layout.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const TREE_CSS = `
  .tp-view{border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--bg);overflow:auto;max-height:560px;direction:ltr}
  .tp-stack{display:flex;flex-direction:column;gap:14px;padding:10px;width:max-content;min-width:100%}
  .tp-stage-title{direction:rtl;font-size:.82rem;color:var(--violet-800);font-weight:700;position:sticky;left:10px;width:max-content}
  .tp-muted{color:var(--ink-soft);font-weight:400}
  .tp-svg{display:block;max-width:none}
  .tp-edge-base{fill:none;stroke:var(--line);stroke-width:1.5}
  .tp-edge-hi{fill:none;stroke:var(--violet-700);stroke-width:3;stroke-dasharray:1;stroke-dashoffset:1;stroke-linecap:round}
  .tp-edge.is-taken .tp-edge-hi{stroke-dashoffset:0}
  .tp-elabel{font-size:10px;fill:var(--ink-soft);paint-order:stroke;stroke:var(--bg);stroke-width:3px;unicode-bidi:plaintext}
  .tp-edge.is-taken .tp-elabel{fill:var(--violet-800);font-weight:700}
  .tp-node rect{fill:var(--bg);stroke:var(--line);stroke-width:1.5;cursor:pointer}
  .tp-node text{font-size:12px;fill:var(--ink-soft);unicode-bidi:plaintext;pointer-events:none}
  .tp-node .tp-sym{font-size:15px;font-weight:700}
  .tp-node.is-taken rect{fill:var(--violet-50);stroke:var(--violet-700);stroke-width:2}
  .tp-node.is-taken text{fill:var(--violet-800)}
  .tp-node.is-final rect{fill:var(--violet-700)}
  .tp-node.is-final text{fill:#fff}
  .tp-node.is-cand rect{stroke:var(--violet-700);stroke-dasharray:4 3}
  .tp-node.is-pending rect{stroke:var(--violet-700);stroke-width:2.5;stroke-dasharray:6 4;animation:tp-march 1.2s linear infinite}
  .tp-node.is-active rect{stroke-width:3.5}
  .tp-qmark{font-size:16px;font-weight:700;fill:var(--violet-700);display:none}
  .tp-node.is-pending .tp-qmark{display:block}
  .tp-anim .tp-edge-hi{transition:stroke-dashoffset var(--tp-t,600ms) ease}
  .tp-anim .tp-node rect{transition:fill 300ms ease 400ms,stroke 300ms ease 400ms}
  @keyframes tp-march{to{stroke-dashoffset:-20}}
  @media (prefers-reduced-motion:reduce){
    .tp-anim .tp-edge-hi,.tp-anim .tp-node rect{transition:none}
    .tp-node.is-pending rect{animation:none}
  }`;

function textBlock(lines, cx, top, h, cls) {
  const { lineH } = DIMS;
  const y0 = top + (h - lines.length * lineH) / 2 + lineH * 0.78;
  return `<text class="${cls}" x="${cx}" text-anchor="middle">${lines
    .map((l, i) => `<tspan x="${cx}" y="${(y0 + i * lineH).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text>`;
}

export function renderTreeSvg(layout, { label = '' } = {}) {
  const { nodes, edges, width, height } = layout;
  const edgeSvg = edges.map((e) => {
    const n = e.labelLines.length;
    const lab = `<text class="tp-elabel" text-anchor="middle">${e.labelLines
      .map((l, i) => `<tspan x="${e.labelX.toFixed(1)}" y="${(e.labelY - (n - 1 - i) * 12).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text>`;
    return `<g class="tp-edge" data-key="${esc(e.key)}"><path class="tp-edge-base" d="${e.d}"/><path class="tp-edge-hi" pathLength="1" d="${e.d}"/>${lab}</g>`;
  }).join('');

  const nodeSvg = nodes.map((n) => {
    const symbolLeaf = n.leaf && n.stage === 'symbol';
    return `<g class="tp-node${n.leaf ? ' is-leaf' : ''}" data-id="${esc(n.id)}">
      <rect x="${n.x}" y="${n.y.toFixed(1)}" width="${n.w}" height="${n.h}" rx="${symbolLeaf ? 18 : 8}"/>
      ${textBlock(n.lines, n.x + n.w / 2, n.y, n.h, symbolLeaf ? 'tp-sym' : 'tp-q')}
      <text class="tp-qmark" x="${n.x + 6}" y="${(n.y - 5).toFixed(1)}">؟</text></g>`;
  }).join('');

  return `<svg class="tp-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-w="${width}" data-h="${height}" role="group" aria-label="${esc(label)}">${edgeSvg}${nodeSvg}</svg>`;
}
