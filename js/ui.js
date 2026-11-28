/* 버튼·키보드 이벤트 연결 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 이벤트 ---------- */
const toggle = (btn, on, a, b) => { btn.setAttribute('aria-pressed', on); if (a) btn.textContent = on ? a : b; };
$('playBtn').onclick = () => { running = !running; $('playBtn').textContent = running ? '일시정지' : '재생'; };
$('stepBtn').onclick = () => { if (!model) return; running = false; $('playBtn').textContent = '재생'; stepOnce(); };
$('resetBtn').onclick = () => { if (model) { showMsg(''); resetSim(); running = true; $('playBtn').textContent = '일시정지'; } };
$('pushBtn').onclick = () => { if (model) startPush(model.body_subtreemass[rootBody()] * 3, 0); };
$('speedSel').onchange = e => speed = +e.target.value;
$('followBtn').onclick = () => { follow = !follow; toggle($('followBtn'), follow); };
$('keySel').onchange = () => model && resetSim();
$('monSel').onchange = e => { monAct = +e.target.value; if (model) resetTiming(); };
$('showCol').onclick = () => { showCol = !showCol; toggle($('showCol'), showCol, '켬', '끔'); for (const o of geomObjs) if (o) o.visible = o.material.opacity > 0 && (o.userData.grp < 3 || showCol || o.userData.ground); };
$('showDecor').onclick = () => { showDecor = !showDecor; toggle($('showDecor'), showDecor, '켬', '끔'); for (const d of decor) d.o.visible = showDecor; };
$('cLoop').onclick = () => { const on = $('cLoop').getAttribute('aria-pressed') !== 'true'; toggle($('cLoop'), on, '켬', '끔'); if (model) resetTiming(); };
$('wOn').onclick = () => { const on = $('wOn').getAttribute('aria-pressed') !== 'true'; toggle($('wOn'), on, '켬', '끔'); C = cfg(); };
for (const id of ['cCtrl', 'cSens', 'cLat', 'cJit', 'cDrop', 'cSeed']) $(id).addEventListener('change', () => model && resetTiming());
for (const id of ['wAmp', 'wFreq']) $(id).addEventListener('input', () => C = cfg());
$('cPhys').addEventListener('change', e => { if (!model) return; const v = +e.target.value; if (v > 0) { model.opt.timestep = v / 1000; resetTiming(); } });
$('sceneSel').onchange = e => loadScene(e.target.value);
$('copyCsv').onclick = async () => {
  const L = T.log || []; if (!L.length) { $('csvNote').textContent = '아직 기록이 없습니다.'; return; }
  const f = v => isFinite(v) ? v.toFixed(6) : '';
  const csv = 'control_time,target,actual,observed,obs_age,sequence_id,sample_time,receive_time\n' + L.map(q => [f(q.t), f(q.tg), f(q.act), f(q.obs), f(q.age), q.seq, f(q.st), f(q.rt)].join(',')).join('\n');
  try { await navigator.clipboard.writeText(csv); $('csvNote').textContent = L.length + '행 복사됨'; } catch (e) { $('csvNote').textContent = '클립보드 접근이 막혔습니다.'; }
};
$('openBtn').onclick = $('pickZip').onclick = () => $('zipIn').click();
$('pickDir').onclick = () => $('dirIn').click();
$('zipIn').onchange = async e => { const f = e.target.files[0]; if (f) { try { await ingest(await fromZip(f), f.name); } catch (er) { showMsg('zip을 읽지 못했습니다: ' + (er.message || er)); } } e.target.value = ''; };
$('dirIn').onchange = async e => { if (e.target.files.length) await ingest(await fromList(e.target.files), e.target.files[0].webkitRelativePath.split('/')[0]); e.target.value = ''; };
$('presets').innerHTML = Object.keys(PRESETS).map(k => `<button data-p="${k}" aria-pressed="false">${k}</button>`).join('');
$('pSliders').innerHTML = P_ATTR.map((n, k) => `<div class="act"><div class="top"><label for="p${k}">${n}</label><span id="pv${k}"></span></div><input type="range" id="p${k}" min="0" max="100" step="1" data-k="${k}"></div>`).join('');
$('presets').onclick = e => { const p = e.target.dataset && e.target.dataset.p; if (!p) return; persona.v = [...PRESETS[p]]; persona.preset = p; syncPersonaUI(); };
$('pSliders').addEventListener('input', e => { const k = +e.target.dataset.k; if (isNaN(k)) return; persona.v[k] = +e.target.value; persona.preset = ''; $('pv' + k).textContent = persona.v[k]; document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', false)); drawRadar(); });
$('pOn').onclick = () => { persona.on = !persona.on; $('pOn').setAttribute('aria-pressed', persona.on); $('pOn').textContent = persona.on ? '성격 모드 켬' : '성격 모드 끔'; drawRadar(); };
$('freeze').onclick = () => { if (model) setFrozen(!frozen); };
const roRadar = new ResizeObserver(drawRadar); roRadar.observe($('radar'));
syncPersonaUI();
$('polBtn').onclick = () => $('polIn').click();
$('diagBtn').onclick = () => setDiag(!DIAG.on);
$('mapClear').onclick = () => { MAP.trail = []; MAP.dist = 0; MAP.falls = []; MAP.goal = null; MAP.reached = 0; $('mapHint').textContent = '지도를 탭하면 그 지점까지 걸어갑니다 (걷기 정책 필요)'; };
$('polIn').onchange = async e => { const f = e.target.files[0]; if (f) await loadPolicy(new Uint8Array(await f.arrayBuffer()), f.name); e.target.value = ''; };
$('polOff').onclick = () => { POL.active = false; $('locoCtl').hidden = true; $('polOff').hidden = true; updateJoy(); $('polState').textContent = (POL.label || '정책') + ' 꺼짐. 다시 켜려면 정책을 다시 불러오세요.'; if (model) resetSim(); };
$('gaits').onclick = e => { const g = e.target.dataset && e.target.dataset.g; if (g) setGait(g); };
const DIRS = { f: { f: 1 }, b: { f: -1 }, l: { s: 1 }, r: { s: -1 }, tl: { t: 1 }, tr: { t: -1 }, x: {} };
const held = new Set();
/* 화면 조이스틱: 아날로그 값(-1~1)을 키보드·패드 입력에 더함 */
const JOY = { mv: { x: 0, y: 0, id: null }, rt: { x: 0, id: null }, show: (() => { try { return localStorage.getItem('simu.joy') !== '0'; } catch (e) { return true; } })() };
const joyActive = () => JOY.mv.id !== null || JOY.rt.id !== null;
function updateJoy() {
  $('joyBtn').hidden = !POL.active; toggle($('joyBtn'), JOY.show);
  $('vjoy').hidden = !(POL.active && JOY.show);
  if ($('vjoy').hidden) { Object.assign(JOY.mv, { x: 0, y: 0, id: null }); Object.assign(JOY.rt, { x: 0, id: null }); applyDirs(); }
  placeJoy();
}
function placeJoy() { $('vjoy').style.bottom = ($('bar').hidden ? 12 : $('bar').offsetHeight + 22) + 'px'; }
function bindStick(el, st, axisY) {
  const knob = el.querySelector('i');
  const set = (nx, ny) => { st.x = nx; if (axisY) st.y = ny; const r = (Math.min(el.clientWidth, axisY ? el.clientHeight : el.clientWidth) - knob.offsetWidth) / 2; knob.style.transform = `translate(${nx * r}px, ${axisY ? -ny * r : 0}px)`; applyDirs(); };
  const move = e => {
    const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const rx = (b.width - knob.offsetWidth) / 2, ry = axisY ? (b.height - knob.offsetHeight) / 2 : 1;
    let nx = (e.clientX - cx) / rx, ny = axisY ? -(e.clientY - cy) / ry : 0; const m = Math.hypot(nx, ny);
    if (m > 1) { nx /= m; ny /= m; }
    const dz = 0.15, mm = Math.hypot(nx, ny); if (mm < dz) { nx = 0; ny = 0; } else { const k = (mm - dz) / (1 - dz) / mm; nx *= k; ny *= k; }
    set(nx, ny);
  };
  el.addEventListener('pointerdown', e => { e.preventDefault(); st.id = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (er) {} el.classList.add('on'); if (MAP.goal) { MAP.goal = null; $('mapHint').textContent = '조이스틱으로 직접 조작 중입니다.'; } move(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === st.id) move(e); });
  const end = e => { if (e.pointerId !== st.id) return; st.id = null; el.classList.remove('on'); set(0, 0); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindStick($('stMove'), JOY.mv, true);
bindStick($('stTurn'), JOY.rt, false);
$('joyBtn').onclick = () => { JOY.show = !JOY.show; try { localStorage.setItem('simu.joy', JOY.show ? '1' : '0'); } catch (e) {} updateJoy(); };
document.querySelector('.vgait').onclick = e => { const g = e.target.dataset && e.target.dataset.g; if (g) setGait(g); };
new ResizeObserver(placeJoy).observe($('bar'));
function applyDirs() { const d = { f: 0, s: 0, t: 0 }; for (const k of held) Object.assign(d, Object.fromEntries(Object.entries(DIRS[k]).map(([a, v]) => [a, (d[a] || 0) + v]))); d.f += JOY.mv.y; d.s -= JOY.mv.x; d.t -= JOY.rt.x; POL.dir = { f: Math.max(-1, Math.min(1, d.f)), s: Math.max(-1, Math.min(1, d.s)), t: Math.max(-1, Math.min(1, d.t)) }; }
const KEYS = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyQ: 'tl', KeyE: 'tr' };
addEventListener('keydown', e => { if (!POL.active || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.getAttribute('role') === 'tab') return; const k = KEYS[e.code]; if (k) { e.preventDefault(); held.add(k); applyDirs(); } });
addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) { held.delete(k); applyDirs(); } });
addEventListener('blur', () => { held.clear(); applyDirs(); });
const drop = $('drop');
for (const ev of ['dragenter', 'dragover']) view.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); });
view.addEventListener('dragleave', () => drop.classList.remove('over'));
view.addEventListener('drop', async e => {
  e.preventDefault(); drop.classList.remove('over');
  const f = [...e.dataTransfer.files].find(x => /\.zip$/i.test(x.name));
  if (f) await ingest(await fromZip(f), f.name); else showMsg('zip 파일을 놓아 주세요.');
});

/* 탭 패널 공통: 아래 분석 패널(스코프·관제·실험)과 오른쪽 제어 패널 */
function makeTabs(listEl, names, tabPrefix, panePrefix, key, onSelect) {
  const select = (name, focus) => {
    if (!names.includes(name)) name = names[0];
    for (const t of names) { const tab = $(tabPrefix + t), on = t === name; tab.setAttribute('aria-selected', on); tab.tabIndex = on ? 0 : -1; $(panePrefix + t).hidden = !on; }
    if (focus) $(tabPrefix + name).focus();
    try { localStorage.setItem(key, name); } catch (e) {}
    if (onSelect) onSelect(name);
  };
  listEl.addEventListener('click', e => { const t = e.target.closest('[role=tab]'); if (t) select(t.dataset.tab); });
  listEl.addEventListener('keydown', e => {
    const i = names.indexOf(document.activeElement.dataset.tab); if (i < 0) return;
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: names.length - 1 }[e.key];
    if (n === undefined) return; e.preventDefault(); select(names[(n + names.length) % names.length], true);
  });
  let saved = null; try { saved = localStorage.getItem(key); } catch (e) {}
  select(saved || names[0]);
  return select;
}
const selectTab = makeTabs(document.querySelector('.tablist:not(.side)'), ['scope', 'map', 'exp'], 'tab-', 'pane-', 'simu.tab', name => {
  if (name === 'exp' && !EXP.running) $('expBadge').hidden = true;
  if (name === 'map') $('mapBadge').hidden = true;
  requestAnimationFrame(() => { drawScope(); drawMap(); if (EXP.summary.length && EXP.meta) renderResults(EXP.meta.cfg); });
});
const selectSideTab = makeTabs(document.querySelector('.tablist.side'), ['walk', 'persona', 'cond', 'joint', 'diag', 'set'], 'stab-', 'spane-', 'simu.stab', name => {
  if (name === 'persona') requestAnimationFrame(drawRadar);
  if (name === 'diag') $('diagBadge').hidden = true;
});
$('diagOn2').onclick = () => setDiag(true);
$('closeBtn').onclick = closeModel;
$('loadDefault').onclick = () => loadDefaultModel();
$('autoLoad').onclick = () => { const on = $('autoLoad').getAttribute('aria-pressed') !== 'true'; toggle($('autoLoad'), on, '켬', '끔'); };
