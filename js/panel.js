/* 액추에이터·센서 패널 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 패널 ---------- */
const name = (type, i) => { const n = mj.mj_id2name(model, type, i); return n || ('#' + i); };
function actRange(i) { return model.actuator_ctrllimited[i] ? [model.actuator_ctrlrange[2 * i], model.actuator_ctrlrange[2 * i + 1]] : [-1, 1]; }
function monJoint() {
  if (!model.nu) return null;
  const j = model.actuator_trnid[2 * monAct], t = model.actuator_trntype[monAct];
  if (t !== 0 || j < 0) return null;
  const jt = model.jnt_type[j]; if (jt !== 2 && jt !== 3) return null;
  return { adr: model.jnt_qposadr[j], dof: model.jnt_dofadr[j] };
}
function buildPanel() {
  const m = model, A = mj.mjtObj.mjOBJ_ACTUATOR.value;
  $('nAct').textContent = m.nu + '개';
  $('cPhys').value = +(m.opt.timestep * 1000).toFixed(3);
  $('keySel').innerHTML = m.nkey ? Array.from({ length: m.nkey }, (_, k) => `<option value="${k}">${esc(name(mj.mjtObj.mjOBJ_KEY.value, k))}</option>`).join('') : '<option value="-1">없음 (기본 자세)</option>';
  $('monSel').innerHTML = m.nu ? Array.from({ length: m.nu }, (_, i) => `<option value="${i}">${esc(name(A, i))}</option>`).join('') : '<option>액추에이터 없음</option>';
  const pref = Array.from({ length: m.nu }, (_, i) => name(A, i)).findIndex(n => /head_yaw/i.test(n));
  monAct = pref >= 0 ? pref : 0; $('monSel').value = monAct;
  $('acts').innerHTML = m.nu ? Array.from({ length: m.nu }, (_, i) => {
    const [lo, hi] = actRange(i);
    return `<div class="act"><div class="top"><label for="a${i}">${esc(name(A, i))}</label><span id="av${i}"></span></div><input type="range" id="a${i}" min="${lo}" max="${hi}" step="${(hi - lo) / 400}" data-i="${i}"></div>`;
  }).join('') : '<p class="note">이 모델에는 액추에이터가 없습니다. 중력과 접촉만으로 움직입니다.</p>';
  const S = mj.mjtObj.mjOBJ_SENSOR.value;
  $('sens').innerHTML = m.nsensor ? Array.from({ length: m.nsensor }, (_, i) => `<span>${esc(name(S, i))}</span><span id="s${i}">–</span>`).join('') : '<span>센서 없음</span><span></span>';
  const integ = ['Euler', 'RK4', 'implicit', 'implicitfast'][m.opt.integrator] || m.opt.integrator;
  $('stats').innerHTML = [['바디', m.nbody], ['관절', m.njnt], ['자유도', m.nv], ['액추에이터', m.nu], ['센서', m.nsensor], ['지오메트리', m.ngeom], ['메쉬', m.nmesh], ['timestep', (m.opt.timestep * 1000).toFixed(2) + ' ms'], ['적분기', integ]].map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('');
  $('hInfo').textContent = `${m.nbody - 1} 바디 · ${m.nu} 액추에이터`;
  classify();
  const found = Object.keys(ROLE_NAME).map(r => [ROLE_NAME[r], roles.map((x, i) => x === r ? name(A, i) : null).filter(Boolean)]).filter(x => x[1].length);
  $('roles').textContent = found.length ? '연결된 관절 — ' + found.map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ') : '이 모델에서는 이름으로 머리·목·다리 관절을 찾지 못해, 성격 모드가 움직임에 반영되지 않습니다.';
}
$('acts').addEventListener('input', e => { const i = +e.target.dataset.i; if (isNaN(i)) return; base[i] = +e.target.value; $('av' + i).textContent = base[i].toFixed(3); });
function syncSliders() { for (let i = 0; i < model.nu; i++) { const s = $('a' + i); if (s) { s.value = base[i]; $('av' + i).textContent = base[i].toFixed(3); } } }

