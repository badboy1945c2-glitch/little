/**
 * soil-page.js - صفحة الوحدة (التبويبات). تبويب «القوانين» جاهز (S3)، والباقي حالات فارغة.
 */
import { SOIL_TABS, ensureSoilSource } from '../index.js';
import { renderLawsTab } from './tabs/laws.js';
import { renderGrainTab } from './tabs/grain.js';
import { renderDetectTab } from './tabs/detect.js';
export function renderSoilPage({ query = {} } = {}) {
  ensureSoilSource();
  const container = document.createElement('div');
  container.className = 'container page-container';
  container.style.padding = '40px 20px 100px';

  let active = SOIL_TABS.some((t) => t.id === query.tab) ? query.tab : 'laws';

  const TAB_BUILDERS = { laws: renderLawsTab, grain: renderGrainTab, detect: renderDetectTab }; // تُضاف بقية التبويبات في الدفعات القادمة

  function draw() {
    const tab = SOIL_TABS.find((t) => t.id === active);
    container.innerHTML = `
      <div style="border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 24px;">
        <div class="badge badge-category" style="margin-bottom: 10px;">وحدة ميكانيك التربة</div>
        <h1 style="font-size: 2rem; margin-bottom: 6px;">ميكانيك التربة</h1>
        <p style="margin: 0; color: var(--ink-soft); font-size: .95rem;">مبنية حرفياً من المحاضرة (ص1 إلى ص45).</p>
      </div>
      <div role="tablist" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
        ${SOIL_TABS.map((t) => `
          <button type="button" role="tab" aria-selected="${t.id === active}" data-tab="${t.id}"
            class="btn btn-sm ${t.id === active ? 'btn-primary' : 'btn-secondary'}">${t.title}</button>`).join('')}
      </div>
      <div id="soil-tab-body"></div>`;

    const body = container.querySelector('#soil-tab-body');
    if (TAB_BUILDERS[active]) {
      body.appendChild(TAB_BUILDERS[active]());
    } else {
      body.innerHTML = `<div class="empty-state">
        <h4 class="empty-state-title">${tab.title}</h4>
        <p class="empty-state-desc">${tab.hint}. هذا التبويب قيد البناء وسيُملأ في المراحل القادمة.</p></div>`;
    }
    container.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => { active = b.dataset.tab; draw(); }));
  }

  draw();
  return container;
}