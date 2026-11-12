/**
 * soil-engine.js - يربط المحرك ببيانات الوحدة (معادلات الأطوار + أتربرغ)
 */
import equations from '../data/equations.json';
import variables from '../data/variables.json';
import constantsData from '../data/constants.json';
import { createSolver } from './solver.js';

// المتغيرات التي تُخزَّن كنسبة عشرية داخلياً (50% = 0.5)
export const PERCENT_KEYS = ['n', 'S', 'na', 'ac', 'w', 'LL', 'PL', 'PI', 'ws', 'clayPercent'];

// نطاقات الحل العددي (القسم 3.3 بند 3)
const unit01 = { lo: 0, hi: 1 };
export const RANGES = {
  n: unit01, S: unit01, na: unit01, ac: unit01,
  w: { lo: 0, hi: 20 }, e: { lo: 0, hi: 50 }, G: { lo: 1, hi: 5 }, Gm: { lo: 0.5, hi: 5 },
  LL: { lo: 0, hi: 20 }, PL: { lo: 0, hi: 20 }, PI: { lo: 0, hi: 20 }, ws: { lo: 0, hi: 20 },
  LI: { lo: -50, hi: 50 }, CI: { lo: -50, hi: 50 }, A: { lo: 0, hi: 100 },
  clayPercent: { lo: 1e-6, hi: 1, geometric: true }
};

export function makeSoilSolver(gammaW = constantsData[0].value) {
  return createSolver({ equations, constants: { gamma_w: gammaW }, ranges: RANGES });
}

// خريطة المفتاح إلى الرمز للعرض (γd بدل gamma_d ...)
export const SYMBOLS = Object.fromEntries(variables.map((v) => [v.key, v.symbol.replace(/\s*\(.*\)/, '')]));
SYMBOLS.gamma_w = 'γw';
Object.assign(SYMBOLS, { ws: 'SL', clayPercent: 'Clay%' });

export { equations, variables };