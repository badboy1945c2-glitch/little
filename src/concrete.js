// حاسبة الخرسانة المسلحة (WSD / USD): نفس منطقك بدون تغيير.
// الأزرار بـ index.html تنادي الدوال مباشرة (onclick/oninput)، فنعرضها على window بآخر الملف.

// --- 2. سكربتات الآلة الحاسبة (بنفس منطقك تماماً) ---
const st = {
    method: 'wsd',
    invalidFields: new Set(),
    condition: 'uncracked', 
    shape: 'rect', 
    calcModeStr: 'check',
    momentSource: 'direct',
    directM: 34,
    steelMode: 'area',
    As_direct: 2119.5,
    Asp_direct: 0,
    h: 500, b: 250, bw: 300, hf: 100, hb: 50, 
    cover: 50,
    dp_val: 50,
    botBars: 2, botDia: 25,
    topBars: 0, topDia: 16,
    fc: 30, fy: 400, n: 8, fc_all: 13.5, fs_all: 170, 
    beamCase: 'ss_p_center',
    L: 6.0,
    loadP: 48.8,
    loadW: 10.0,
    loadA: 2.0,
    auto_fc: true,
    auto_fs: true,
    
    gammaD: 1.0, gammaL: 1.0, gammaManuallyEdited: false,
    udl_unk: 'L', udl_D: 10, udl_L: 0, udl_T: 0, udl_link: true,
    p_unk: 'L', p_D: 10, p_L: 0, p_T: 0, p_link: true
};

let res = { unsolvable: false, y: 0, I: 0, fc: 0, fs: 0, fsp: 0, Mcap: 0, a: 0, Mapp: 0, ft: 0, fr: 0, eqn: "", eps_t: 0, phi: 0, Mn: 0, usdChecks: [] };
const anim = JSON.parse(JSON.stringify(st));
Object.assign(anim, res);

const vizCanvas = document.getElementById('vizCanvas');
const vCtx = vizCanvas.getContext('2d');
const beamCanvas = document.getElementById('beamCanvas');
const bCtx = beamCanvas.getContext('2d');

function initCalc() {
    window.addEventListener('resize', resize);
    resize();
    document.getElementById('inp-gammaD').value = st.gammaD;
    document.getElementById('inp-gammaL').value = st.gammaL;
    setMethod(st.method);
    setShape('rect');
    document.getElementById('inp-udl-D').value = st.udl_D;
    document.getElementById('inp-p-D').value = st.p_D;
    syncLoadInputsDisabled();
    animLoop();
}

export function resize() {
    if(!vizCanvas || !vizCanvas.parentElement) return;
    const p1 = vizCanvas.parentElement;
    vizCanvas.width = p1.offsetWidth;
    vizCanvas.height = p1.offsetHeight;

    const p2 = beamCanvas.parentElement;
    beamCanvas.width = p2.offsetWidth;
    beamCanvas.height = p2.offsetHeight;
}

function syncLoadInputsDisabled() {
    let isFindLoad = (st.calcModeStr === 'find_load' && st.momentSource === 'loads');
    let isPureUdl = (st.beamCase === 'ss_udl' || st.beamCase === 'cant_udl');
    let disableP = isFindLoad && !isPureUdl;
    let disableW = isFindLoad && isPureUdl;

    if(document.getElementById('inp-loadP')) document.getElementById('inp-loadP').disabled = disableP;
    if(document.getElementById('val-loadP')) document.getElementById('val-loadP').disabled = disableP;
    if(document.getElementById('inp-loadW')) document.getElementById('inp-loadW').disabled = disableW;
    if(document.getElementById('val-loadW')) document.getElementById('val-loadW').disabled = disableW;
}

function setMethod(m) {
    let oldM = st.method;
    st.method = m;
    document.getElementById('tab-wsd').className = m === 'wsd' ? "flex-1 px-2 py-2 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg" : "flex-1 px-2 py-2 rounded-lg text-sm font-bold transition-all text-slate-400 hover:text-slate-200 bg-transparent";
    document.getElementById('tab-usd').className = m === 'usd' ? "flex-1 px-2 py-2 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg" : "flex-1 px-2 py-2 rounded-lg text-sm font-bold transition-all text-slate-400 hover:text-slate-200 bg-transparent";
    
    document.getElementById('wsd-cond-toggle').style.display = m === 'wsd' ? 'flex' : 'none';
    document.getElementById('wsd-allow-grp').style.display = m === 'wsd' ? 'flex' : 'none';
    
    if (oldM !== m && !st.gammaManuallyEdited) {
        st.gammaD = (m === 'usd') ? 1.2 : 1.0;
        st.gammaL = (m === 'usd') ? 1.6 : 1.0;
        document.getElementById('inp-gammaD').value = st.gammaD;
        document.getElementById('inp-gammaL').value = st.gammaL;
    }

    evalDLBlocks(false);
    calcEngine();
}

function setCondition(c) {
    st.condition = c;
    document.getElementById('btn-cracked').className = c === 'cracked' ? "flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all bg-slate-800 text-white border border-cyan-500" : "flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all bg-transparent text-slate-400 hover:text-white border border-transparent";
    document.getElementById('btn-uncracked').className = c === 'uncracked' ? "flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all bg-slate-800 text-white border border-cyan-500" : "flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all bg-transparent text-slate-400 hover:text-white border border-transparent";
    calcEngine();
}

function setBeamCase(val) {
    st.beamCase = val;
    const show = (id) => document.getElementById(id).classList.remove('hidden');
    const hide = (id) => document.getElementById(id).classList.add('hidden');
    
    hide('box-load-p'); hide('box-load-w'); hide('box-load-a');
    
    if (val.includes('p')) show('box-load-p');
    if (val.includes('udl')) show('box-load-w');
    if (val.includes('2p')) show('box-load-a');
    if (val === 'ss_udl' || val === 'cant_udl') hide('box-load-p');
    
    syncLoadInputsDisabled();
    calcEngine();
}

function setShape(s) {
    st.shape = s;
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${s}`).classList.add('active');

    const names = { rect: 'مستطيل', t: 'مقطع T', i: 'مقطع I', box: 'صندوقي', u: 'U مقلوب', circle: 'دائري' };
    document.getElementById('shape-name-tag').innerText = names[s] || 'مقطع';

    const show = (id) => document.getElementById(id).classList.remove('hidden');
    const hide = (id) => document.getElementById(id).classList.add('hidden');
    
    show('grp-bw'); show('grp-hf'); show('grp-hb');
    document.getElementById('lbl-b').innerText = 'العرض (b)';
    document.getElementById('lbl-bw').innerText = 'الجذع (bw)';
    document.getElementById('lbl-hf').innerText = 'الشفة (hf)';

    if(s === 'rect') { hide('grp-bw'); hide('grp-hf'); hide('grp-hb'); }
    if(s === 't') { hide('grp-hb'); document.getElementById('lbl-b').innerText = 'عرض الشفة (b)'; document.getElementById('lbl-bw').innerText = 'عرض الجذع (bw)'; }
    if(s === 'u') { hide('grp-hb'); document.getElementById('lbl-b').innerText = 'العرض (b)'; document.getElementById('lbl-bw').innerText = 'الداخلي (bw)'; }

    calcEngine();
}

function toggleAuto(type, isChecked) {
    st['auto_' + type] = isChecked;
    const input = document.getElementById('inp-' + type + '_all');
    input.disabled = isChecked;
    if(isChecked) {
        input.classList.remove('border-red-500', 'bg-red-900/30');
        updateAllowables();
        calcEngine();
    }
}

function updateAllowables() {
    if (st.auto_fc) { st.fc_all = 0.45 * st.fc; document.getElementById('inp-fc_all').value = st.fc_all.toFixed(2); }
    if (st.auto_fs) { st.fs_all = st.fy >= 400 ? 170 : 140; document.getElementById('inp-fs_all').value = st.fs_all.toFixed(2); }
}

function updateMainUnknown(val) {
    st.calcModeStr = val;
    if (val === 'find_load' && st.momentSource === 'direct') {
        document.getElementById('inp-momentSource').value = 'loads';
        st.momentSource = 'loads';
        document.getElementById('box-direct-m').classList.add('hidden');
        document.getElementById('box-loads-inputs').classList.remove('hidden');
    }
    document.getElementById('inp-mainUnknown').value = val;
    
    let isPureUdl = (st.beamCase === 'ss_udl' || st.beamCase === 'cant_udl');
    ['udl', 'p'].forEach(blk => {
        let canLink = (blk === 'udl' && isPureUdl) || (blk === 'p' && !isPureUdl);
        if (st.calcModeStr === 'find_load' && st[blk + '_link'] && canLink) {
            if (st[blk + '_unk'] === 'T') {
                st[blk + '_unk'] = 'L';
                let r = document.querySelector(`input[name="${blk}_unk"][value="L"]`);
                if(r) r.checked = true;
            }
        }
    });

    syncLoadInputsDisabled();
    evalDLBlocks(false);
    calcEngine();
    updateUI();
}

function handleDLChange(key, val) {
    if (key === 'gammaD' || key === 'gammaL') {
        st[key] = parseFloat(val);
        st.gammaManuallyEdited = true;
    } else {
        st[key] = val;
        if (typeof val === 'string' && val !== 'T' && val !== 'D' && val !== 'L' && val !== '') {
            st[key] = parseFloat(val);
        }
    }
    evalDLBlocks(false);
    calcEngine();
}

function evalDLBlocks(isAfterCalc) {
    let gD = st.gammaD; let gL = st.gammaL;
    let isValidGamma = (gD > 0 && gL > 0);
    let isPureUdl = (st.beamCase === 'ss_udl' || st.beamCase === 'cant_udl');

    ['udl', 'p'].forEach(blk => {
        let unk = st[blk + '_unk'];
        let canLink = (blk === 'udl' && isPureUdl) || (blk === 'p' && !isPureUdl);
        let linked = (st.calcModeStr === 'find_load') && st[blk + '_link'] && canLink;

        document.getElementById(`inp-${blk}-D`).disabled = (unk === 'D');
        document.getElementById(`inp-${blk}-L`).disabled = (unk === 'L');
        document.getElementById(`inp-${blk}-T`).disabled = (unk === 'T' || linked);

        let elD = document.getElementById(`inp-${blk}-D`);
        let elL = document.getElementById(`inp-${blk}-L`);
        let elT = document.getElementById(`inp-${blk}-T`);

        let D_raw = elD.value; let L_raw = elL.value; let T_raw = elT.value;
        let D = parseFloat(D_raw); let L = parseFloat(L_raw); let T = parseFloat(T_raw);
        
        let msgEl = document.getElementById(`${blk}-msg`);
        msgEl.innerHTML = '';
        
        if (!isValidGamma) return;
        
        if (linked && isAfterCalc) {
            T = (blk === 'udl') ? st.loadW : st.loadP;
            elT.value = T.toFixed(2);
            st[blk + '_T'] = T;
        } else if (unk !== 'T' && !linked && !isAfterCalc) {
            st[blk + '_T'] = T; 
        }

        if (unk === 'T') {
            if (linked) return; 
            if (!isNaN(D) && !isNaN(L) && D_raw!=='' && L_raw!=='') {
                T = gD * D + gL * L;
                elT.value = T.toFixed(3);
                st[blk + '_T'] = T;
                let mainKey = (blk === 'udl') ? 'loadW' : 'loadP';
                if (!isAfterCalc) {
                    st[mainKey] = T;
                    if(document.getElementById(`inp-${mainKey}`)) document.getElementById(`inp-${mainKey}`).value = T;
                    if(document.getElementById(`val-${mainKey}`)) {
                        let el = document.getElementById(`val-${mainKey}`);
                        if(el.tagName === 'INPUT') el.value = T.toFixed(2); else el.innerText = T.toFixed(2);
                    }
                }
            }
        } else if (unk === 'L') {
            if (!isNaN(D) && !isNaN(T) && D_raw!=='' && T_raw!=='') {
                L = (T - gD * D) / gL;
                elL.value = L.toFixed(3);
                st[blk + '_L'] = L;
            }
        } else if (unk === 'D') {
            if (!isNaN(L) && !isNaN(T) && L_raw!=='' && T_raw!=='') {
                D = (T - gL * L) / gD;
                elD.value = D.toFixed(3);
                st[blk + '_D'] = D;
            }
        }
    });
}

function update(key, val, el) {
    if (key === 'momentSource') {
        st.momentSource = val;
        if (val === 'direct' && st.calcModeStr === 'find_load') {
            st.calcModeStr = 'check';
            document.getElementById('inp-mainUnknown').value = 'check';
        }
        if (val === 'direct') {
            document.getElementById('box-direct-m').classList.remove('hidden');
            document.getElementById('box-loads-inputs').classList.add('hidden');
        } else {
            document.getElementById('box-direct-m').classList.add('hidden');
            document.getElementById('box-loads-inputs').classList.remove('hidden');
        }
        syncLoadInputsDisabled();
        evalDLBlocks(false);
        calcEngine();
        updateUI();
        return;
    }
    if (key === 'steelMode') {
        st.steelMode = val;
        if (val === 'area') {
            document.getElementById('box-steel-area').classList.remove('hidden');
            document.getElementById('box-steel-bars').classList.add('hidden');
        } else {
            document.getElementById('box-steel-area').classList.add('hidden');
            document.getElementById('box-steel-bars').classList.remove('hidden');
        }
        calcEngine();
        return;
    }

    if(val === '' || isNaN(parseFloat(val)) || parseFloat(val) < 0) {
        if(el) el.classList.add('border-red-500', 'bg-red-900/30');
        st.invalidFields.add(key);
        calcEngine(); 
        return;
    } else {
        if(el) el.classList.remove('border-red-500', 'bg-red-900/30');
        st.invalidFields.delete(key);
    }

    let num = parseFloat(val);
    st[key] = num;
    
    if (key === 'loadW' && st.udl_unk !== 'T') st.udl_T = num;
    if (key === 'loadP' && st.p_unk !== 'T') st.p_T = num;

    if (key === 'fc' || key === 'fy') updateAllowables();

    if (key === 'L') {
        const maxA = num / 2;
        const aSlider = document.getElementById('inp-loadA');
        if (aSlider) aSlider.max = maxA.toFixed(1);
        if (st.loadA > maxA) {
            st.loadA = maxA;
            let elA = document.getElementById('val-loadA');
            if(elA) { if (elA.tagName === 'INPUT') elA.value = st.loadA; else elA.innerText = st.loadA; }
            if(aSlider) aSlider.value = st.loadA;
        }
    }
    
    let htmlEl = document.getElementById(`val-${key}`);
    if(htmlEl) { if (htmlEl.tagName === 'INPUT') htmlEl.value = num; else htmlEl.innerText = num; }
    evalDLBlocks(false);
    calcEngine();
}

function modBar(pos, delta) {
    let key = `${pos}Bars`;
    st[key] += delta;
    if(st[key] < 0) st[key] = 0;
    if(st[key] > 30) st[key] = 30;
    document.getElementById(`val-${key}`).innerText = st[key];
    calcEngine();
}

function applyReqAs(val) {
    st.steelMode = 'area';
    document.getElementById('inp-steelMode').value = 'area';
    st.As_direct = val;
    document.getElementById('inp-As_direct').value = val.toFixed(1);
    document.getElementById('box-steel-area').classList.remove('hidden');
    document.getElementById('box-steel-bars').classList.add('hidden');
    calcEngine();
}

function getW(y) {
    if (y < 0 || y > st.h) return 0;
    const b = st.b, bw = st.bw, hf = st.hf, hb = st.hb, h = st.h;
    switch(st.shape) {
        case 'rect': return b;
        case 't': return (y <= hf) ? b : bw;
        case 'i': return (y <= hf || y >= h - hb) ? b : bw;
        case 'box': return (y <= hf || y >= h - hb) ? b : bw;
        case 'u': return (y <= hf) ? b : (b - bw); 
        case 'circle': 
            let r = b / 2; let dy_circ = y - r;
            if(Math.abs(dy_circ) >= r) return 0;
            return 2 * Math.sqrt(r*r - dy_circ*dy_circ);
    }
    return b;
}

function calcEngine() {
    // (نسخة طبق الأصل من الكود اللي أرسلته بدون تغيير أي معادلة)
    const errBanner = document.getElementById('validation-error');
    errBanner.classList.add('hidden');
    errBanner.innerHTML = '';
    
    const As = st.steelMode === 'area' ? st.As_direct : (st.botBars * Math.PI * Math.pow(st.botDia/2, 2));
    const Asp = st.steelMode === 'area' ? st.Asp_direct : (st.topBars * Math.PI * Math.pow(st.topDia/2, 2));
    
    let errors = [];
    const isRelevant = (k) => {
        if (st.method === 'usd' && ['n', 'fc_all', 'fs_all'].includes(k)) return false;
        if (['bw'].includes(k)) return ['t', 'i', 'box', 'u'].includes(st.shape);
        if (['hf'].includes(k)) return ['t', 'i', 'box', 'u'].includes(st.shape);
        if (['hb'].includes(k)) return ['i', 'box'].includes(st.shape);

        if (st.momentSource === 'direct') {
            if (['loadP', 'loadW', 'loadA', 'L'].includes(k)) return false;
            if (k === 'directM') return true;
        } else {
            if (k === 'directM') return false;
            if (k === 'L') return true;
            if (st.calcModeStr === 'find_load') {
                let calcW = (st.beamCase === 'ss_udl' || st.beamCase === 'cant_udl');
                if (calcW && k === 'loadW') return false;
                if (!calcW && k === 'loadP') return false;
            }
            if (k === 'loadP') return st.beamCase.includes('p');
            if (k === 'loadW') return st.beamCase.includes('udl');
            if (k === 'loadA') return st.beamCase.includes('2p');
        }
        if (st.steelMode === 'bars') { if (['As_direct', 'Asp_direct'].includes(k)) return false; } 
        else { if (['botBars', 'botDia', 'topBars', 'topDia'].includes(k)) return false; }
        return true; 
    };

    const fieldLabels = { h: 'الارتفاع (h)', b: 'العرض (b)', bw: 'عرض الجذع', hf: 'الشفة העلوي', hb: 'الشفة السفلى', cover: 'غطاء الشد', dp_val: 'غطاء الضغط', fc: 'f\'c', fy: 'fy', n: 'n', directM: 'العزم', L: 'الطول', loadP: 'الحمل P', loadW: 'الحمل W', loadA: 'المسافة a', As_direct: 'As', Asp_direct: 'A\'s', fc_all: 'fc_all', fs_all: 'fs_all' };
    let relevantInvalid = [...st.invalidFields].filter(isRelevant);
    if (relevantInvalid.length > 0) errors.push(`حقل غير صالح: ${relevantInvalid.map(k => fieldLabels[k] || k).join('، ')}`);

    if (st.method === 'wsd' && st.n <= 0) errors.push("n > 0");
    if (st.fc <= 0) errors.push("f'c > 0");
    if (st.fy <= 0) errors.push("fy > 0");
    if (st.h <= st.cover) errors.push("h > Cover");
    if (Asp > 0 && st.h <= st.dp_val) errors.push("h > d'");
    if (st.b <= 0) errors.push("b > 0");
    if (st.method === 'wsd' && st.condition === 'cracked' && As <= 0) errors.push("As > 0 في المتشقق");
    if (st.method === 'usd' && As <= 0) errors.push("As > 0");

    if (errors.length > 0) {
        errBanner.innerHTML = errors.join("<br>");
        errBanner.classList.remove('hidden');
        res = { unsolvable: true, y: 0, I: 0, fc: 0, fs: 0, fsp: 0, Mcap: 0, a: 0, Mapp: 0, ft: 0, fr: 0, eqn: "-", eps_t: 0, phi: 0, Mn: 0, usdChecks: [] };
        document.getElementById('solution-steps').innerHTML = `<div class="text-rose-400 font-bold">أخطاء في المدخلات.</div>`;
        updateUI(true);
        return;
    }

    const d = st.h - st.cover;
    const dp = st.dp_val;
    const n = st.n;
    let stepsHTML = ""; 
    let L = st.L; let a_dist = Math.min(st.loadA, L/2);
    let Mapp = 0; let currentEqn = "";

    if (st.momentSource === 'direct') {
        Mapp = st.directM; currentEqn = `M = ${Mapp.toFixed(1)} kN.m`;
    } else if (st.calcModeStr !== 'find_load') {
        let P = st.loadP; let W = st.loadW;
        switch(st.beamCase) {
            case 'ss_udl': Mapp = (W * L * L) / 8; currentEqn = "M = WL²/8"; break;
            case 'ss_p_center': Mapp = (P * L) / 4; currentEqn = "M = PL/4"; break;
            case 'ss_2p': Mapp = P * a_dist; currentEqn = "M = Pa"; break;
            case 'ss_udl_p': Mapp = (W * L * L) / 8 + (P * L) / 4; currentEqn = "M = WL²/8 + PL/4"; break;
            case 'ss_udl_2p': Mapp = (W * L * L) / 8 + P * a_dist; currentEqn = "M = WL²/8 + Pa"; break;
            case 'cant_udl': Mapp = (W * L * L) / 2; currentEqn = "M = WL²/2"; break;
            case 'cant_p_end': Mapp = P * L; currentEqn = "M = PL"; break;
            case 'cant_p_center': Mapp = 0.5 * P * L; currentEqn = "M = 0.5PL"; break;
            case 'cant_udl_p_end': Mapp = (W * L * L) / 2 + P * L; currentEqn = "M = WL²/2 + PL"; break;
            case 'cant_udl_p_center': Mapp = (W * L * L) / 2 + 0.5 * P * L; currentEqn = "M = WL²/2 + 0.5PL"; break;
        }
    }

    if (st.calcModeStr === 'find_as') {
        if (st.method === 'wsd') {
            if (st.shape !== 'rect') stepsHTML += `<div class="text-rose-400">فقط للمستطيل.</div>`;
            else {
                let M_Nmm = Mapp * 1e6; let k = (st.n * st.fc_all) / (st.n * st.fc_all + st.fs_all); let j = 1 - k/3;
                let req_As = M_Nmm / (st.fs_all * j * d);
                stepsHTML += `<div>k=${k.toFixed(3)}, j=${j.toFixed(3)}</div>`;
                stepsHTML += `<div>Req As = ${req_As.toFixed(1)} mm²</div>`;
                stepsHTML += `<button onclick="applyReqAs(${req_As})" class="mt-1 px-2 py-1 bg-fuchsia-600 text-white rounded text-[10px]">تطبيق مساحة الحديد = ${req_As.toFixed(1)}</button>`;
            }
        } else {
            if (st.shape !== 'rect') stepsHTML += `<div class="text-rose-400">فقط للمستطيل.</div>`;
            else {
                let Mu_Nmm = Mapp * 1e6; let term = 1 - (2.36 * Mu_Nmm) / (0.9 * st.b * d * d * st.fc);
                if (term < 0) stepsHTML += `<div class="text-rose-400">العزم كبير جداً.</div>`;
                else {
                    let rho = (1 - Math.sqrt(term)) / (1.18 * st.fy / st.fc);
                    let As_min = Math.max(Math.sqrt(st.fc)/(4*st.fy), 1.4/st.fy) * st.b * d;
                    let As_req = Math.max(rho * st.b * d, As_min);
                    stepsHTML += `<div>Req As = ${As_req.toFixed(1)} mm²</div>`;
                    stepsHTML += `<button onclick="applyReqAs(${As_req})" class="mt-1 px-2 py-1 bg-fuchsia-600 text-white rounded text-[10px]">تطبيق مساحة الحديد = ${As_req.toFixed(1)}</button>`;
                }
            }
        }
    }

    if (st.method === 'wsd') {
        if (st.condition === 'uncracked') {
            let A_c = 0, Q_c = 0, dy = st.h / 500;
            for(let i=0; i<500; i++) { let yi = i*dy + dy/2; let w = getW(yi); A_c += w*dy; Q_c += w*dy*yi; }
            let As_trans = (n - 1) * As, Asp_trans = (2 * n - 1) * Asp;
            let y = (Q_c + As_trans * d + Asp_trans * dp) / (A_c + As_trans + Asp_trans);
            
            let I_un = 0;
            for(let i=0; i<500; i++) { let yi = i*dy + dy/2; let w = getW(yi); I_un += w*dy*Math.pow(y-yi, 2) + (w*Math.pow(dy, 3))/12; }
            I_un += Asp_trans * Math.pow(y - dp, 2); I_un += As_trans * Math.pow(d - y, 2);
            
            let fr = 0.62 * Math.sqrt(st.fc);
            let ft = I_un > 0 ? (Mapp * 1e6 * (st.h - y)) / I_un : 0;
            let Mcr = (fr * I_un) / (st.h - y) / 1e6;
            
            res = { unsolvable: false, y: y, I: I_un/1e6, fc: 0, fs: 0, fsp: 0, ft: ft, fr: fr, Mcap: Mcr, a: 0, usdChecks: [] };
        } else {
            const As_trans_c = (2 * n - 1) * Asp, As_trans_t = n * As;
            let y_min = 0.1, y_max = st.h, y = d/2, dy_slice = Math.max(0.5, st.h / 1000);
            for(let iter=0; iter<60; iter++) {
                y = (y_min + y_max) / 2; let Q_comp = 0;
                for(let yi=0; yi<y; yi+=dy_slice) Q_comp += getW(yi + dy_slice/2) * dy_slice * (y - (yi + dy_slice/2));
                if (y > dp) Q_comp += As_trans_c * (y - dp);
                let Q_tens = As_trans_t * (d - y);
                if (Q_comp > Q_tens) y_max = y; else y_min = y;
            }
            
            let Icr = 0;
            for(let yi=0; yi<y; yi+=dy_slice) { let yi_mid = yi + dy_slice/2; Icr += getW(yi_mid)*dy_slice*Math.pow(y-yi_mid, 2) + (getW(yi_mid)*Math.pow(dy_slice, 3))/12; }
            if (y > dp) Icr += As_trans_c * Math.pow(y - dp, 2); Icr += As_trans_t * Math.pow(d - y, 2);
            
            let Mc_cap = y > 0 ? (st.fc_all * Icr) / y : 0;
            let Ms_cap = (d - y) > 0 ? (st.fs_all * Icr) / (n * (d - y)) : 0;
            let Mcap = Math.min(Mc_cap, Ms_cap) / 1e6;

            res = { unsolvable: false, y: y, I: Icr/1e6, fc: 0, fs: 0, fsp: 0, ft: 0, fr: 0, Mcap: Mcap, a: 0, usdChecks: [] };
        }
        stepsHTML += `<div>y = ${res.y.toFixed(2)} mm</div><div>I = ${res.I.toFixed(2)} x10⁶ mm⁴</div>`;
    } else {
        const beta1 = st.fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * ((st.fc-28)/7));
        let c_min = 0.001, c_max = st.h / beta1, c = c_max / 2, unsolvable = false;

        const evalF = (c_val) => {
            let a_val = Math.min(beta1 * c_val, st.h);
            let Ac = 0, dy_a = a_val / 400;
            for(let i=0; i<400; i++) Ac += getW(i*dy_a + dy_a/2) * dy_a;
            let Cc = 0.85 * st.fc * Ac;
            let fs_val = Math.max(0, Math.min(st.fy, 600 * (d - c_val) / c_val));
            let fs_prime = (c_val <= dp) ? 0 : Math.min(st.fy, 600 * (c_val - dp) / c_val);
            return Cc + Asp * fs_prime - (As * fs_val);
        };

        if (evalF(c_max) < 0) unsolvable = true;
        else { for(let iter=0; iter<60; iter++) { c = (c_min + c_max) / 2; if (evalF(c) > 0) c_max = c; else c_min = c; } }
        if (c >= d) unsolvable = true;

        if (unsolvable) res = { unsolvable: true, y: 0, a: 0, I: 0, fc: 0, fs: 0, fsp: 0, ft: 0, fr: 0, Mcap: 0, eps_t: 0, phi: 0, Mn: 0, usdChecks: [] };
        else {
            let a = Math.min(beta1 * c, st.h);
            let Ac_moment = 0, Ac_total = 0, dy_a = a / 400;
            for(let i=0; i<400; i++) { let y_slice = i*dy_a + dy_a/2; let dA = getW(y_slice)*dy_a; Ac_total+=dA; Ac_moment+=dA*y_slice; }
            let yc = Ac_total > 0 ? Ac_moment / Ac_total : a/2;
            let Cc = 0.85 * st.fc * Ac_total;
            let fs = Math.max(0, Math.min(st.fy, 600 * (d - c) / c));
            let fs_prime = (c <= dp) ? 0 : Math.min(st.fy, 600 * (c - dp) / c);
            let Cs = Asp * fs_prime;
            
            let Mn = Cc * (d - yc) + Cs * (d - dp);
            let eps_t = 0.003 * (d - c) / c;
            let eps_ty = st.fy / 200000;
            let phi = eps_t >= 0.005 ? 0.9 : (eps_t > eps_ty ? 0.65 + 0.25 * (eps_t - eps_ty) / (0.005 - eps_ty) : 0.65);
            let Mcap = (phi * Mn) / 1e6;
            
            let checks = [];
            let bw_min = st.b; if (['t', 'i', 'box'].includes(st.shape)) bw_min = st.bw; else if (st.shape === 'u') bw_min = st.b - st.bw;
            let As_min = Math.max(Math.sqrt(st.fc)/(4*st.fy), 1.4/st.fy) * bw_min * d;
            
            if (As < As_min) checks.push({type: 'red', msg: `As < As,min`});
            if (eps_t < 0.004) checks.push({type: 'red', msg: `εt < 0.004 (غير مسموح)`});
            if (st.shape === 'rect') {
                let rho = As / (st.b * d);
                let rho_max = 0.85 * beta1 * (st.fc / st.fy) * (0.003 / (0.003 + 0.004));
                if (Asp > 0) rho_max += (Asp / (st.b * d)) * (fs_prime / st.fy);
                if (rho > rho_max) checks.push({type: 'red', msg: `ρ > ρ_max`});
            }

            res = { unsolvable: false, y: c, a: a, I: 0, fc: 0, fs: fs, fsp: fs_prime, ft: 0, fr: 0, Mcap: Mcap, Mn: Mn/1e6, eps_t: eps_t, phi: phi, usdChecks: checks };
            stepsHTML += `<div>c=${c.toFixed(2)}, a=${a.toFixed(2)}</div><div>φ=${phi.toFixed(3)}, εt=${eps_t.toFixed(4)}</div>`;
        }
    }

    if (st.calcModeStr === 'find_load' && !res.unsolvable) {
        Mapp = res.Mcap;
        if (st.beamCase === 'ss_udl') st.loadW = (8 * Mapp) / (L * L);
        else if (st.beamCase === 'cant_udl') st.loadW = (2 * Mapp) / (L * L);
        else {
            let M_W = 0, rem_M = Math.max(0, Mapp - M_W); 
            if(st.beamCase === 'ss_p_center') st.loadP = (4 * rem_M) / L;
            if(st.beamCase === 'ss_2p') st.loadP = rem_M / a_dist;
        }
        
        if(document.getElementById('inp-loadP')) document.getElementById('inp-loadP').value = st.loadP.toFixed(1);
        if(document.getElementById('inp-loadW')) document.getElementById('inp-loadW').value = st.loadW.toFixed(1);
        if(document.getElementById('val-loadP')) { let el = document.getElementById('val-loadP'); if (el.tagName === 'INPUT') el.value = st.loadP.toFixed(1); else el.innerText = st.loadP.toFixed(1); }
        if(document.getElementById('val-loadW')) { let el = document.getElementById('val-loadW'); if (el.tagName === 'INPUT') el.value = st.loadW.toFixed(1); else el.innerText = st.loadW.toFixed(1); }
        evalDLBlocks(true);
    }

    if (st.method === 'wsd' && !res.unsolvable) {
        let I_Nmm4 = res.I * 1e6, M_Nmm = Mapp * 1e6;
        res.fc = I_Nmm4 > 0 ? (M_Nmm * res.y) / I_Nmm4 : 0;
        res.fs = I_Nmm4 > 0 ? n * (M_Nmm * (d - res.y)) / I_Nmm4 : 0;
        res.fsp = (Asp > 0 && I_Nmm4 > 0) ? 2 * n * (M_Nmm * (res.y - dp)) / I_Nmm4 : 0;
        if (st.condition === 'uncracked') res.ft = I_Nmm4 > 0 ? (M_Nmm * (st.h - res.y)) / I_Nmm4 : 0;
    }

    document.getElementById('solution-steps').innerHTML = stepsHTML;
    res.Mapp = Mapp; res.eqn = currentEqn;
    updateUI(false);
}

function autoCalcN() {
    let n_val = (200000 / (4700 * Math.sqrt(st.fc))).toFixed(2);
    document.getElementById('inp-n').value = n_val;
    update('n', parseFloat(n_val), document.getElementById('inp-n'));
}

function updateUI(hasError) {
    let dlPanel = document.getElementById('dl-panel');
    let isPureUdl = (st.beamCase === 'ss_udl' || st.beamCase === 'cant_udl');
    if (dlPanel) {
        if (st.momentSource === 'loads') {
            dlPanel.classList.remove('hidden');
            document.getElementById('dl-udl-block').classList.toggle('hidden', !st.beamCase.includes('udl'));
            document.getElementById('dl-p-block').classList.toggle('hidden', !st.beamCase.includes('p'));
            document.getElementById('lbl-udl-link').classList.toggle('hidden', st.calcModeStr !== 'find_load' || !isPureUdl);
            document.getElementById('lbl-p-link').classList.toggle('hidden', st.calcModeStr !== 'find_load' || isPureUdl);
        } else { dlPanel.classList.add('hidden'); }
    }

    if (st.method === 'usd') {
        document.getElementById('lbl-na-text').innerText = 'عمق النيوترال'; document.getElementById('lbl-na-var').innerText = 'c';
        document.getElementById('lbl-i-text').innerText = 'عمق الانضغاط'; document.getElementById('lbl-i-var').innerText = 'a';
        document.getElementById('lbl-fc-text').innerText = 'انفعال (εt)'; document.getElementById('lbl-fs-text').innerText = 'إجهاد الشد (fs)';
        document.getElementById('lbl-mcap').innerText = 'φMn:';
    } else {
        document.getElementById('lbl-na-text').innerText = 'محور التعادل'; document.getElementById('lbl-na-var').innerText = 'y';
        document.getElementById('lbl-i-text').innerText = 'عزم القصور'; document.getElementById('lbl-i-var').innerText = st.condition === 'uncracked' ? 'I_un' : 'I_cr';
        document.getElementById('lbl-fc-text').innerText = 'إجهاد الخرسانة (fc)'; document.getElementById('lbl-fs-text').innerText = 'إجهاد الشد (fs)';
        document.getElementById('lbl-mcap').innerText = st.condition === 'uncracked' ? 'M_cr:' : 'M_allow:';
    }

    if (hasError || (st.method === 'usd' && res.unsolvable)) {
        ['na', 'i', 'fc', 'fs', 'fsp', 'ft', 'm', 'mcap'].forEach(id => document.getElementById(`res-${id}`).innerText = "-");
        document.getElementById('stat-fc').innerHTML = `<span class="text-rose-400 font-bold">${hasError ? 'خطأ بالمدخلات' : 'المقطع غير قابل للحل'}</span>`;
        return;
    }

    document.getElementById('res-na').innerText = (res.y || 0).toFixed(1);
    if (st.method === 'usd') {
        document.getElementById('res-i').innerText = (res.a || 0).toFixed(1);
        document.getElementById('res-fc').innerText = (res.eps_t || 0).toFixed(4);
        document.getElementById('res-fs').innerText = (res.fs || 0).toFixed(1);
        document.getElementById('res-fsp').innerText = Math.abs(res.fsp || 0).toFixed(1);
        document.getElementById('res-ft').innerText = (res.phi || 0).toFixed(3);
    } else {
        document.getElementById('res-i').innerText = res.I > 0 ? res.I.toFixed(0) : '-';
        document.getElementById('res-fc').innerText = (res.fc || 0).toFixed(2);
        document.getElementById('res-fs').innerText = (res.fs || 0).toFixed(2);
        document.getElementById('res-fsp').innerText = Math.abs(res.fsp || 0).toFixed(2);
        document.getElementById('res-ft').innerText = (res.ft || 0).toFixed(2);
    }
    document.getElementById('res-m').innerText = (res.Mapp || 0).toFixed(1);
    document.getElementById('res-mcap').innerText = (res.Mcap || 0).toFixed(1);

    let boxFsp = document.getElementById('box-res-fsp');
    let boxFt = document.getElementById('box-res-ft');
    const Asp = st.steelMode === 'area' ? st.Asp_direct : (st.topBars * Math.PI * Math.pow(st.topDia/2, 2));
    boxFsp.classList.toggle('hidden', Asp <= 0);
    boxFt.classList.toggle('hidden', st.method === 'wsd' && st.condition !== 'uncracked');

    let statHtml = "";
    if (st.method === 'wsd') {
        if (st.condition === 'uncracked' && res.ft > res.fr) {
            statHtml = `<div class="text-rose-400 font-bold mb-1 bg-rose-900/30 p-1 rounded">المقطع متشقق! <button onclick="setCondition('cracked'); updateAllowables();" class="mr-2 px-2 py-0 bg-rose-600 text-white rounded">تفعيل</button></div>`;
        } else {
            let fc_ok = res.fc <= st.fc_all; let fs_ok = res.fs <= st.fs_all; let fsp_ok = Math.abs(res.fsp) <= st.fs_all;
            if (!fc_ok || !fs_ok || (!fsp_ok && Asp > 0)) statHtml = `<div class="text-rose-400">الإجهادات تجاوزت المسموح.</div>`;
            else statHtml = `<div class="text-emerald-400">الإجهادات ضمن المسموح ✓</div>`;
        }
    } else { 
        let isRed = false;
        let checksHtml = (res.usdChecks || []).map(c => { if(c.type==='red') isRed=true; return `<div class="${c.type==='red'?'text-rose-400':'text-amber-400'}">${c.msg}</div>`; }).join('');
        if (res.Mcap < res.Mapp - 1e-5) isRed = true;
        statHtml = `<div class="${isRed?'text-rose-400':'text-emerald-400'} font-bold">${isRed?'غير آمن':'المقطع آمن ✓'}</div>` + checksHtml;
    }
    document.getElementById('stat-fc').innerHTML = statHtml;
}

function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }

function animLoop() {
    if(document.getElementById('page-concrete').classList.contains('active')){
        const speed = 0.2;
        ['h', 'b', 'bw', 'hf', 'hb', 'cover', 'dp_val', 'L', 'loadP', 'loadW', 'loadA'].forEach(k => anim[k] = lerp(anim[k], st[k], speed));
        ['y', 'a', 'fc', 'fs', 'fsp', 'Mapp'].forEach(k => anim[k] = lerp(anim[k] || 0, res[k], speed));
        
        anim.shape = st.shape; anim.method = st.method; anim.condition = st.condition; anim.momentSource = st.momentSource;
        anim.botBars = st.botBars; anim.topBars = st.topBars; anim.botDia = st.botDia; anim.topDia = st.topDia;
        anim.beamCase = st.beamCase; anim.eqn = res.eqn;

        renderSection();
        renderBeam();
    }
    requestAnimationFrame(animLoop);
}

function renderSection() {
    const w = vizCanvas.width, h = vizCanvas.height;
    if(w===0 || h===0) return;
    vCtx.clearRect(0, 0, w, h);

    const maxDim = Math.max(anim.h, anim.b, 500);
    const padding = 20; const scale = (h - padding * 2) / maxDim;

    const sh = anim.h * scale, sb = anim.b * scale, sbw = anim.bw * scale, shf = anim.hf * scale, shb = anim.hb * scale;
    const scov = anim.cover * scale, sdp = anim.dp_val * scale, sy = anim.y * scale;
    const cx = w * 0.5, cy = padding + (h - padding*2 - sh)/2; 
    
    vCtx.fillStyle = 'rgba(255, 255, 255, 0.04)'; vCtx.strokeStyle = '#38bdf8'; vCtx.lineWidth = 2; vCtx.beginPath();
    if(anim.shape === 'rect') vCtx.rect(cx - sb/2, cy, sb, sh);
    else if (anim.shape === 't') { vCtx.moveTo(cx - sb/2, cy); vCtx.lineTo(cx + sb/2, cy); vCtx.lineTo(cx + sb/2, cy + shf); vCtx.lineTo(cx + sbw/2, cy + shf); vCtx.lineTo(cx + sbw/2, cy + sh); vCtx.lineTo(cx - sbw/2, cy + sh); vCtx.lineTo(cx - sbw/2, cy + shf); vCtx.lineTo(cx - sb/2, cy + shf); }
    else if (anim.shape === 'i') { vCtx.moveTo(cx - sb/2, cy); vCtx.lineTo(cx + sb/2, cy); vCtx.lineTo(cx + sb/2, cy + shf); vCtx.lineTo(cx + sbw/2, cy + shf); vCtx.lineTo(cx + sbw/2, cy + sh - shb); vCtx.lineTo(cx + sb/2, cy + sh - shb); vCtx.lineTo(cx + sb/2, cy + sh); vCtx.lineTo(cx - sb/2, cy + sh); vCtx.lineTo(cx - sb/2, cy + sh - shb); vCtx.lineTo(cx - sbw/2, cy + sh - shb); vCtx.lineTo(cx - sbw/2, cy + shf); vCtx.lineTo(cx - sb/2, cy + shf); }
    else if (anim.shape === 'box') vCtx.rect(cx - sb/2, cy, sb, sh);
    else if (anim.shape === 'u') vCtx.rect(cx - sb/2, cy, sb, sh);
    else if (anim.shape === 'circle') vCtx.arc(cx, cy + sh/2, sb/2, 0, Math.PI*2);
    vCtx.closePath(); vCtx.fill(); vCtx.stroke();

    if (anim.shape === 'box' || anim.shape === 'u') {
        vCtx.fillStyle = '#090d16'; const innerW = sbw, innerH = anim.shape === 'box' ? sh - shf - shb : sh - shf;
        if(innerW > 0 && innerH > 0) { vCtx.fillRect(cx - innerW/2, cy + shf, innerW, innerH); vCtx.strokeRect(cx - innerW/2, cy + shf, innerW, innerH); }
    }

    vCtx.save(); vCtx.clip(); vCtx.fillStyle = 'rgba(56, 189, 248, 0.12)'; 
    vCtx.fillRect(cx - sb, cy, sb*2, Math.max(0, anim.method === 'usd' ? (anim.a || sy) : sy)); vCtx.restore();

    const drawBars = (count, dia, depth, colorStr, innerWidth) => {
        if(count <= 0) return; vCtx.fillStyle = colorStr; vCtx.strokeStyle = '#000'; vCtx.lineWidth = 1;
        const r = Math.max(3, (dia/2)*scale), sCovPx = 15, availW = innerWidth - 2*sCovPx;
        const spacing = count > 1 ? availW / (count - 1) : 0, startX = cx - (innerWidth/2) + sCovPx;
        for(let i=0; i<count; i++) {
            let bx = count === 1 ? cx : startX + (i*spacing);
            vCtx.beginPath(); vCtx.arc(bx, cy + depth, r, 0, Math.PI*2); vCtx.fill(); vCtx.stroke();
        }
    };
    drawBars(anim.botBars, anim.botDia, sh - scov, '#f43f5e', sb); drawBars(anim.topBars, anim.topDia, sdp, '#fbbf24', sb);

    vCtx.beginPath(); vCtx.setLineDash([4, 4]); vCtx.moveTo(w*0.1, cy + sy); vCtx.lineTo(cx + sb/2 + 10, cy + sy);
    vCtx.strokeStyle = '#34d399'; vCtx.stroke(); vCtx.setLineDash([]);
    vCtx.fillStyle = '#34d399'; vCtx.font = '10px Cairo'; vCtx.fillText(anim.method === 'usd' ? 'c' : 'N.A', cx + sb/2 + 12, cy + sy + 3);
}

function renderBeam() {
    const w = beamCanvas.width, h = beamCanvas.height;
    if(w===0 || h===0) return;
    bCtx.clearRect(0, 0, w, h);

    const bxStart = w * 0.1, bxEnd = w * 0.9, bWidth = bxEnd - bxStart;
    const byBeam = h * 0.35, beamH = 20, isCant = anim.beamCase.startsWith('cant_');

    bCtx.fillStyle = '#94a3b8';
    if (isCant) { bCtx.fillRect(bxStart - 10, byBeam - 20, 10, beamH + 40); } 
    else {
        bCtx.beginPath(); bCtx.moveTo(bxStart, byBeam + beamH); bCtx.lineTo(bxStart - 8, byBeam + beamH + 10); bCtx.lineTo(bxStart + 8, byBeam + beamH + 10); bCtx.fill();
        bCtx.beginPath(); bCtx.moveTo(bxEnd, byBeam + beamH); bCtx.lineTo(bxEnd - 8, byBeam + beamH + 10); bCtx.lineTo(bxEnd + 8, byBeam + beamH + 10); bCtx.fill();
    }

    bCtx.fillStyle = '#1e293b'; bCtx.strokeStyle = '#38bdf8'; bCtx.lineWidth = 2;
    bCtx.fillRect(bxStart, byBeam, bWidth, beamH); bCtx.strokeRect(bxStart, byBeam, bWidth, beamH);

    let drawUDL = anim.beamCase.includes('udl') && anim.momentSource !== 'direct';
    let drawP_coords = []; 
    if (anim.momentSource !== 'direct') {
        if(anim.beamCase === 'ss_p_center') drawP_coords.push([0.5, anim.method === 'usd' ? 'Pu' : 'P']);
        else if(anim.beamCase === 'ss_2p') { drawP_coords.push([anim.loadA/anim.L, anim.method === 'usd' ? 'Pu' : 'P']); drawP_coords.push([1 - anim.loadA/anim.L, anim.method === 'usd' ? 'Pu' : 'P']); }
        else if(anim.beamCase === 'ss_udl_p') drawP_coords.push([0.5, anim.method === 'usd' ? 'Pu' : 'P']);
        else if(anim.beamCase === 'ss_udl_2p') { drawP_coords.push([anim.loadA/anim.L, anim.method === 'usd' ? 'Pu' : 'P']); drawP_coords.push([1 - anim.loadA/anim.L, anim.method === 'usd' ? 'Pu' : 'P']); }
        else if(anim.beamCase === 'cant_p_end' || anim.beamCase === 'cant_udl_p_end') drawP_coords.push([1.0, anim.method === 'usd' ? 'Pu' : 'P']);
        else if(anim.beamCase === 'cant_p_center' || anim.beamCase === 'cant_udl_p_center') drawP_coords.push([0.5, anim.method === 'usd' ? 'Pu' : 'P']);
    }

    bCtx.fillStyle = '#fbbf24'; bCtx.strokeStyle = '#fbbf24'; bCtx.textAlign = 'center';
    if (drawUDL) {
        bCtx.fillRect(bxStart, byBeam - 20, bWidth, 3);
        bCtx.font = '10px Cairo'; bCtx.fillText(`${anim.method === 'usd' ? 'Wu' : 'W'} = ${anim.loadW.toFixed(0)}`, bxStart + bWidth/2, byBeam - 25);
    }
    for(let p of drawP_coords) {
        let px = bxStart + p[0] * bWidth;
        bCtx.beginPath(); bCtx.moveTo(px, byBeam - 30); bCtx.lineTo(px, byBeam); bCtx.stroke();
        bCtx.beginPath(); bCtx.moveTo(px, byBeam); bCtx.lineTo(px - 4, byBeam - 8); bCtx.lineTo(px + 4, byBeam - 8); bCtx.fill();
        bCtx.font = '10px Cairo'; bCtx.fillText(p[1], px, byBeam - 35);
    }

    const bmdTop = h * 0.6; const bmdH = h * 0.3; const bmdMid = bmdTop + bmdH * 0.1;
    bCtx.strokeStyle = '#475569'; bCtx.lineWidth = 1; bCtx.beginPath(); bCtx.moveTo(bxStart, bmdMid); bCtx.lineTo(bxEnd, bmdMid); bCtx.stroke();

    const getAnimMomentAtX = (x_ratio) => {
        if (anim.momentSource === 'direct') return anim.Mapp;
        let m = 0, x = x_ratio * anim.L, P = anim.loadP, W = anim.loadW, L = anim.L, a = Math.min(anim.loadA, L/2);
        if (!anim.beamCase.startsWith('cant_')) {
            let R_L = (anim.beamCase.includes('udl') ? W*L/2 : 0) + (anim.beamCase.includes('p_center') ? P/2 : 0) + (anim.beamCase.includes('2p') ? P : 0);
            m += R_L * x;
            if (anim.beamCase.includes('udl')) m -= W * x * x / 2;
            if (anim.beamCase.includes('p_center') && x > L/2) m -= P * (x - L/2);
            if (anim.beamCase.includes('2p')) { if (x > a) m -= P * (x - a); if (x > L - a) m -= P * (x - (L - a)); }
        } else {
            let dist = L - x; 
            if (anim.beamCase.includes('udl')) m += W * dist * dist / 2;
            if (anim.beamCase.includes('p_end')) m += P * dist;
            if (anim.beamCase.includes('p_center') && x <= L/2) m += P * (L/2 - x);
        }
        return Math.max(0, m); 
    };

    bCtx.fillStyle = 'rgba(56, 189, 248, 0.15)'; bCtx.strokeStyle = '#38bdf8'; bCtx.lineWidth = 2; bCtx.beginPath(); bCtx.moveTo(bxStart, bmdMid);
    for (let i = 0; i <= 30; i++) {
        let x_ratio = i / 30; let m = getAnimMomentAtX(x_ratio); let y_val = bmdMid - (m / Math.max(0.001, anim.Mapp)) * bmdH;
        bCtx.lineTo(bxStart + x_ratio * bWidth, y_val);
    }
    bCtx.lineTo(bxEnd, bmdMid); bCtx.closePath(); bCtx.fill(); bCtx.stroke();
    bCtx.font = '10px Cairo'; bCtx.fillStyle = '#38bdf8'; bCtx.textAlign = 'center';
    bCtx.fillText(`${anim.method === 'usd' ? 'Mu' : 'M_max'} = ${anim.Mapp.toFixed(1)}`, isCant ? bxStart + bWidth*0.25 : bxStart + bWidth/2, bmdTop + bmdH);
}

// تشغيل الآلة الحاسبة
setTimeout(initCalc, 100);

// ربط الدوال بالأزرار اللي بـ index.html (لازم تبقى هنا)
Object.assign(window, {
  applyReqAs,
  autoCalcN,
  handleDLChange,
  modBar,
  setBeamCase,
  setCondition,
  setMethod,
  setShape,
  toggleAuto,
  update,
  updateAllowables,
  updateMainUnknown,
});
