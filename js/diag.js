/* 진단 모드 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 진단 모드 ---------- */
const DIAG = { on: false, ev: [], st: {}, wasUp: true, pow: 0 };
function logEv(text, level) { DIAG.ev.unshift({ t: data ? data.time : 0, text, level }); if (DIAG.ev.length > 40) DIAG.ev.pop(); if (DIAG.on) renderEv(); }
function renderEv() { $('dEv').innerHTML = DIAG.ev.length ? DIAG.ev.map(e => `<div><span>${e.t.toFixed(2)}s</span><span style="color:${e.level === 'e' ? 'var(--red)' : e.level === 'w' ? 'var(--amber)' : 'var(--ink)'}">${esc(e.text)}</span></div>`).join('') : '<div><span></span><span>아직 이벤트가 없습니다.</span></div>'; }
function diagUpdate() {
  const A = mj.mjtObj.mjOBJ_ACTUATOR.value, rows = []; let warn = 0, maxLoad = 0, maxName = '', pow = 0;
  const lc = new THREE.Color(0x26282b), amber = new THREE.Color(0xf2a541), red = new THREE.Color(0xe5484d), green = new THREE.Color(0x2fbf9b);
  for (let i = 0; i < model.nu; i++) {
    const n = name(A, i), j = model.actuator_trnid[2 * i], q = data.actuator_length[i], v = data.actuator_velocity[i], f = data.actuator_force[i];
    const fr = model.actuator_forcelimited[i] ? Math.max(Math.abs(model.actuator_forcerange[2 * i]), Math.abs(model.actuator_forcerange[2 * i + 1])) : 0;
    const load = fr ? Math.abs(f) / fr : 0, err = data.ctrl[i] - q; pow += Math.abs(f * v);
    let lim = false; if (j >= 0 && model.jnt_limited[j]) { const lo = model.jnt_range[2 * j], hi = model.jnt_range[2 * j + 1]; lim = Math.min(q - lo, hi - q) < 0.03 * (hi - lo); }
    const flags = { 포화: load > 0.95, 한계: lim, 과속: Math.abs(v) > 5.24, '추종 실패': Math.abs(err) > 15 * Math.PI / 180 };
    for (const [k, on] of Object.entries(flags)) { const key = i + k, t = data.time; if (!on) { DIAG.st[key] = null; continue; } if (DIAG.st[key] == null) DIAG.st[key] = { t0: t, done: false }; const S = DIAG.st[key]; if (!S.done && t - S.t0 >= 0.3) { S.done = true; logEv(`${n} ${k} (${k === '포화' ? Math.round(load * 100) + '%' : k === '과속' ? v.toFixed(1) + ' rad/s' : k === '추종 실패' ? (err * 180 / Math.PI).toFixed(1) + '°' : '범위 끝'})`, k === '포화' || k === '과속' ? 'e' : 'w'); } }
    const nw = Object.values(flags).filter(Boolean).length; warn += nw;
    if (load > maxLoad) { maxLoad = load; maxName = n; }
    rows.push(`<tr class="${flags.포화 || flags.과속 ? 'e' : nw ? 'w' : ''}"><td>${esc(n)}</td><td>${(q * 180 / Math.PI).toFixed(1)}</td><td>${(err * 180 / Math.PI).toFixed(1)}</td><td>${v.toFixed(2)}</td><td>${Math.round(load * 100)}%<span class="lbar"><i style="width:${Math.min(100, load * 100)}%;background:${load > 0.95 ? 'var(--red)' : load > 0.7 ? 'var(--amber)' : 'var(--teal)'}"></i></span></td></tr>`);
    for (const d of decor) if (d.act === i) d.o.material.color.copy(load > 0.7 ? amber.clone().lerp(red, Math.min(1, (load - 0.7) / 0.25)) : lc.clone().lerp(green, Math.min(1, load / 0.7) * 0.85));
  }
  DIAG.pow = DIAG.pow * 0.8 + pow * 0.2;
  $('dRows').innerHTML = rows.join('');
  $('dWarn').textContent = warn; $('dWarn').style.color = warn ? 'var(--amber)' : '';
  $('dLoad').textContent = `${Math.round(maxLoad * 100)}% ${maxName}`; $('dPow').textContent = DIAG.pow.toFixed(2) + ' W';
  $('dCon').textContent = `${data.ncon} · ${MAP.falls.length}`;
}
function setDiag(on) {
  DIAG.on = on; toggle($('diagBtn'), on); $('diagBox').hidden = !on; $('diagOff').hidden = on;
  if (on) { renderEv(); if ($('spane-diag').hidden) selectSideTab('diag'); }
  else for (const d of decor) if (d.act !== undefined) d.o.material.color.set(0x26282b);
  drawRadar();
}

