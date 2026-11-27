/* 지형·외란 시나리오: 바닥 마찰, 경사, 주기적 밀기 — 클래식 스크립트 */
const SCN = { fric: 0.6, slope: 0, pushOn: false, every: 3, force: 4, next: 0, userFric: false };
const PUSH = { until: -1, fx: 0, fy: 0, active: false };
const worldG = new THREE.Group(); scene.add(worldG); worldG.add(root, deco);

function groundGeoms() { const out = []; if (!model) return out; for (let g = 0; g < model.ngeom; g++) if (model.geom_type[g] <= 1) out.push(g); return out; }

function readScenarioUI() {
  SCN.fric = +$('sFric').value; SCN.slope = +$('sSlope').value;
  SCN.pushOn = $('sPush').getAttribute('aria-pressed') === 'true';
  SCN.every = Math.max(0.5, +$('sEvery').value || 3); SCN.force = Math.max(0, +$('sForce').value || 0);
  $('sFricV').textContent = SCN.fric.toFixed(2); $('sSlopeV').textContent = (SCN.slope > 0 ? '+' : '') + SCN.slope.toFixed(1) + '°';
}

/* onLoad: 새 모델을 불러왔을 때. 사용자가 마찰을 직접 바꾼 적이 없으면 모델 값으로 슬라이더를 맞춤 */
function applyScenario(onLoad) {
  if (onLoad && model) SCN.orig = groundGeoms().map(g => model.geom_friction[3 * g]);
  if (onLoad && model && !SCN.userFric) { const g = groundGeoms()[0]; if (g !== undefined) $('sFric').value = model.geom_friction[3 * g].toFixed(2); }
  readScenarioUI();
  if (!model) return;
  for (const g of groundGeoms()) model.geom_friction[3 * g] = SCN.fric;
  const th = SCN.slope * Math.PI / 180, gv = model.opt.gravity, G = 9.81;
  gv[0] = -G * Math.sin(th); gv[1] = 0; gv[2] = -G * Math.cos(th);
  worldG.rotation.set(0, -th, 0); worldG.updateMatrixWorld(true);
  if (data) SCN.next = data.time + SCN.every;
}

function startPush(fx, fy) { if (!data) return; PUSH.until = data.time + 0.1; PUSH.fx = fx; PUSH.fy = fy; PUSH.active = true; }

/* 매 물리 스텝마다 호출: 주기적 밀기 스케줄 + 진행 중인 밀기 힘 적용 */
function pushStep(t) {
  const rb = rootBody(), xf = data.xfrc_applied;
  if (SCN.pushOn && t >= SCN.next) {
    const a = Math.random() * 2 * Math.PI; startPush(SCN.force * Math.cos(a), SCN.force * Math.sin(a));
    SCN.next = t + SCN.every; logEv(`외란: ${SCN.force}N 밀기 (방향 ${Math.round(a * 180 / Math.PI)}°)`, 'w');
  }
  if (t < PUSH.until) { xf[6 * rb] = PUSH.fx; xf[6 * rb + 1] = PUSH.fy; }
  else if (PUSH.active) { xf[6 * rb] = 0; xf[6 * rb + 1] = 0; PUSH.active = false; }
}

$('sFric').addEventListener('input', () => { SCN.userFric = true; applyScenario(); });
$('sSlope').addEventListener('input', () => applyScenario());
for (const id of ['sEvery', 'sForce']) $(id).addEventListener('change', () => applyScenario());
$('sPush').onclick = () => { const on = $('sPush').getAttribute('aria-pressed') !== 'true'; toggle($('sPush'), on, '켬', '끔'); applyScenario(); };
$('sReset').onclick = () => { SCN.userFric = false; $('sSlope').value = 0; if ($('sPush').getAttribute('aria-pressed') === 'true') $('sPush').click(); applyScenario(true); };
readScenarioUI();
