/* 타이밍 주입 설정과 리셋 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 시뮬레이션 + 타이밍 ---------- */
let T = {}, rng = Math.random;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cfg = () => ({ ctrl: Math.max(1, +$('cCtrl').value) / 1000, sens: Math.max(1, +$('cSens').value) / 1000, lat: Math.max(0, +$('cLat').value) / 1000, jit: Math.max(0, +$('cJit').value) / 1000, drop: Math.min(100, Math.max(0, +$('cDrop').value)) / 100, seed: +$('cSeed').value || 1, loop: $('cLoop').getAttribute('aria-pressed') === 'true', wOn: $('wOn').getAttribute('aria-pressed') === 'true', amp: +$('wAmp').value || 0, freq: +$('wFreq').value || 0 });
let C = cfg();
function resetTiming() {
  C = cfg(); rng = mulberry(C.seed);
  T = { seq: 0, nextS: data ? data.time : 0, nextC: data ? data.time : 0, q: [], obs: null, rows: [], log: [], samples: 0, dropped: 0, lats: [], drops: [], cmd: null };
}
function resetSim() {
  const k = +$('keySel').value;
  if (k >= 0 && model.nkey) mj.mj_resetDataKeyframe(model, data, k); else mj.mj_resetData(model, data);
  base = Array.from({ length: model.nu }, (_, i) => model.nkey && k >= 0 ? model.key_ctrl[k * model.nu + i] : (model.actuator_ctrllimited[i] ? Math.min(Math.max(0, actRange(i)[0]), actRange(i)[1]) : 0));
  syncSliders(); mj.mj_forward(model, data); resetTiming(); syncScene();
  smooth = [...base]; gaze = { y: 0, p: 0, next: 0.5 }; if (frozen) setFrozen(false);
  repClear(); PUSH.until = -1; SCN.next = data.time + SCN.every;
  MAP.trail = []; MAP.dist = 0; MAP.goal = null; DIAG.wasUp = true; DIAG.st = {};
  if (POL.active) policyReset();
}
function target(t) { const b = base[monAct] ?? 0; if (!C.wOn) return b; const [lo, hi] = actRange(monAct); return Math.min(hi, Math.max(lo, b + C.amp * Math.sin(2 * Math.PI * C.freq * t))); }
