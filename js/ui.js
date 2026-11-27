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
$('polOff').onclick = () => { POL.active = false; $('locoCtl').hidden = true; $('polOff').hidden = true; $('polState').textContent = (POL.label || '정책') + ' 꺼짐. 다시 켜려면 정책을 다시 불러오세요.'; if (model) resetSim(); };
$('gaits').onclick = e => { const g = e.target.dataset && e.target.dataset.g; if (g) setGait(g); };
const DIRS = { f: { f: 1 }, b: { f: -1 }, l: { s: 1 }, r: { s: -1 }, tl: { t: 1 }, tr: { t: -1 }, x: {} };
const held = new Set();
function applyDirs() { const d = { f: 0, s: 0, t: 0 }; for (const k of held) Object.assign(d, Object.fromEntries(Object.entries(DIRS[k]).map(([a, v]) => [a, (d[a] || 0) + v]))); POL.dir = { f: Math.max(-1, Math.min(1, d.f)), s: Math.max(-1, Math.min(1, d.s)), t: Math.max(-1, Math.min(1, d.t)) }; document.querySelectorAll('#pad button').forEach(b => b.classList.toggle('on', held.has(b.dataset.d))); }
$('pad').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); if (b.dataset.d === 'x') held.clear(); else { held.add(b.dataset.d); try { b.setPointerCapture(e.pointerId); } catch (er) {} } applyDirs(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('pad').addEventListener(ev, e => { const b = e.target.closest && e.target.closest('button'); if (b) { held.delete(b.dataset.d); applyDirs(); } });
const KEYS = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', KeyQ: 'tl', KeyE: 'tr' };
addEventListener('keydown', e => { if (!POL.active || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const k = KEYS[e.code]; if (k) { e.preventDefault(); held.add(k); applyDirs(); } });
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
