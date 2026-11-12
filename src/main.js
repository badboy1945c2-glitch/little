import './style.css';
import { resize } from './concrete.js';

// --- التنقل بين صفحات التطبيق (الترحيب / المواد / الخرسانة / الإنشائات) ---
// الصفحات اللي تُحمَّل داخل iframe (الإنشائات، التربة): يتحمل الـ iframe أول مرة تدخل الصفحة فقط
function openEmbedded(pageId, frameId) {
    document.getElementById(pageId).classList.add('active');
    const fr = document.getElementById(frameId);
    if (!fr.getAttribute('src')) fr.setAttribute('src', fr.dataset.src);
}

const subjects = [
    { id: "concrete", title: "الخرسانة المسلحة", emoji: "🏗️", color: "#2563EB", path: "#/concrete", status: "active", desc: "تصميم وحسابات العتبات" },
    { id: "structures", title: "الإنشائات", emoji: "📐", color: "#0F766E", path: "#/structures", status: "active", desc: "الاستقرار الإنشائي والمنشآت" },
    { id: "soil", title: "ميكانيك التربة", emoji: "🌍", color: "#D97706", path: "#/soil", status: "active", desc: "خصائص التربة وتصنيفها" }
];

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("subjects-grid");
    
    subjects.forEach(sub => {
        const card = document.createElement("div");
        card.className = `card ${sub.status}`;
        if(sub.status === 'active') {
            card.addEventListener('click', () => window.location.hash = sub.path );
        }
        card.innerHTML = `
            ${sub.status === 'soon' ? '<div style="position: absolute; top: 12px; left: -30px; background: #64748b; color: white; font-size: 0.7rem; padding: 3px 30px; transform: rotate(-45deg); font-weight: bold;">قريباً</div>' : ''}
            <span class="emoji">${sub.emoji}</span>
            <h3 style="color: ${sub.color}">${sub.title}</h3>
            <p>${sub.desc}</p>
        `;
        grid.appendChild(card);
    });

    function handleRoute() {
        const hash = window.location.hash;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        if (hash === '#/subjects') document.getElementById('page-subjects').classList.add('active');
        else if (hash === '#/structures') openEmbedded('page-structures', 'structures-frame');
        else if (hash === '#/soil') openEmbedded('page-soil', 'soil-frame');
        else if (hash === '#/concrete') {
            document.getElementById('page-concrete').classList.add('active');
            resize(); // ضروري لتحديث مقاسات الكانفاس عند الدخول
        }
        else document.getElementById('page-welcome').classList.add('active');
    }

    document.getElementById("btn-start").addEventListener('click', () => window.location.hash = '#/subjects');
    window.addEventListener('hashchange', handleRoute);
    
    if(!window.location.hash) window.location.hash = '#/';
    else handleRoute();
});
