/**
 * state.js - حالة مشتركة بين تبويبات وحدة ميكانيك التربة (تبقى عند التنقل بين التبويبات)
 */
export const soilState = {
  laws: { inputs: {}, units: {}, gammaW: '9.81' },
  grain: {
    mode: 'masses',
    rows: ['4', '10', '20', '40', '60', '100', '200'].map((no) => ({ no, mass: '' })),
    pan: '',
    points: [{ mm: '', finer: '' }],
    system: 'MIT',
    manual: { D10: '', D30: '', D60: '' },
    hydro: { rhoS: '2.65', eta: '1.002', D: '0.01' }
  },
  detect: { inputs: {} }   // تملؤها «أرسل إلى كشف التربة» وتقرؤها واجهة الكشف (S6)
};