// نقطة بداية صفحة ميكانيك التربة (صفحة مستقلة تُعرض داخل iframe بتبويب «ميكانيك التربة»)
import './soil-styles/tokens.css';
import './soil-styles/base.css';
import './soil-styles/components.css';
import './soil-styles/animations.css';
import { renderSoilPage } from './modules/soil-mechanics/ui/soil-page.js';

const app = document.querySelector('#app');
const tab = new URLSearchParams(window.location.search).get('tab') || undefined; // soil.html?tab=detect
app.appendChild(renderSoilPage({ query: { tab } }));
