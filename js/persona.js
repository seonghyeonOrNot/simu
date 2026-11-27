/* 성격·감정 레이어 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 성격·감정 레이어 ---------- */
const P_ATTR = ['활력', '호기심', '불안', '단호함', '장난기', '침착함'];
const PRESETS = { 평온: [35, 30, 10, 30, 25, 80], 호기심: [60, 90, 15, 25, 40, 50], 불안: [55, 40, 90, 10, 5, 15], 장난: [80, 55, 10, 20, 95, 30], 경계: [45, 35, 40, 90, 5, 70], 흥분: [95, 60, 30, 50, 70, 10] };
const ROLE_NAME = { hyaw: '머리 좌우', hpitch: '머리 끄덕임', hroll: '머리 기울임', neck: '목', leg: '다리 자세' };
let persona = { on: true, v: [...PRESETS.평온], preset: '평온' }, frozen = false, frozenPose = [], roles = [], smooth = [], gaze = { y: 0, p: 0, next: 0 };
function classify() {
  const A = mj.mjtObj.mjOBJ_ACTUATOR.value;
  roles = Array.from({ length: model.nu }, (_, i) => {
    const n = name(A, i);
    if (/head.*yaw|neck.*yaw|yaw.*head/i.test(n)) return 'hyaw';
    if (/head.*roll|neck.*roll/i.test(n)) return 'hroll';
    if (/head.*pitch|nod/i.test(n)) return 'hpitch';
    if (/neck/i.test(n)) return 'neck';
    if (/knee|hip.*pitch|ankle/i.test(n)) return 'leg';
    return '';
  });
}
function personaOffsets(t) {
  const [E, Cu, A, Ag, Pl] = persona.v.map(x => x / 100), TAU = 2 * Math.PI;
  if (t >= gaze.next) {
    gaze.next = t + Math.max(0.35, (2.6 - 1.3 * E - 0.8 * Cu - 0.7 * A) * (0.6 + 0.8 * Math.random()));
    const span = (0.08 + 0.55 * Cu + 0.25 * A) * (1 - 0.6 * Ag);
    gaze.y = (Math.random() * 2 - 1) * span; gaze.p = (Math.random() * 2 - 1) * (0.04 + 0.22 * Cu) + 0.08 * Cu;
  }
  const amp = 0.6 + 0.6 * E, tremor = A * 0.035 * Math.sin(TAU * 7.5 * t);
  const breath = (0.012 + 0.02 * E + 0.025 * A) * Math.sin(TAU * (0.25 + 0.35 * E + 0.5 * A) * t);
  const bounce = Pl * 0.07 * Math.max(0, Math.sin(TAU * (1.1 + 0.9 * E) * t));
  const crouch = 0.2 * A - 0.06 * Ag + breath + bounce;
  return roles.map((r, i) => {
    if (r === 'hyaw') return amp * gaze.y + tremor;
    if (r === 'hpitch') return amp * (gaze.p - 0.3 * Ag + Pl * 0.12 * Math.sin(TAU * (0.9 + E) * t)) + tremor * 0.6;
    if (r === 'hroll') return amp * Pl * 0.35 * Math.sin(TAU * (0.5 + 0.8 * E) * t);
    if (r === 'neck') return 0.3 * Ag - 0.3 * A + breath;
    if (r === 'leg') return base[i] * crouch;
    return 0;
  });
}
function controlTick(t, dtc) {
  if (POL.active && !frozen) { for (let i = 0; i < model.nu; i++) smooth[i] = POL.mt[i]; return; }
  const off = persona.on && !frozen ? personaOffsets(t) : null;
  const tau = persona.on && !frozen ? 0.02 + 0.35 * persona.v[5] / 100 : 0.05;
  for (let i = 0; i < model.nu; i++) {
    let v = frozen ? frozenPose[i] : base[i] + (off ? off[i] : 0);
    if (i === monAct && C.wOn && !frozen) v = target(t) + (off ? off[i] : 0);
    const [lo, hi] = actRange(i); v = Math.min(hi, Math.max(lo, v));
    smooth[i] = smooth[i] === undefined ? v : smooth[i] + (v - smooth[i]) * Math.min(1, dtc / tau);
  }
}
function moodOf(v) {
  const [E, Cu, A, Ag, Pl, Ca] = v.map(x => x / 100);
  const ar = Math.min(1, Math.max(0, 0.45 * E + 0.3 * A + 0.15 * Pl + 0.15 * Ag - 0.25 * Ca + 0.15));
  const va = Math.min(1, Math.max(0, 0.5 + 0.35 * Pl + 0.2 * Cu - 0.5 * A - 0.2 * Ag));
  const q = ar >= 0.5 ? (va >= 0.5 ? '들뜸' : '긴장') : (va >= 0.5 ? '평온' : '가라앉음');
  const top = v.indexOf(Math.max(...v));
  return { ar, va, label: `${P_ATTR[top]}${top === 4 ? '가' : '이'} 앞선 ${q}` };
}
function drawRadar() {
  const s = $('radar'), W = s.clientWidth || 260, H = s.clientHeight || 200, cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 26;
  const pt = (k, r) => { const a = -Math.PI / 2 + k * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let g = '';
  for (const f of [0.33, 0.66, 1]) g += `<polygon points="${P_ATTR.map((_, k) => pt(k, R * f).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`;
  P_ATTR.forEach((n, k) => { const [x, y] = pt(k, R), [lx, ly] = pt(k, R + 14); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="11" fill="var(--mute)">${n}</text>`; });
  const poly = persona.v.map((v, k) => pt(k, R * v / 100).join(',')).join(' ');
  g += `<polygon points="${poly}" fill="color-mix(in srgb,var(--teal) 22%,transparent)" stroke="var(--teal)" stroke-width="2"/>`;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.innerHTML = g;
  const m = moodOf(persona.v);
  $('mood').textContent = m.label; $('moodNums').textContent = `각성 ${Math.round(m.ar * 100)} · 정서 ${m.va >= 0.5 ? '+' : ''}${Math.round((m.va - 0.5) * 200)}`;
  $('tag').textContent = DIAG.on ? '진단 모드' : frozen ? '동작 정지됨' : persona.on ? m.label : '성격 모드 꺼짐';
}
function syncPersonaUI() {
  persona.v.forEach((v, k) => { $('p' + k).value = v; $('pv' + k).textContent = v; });
  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === persona.preset));
  drawRadar();
}
function setFrozen(on) {
  frozen = on;
  if (on && model) frozenPose = Array.from({ length: model.nu }, (_, i) => {
    const j = model.actuator_trnid[2 * i], jt = j >= 0 ? model.jnt_type[j] : -1;
    return model.actuator_trntype[i] === 0 && (jt === 2 || jt === 3) ? data.qpos[model.jnt_qposadr[j]] : data.ctrl[i];
  });
  $('freeze').textContent = on ? '동작 재개' : '모든 동작 정지'; $('freeze').setAttribute('aria-pressed', on);
  drawRadar();
}

