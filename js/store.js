/* 설정 저장: 브라우저 자동 저장 + JSON 내보내기/가져오기, 파일 내려받기 도우미 — 클래식 스크립트 */
const STORE_KEY = 'simu.settings.v1';
const S_INPUTS = ['cCtrl', 'cSens', 'cLat', 'cJit', 'cDrop', 'cSeed', 'wAmp', 'wFreq', 'sFric', 'sSlope', 'sEvery', 'sForce', 'eLats', 'eDrop', 'eJit', 'eSeeds', 'eDur', 'eCmd', 'speedSel'];
const S_TOGGLES = ['cLoop', 'wOn', 'showDecor', 'showCol', 'sPush', 'eScn', 'followBtn', 'autoLoad', 'gvShow'];
let storeReady = false, saveTimer = 0;

function download(name, text, type = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function collectSettings() {
  return {
    version: 1, savedAt: new Date().toISOString(),
    inputs: Object.fromEntries(S_INPUTS.filter(id => $(id)).map(id => [id, $(id).value])),
    toggles: Object.fromEntries(S_TOGGLES.filter(id => $(id)).map(id => [id, $(id).getAttribute('aria-pressed') === 'true'])),
    persona: { on: persona.on, v: [...persona.v], preset: persona.preset },
    gait: POL.gait, userFric: SCN.userFric
  };
}
function applySettings(o) {
  if (!o || typeof o !== 'object') return false;
  storeReady = false;
  for (const [id, v] of Object.entries(o.inputs || {})) { const el = $(id); if (!el || !S_INPUTS.includes(id)) continue; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  for (const [id, v] of Object.entries(o.toggles || {})) { const el = $(id); if (!el || !S_TOGGLES.includes(id)) continue; if ((el.getAttribute('aria-pressed') === 'true') !== !!v) el.click(); }
  if (o.persona && Array.isArray(o.persona.v) && o.persona.v.length === 6) {
    persona.v = o.persona.v.map(x => Math.min(100, Math.max(0, +x || 0))); persona.preset = String(o.persona.preset || '');
    if (persona.on !== !!o.persona.on) $('pOn').click();
    syncPersonaUI();
  }
  if (o.gait && GAITS[o.gait]) POL.gait = o.gait;
  SCN.userFric = !!o.userFric; applyScenario();
  storeReady = true; return true;
}
function saveSettings() { if (!storeReady) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(collectSettings())); $('storeState').textContent = '이 브라우저에 자동 저장됨 · ' + new Date().toLocaleTimeString(); } catch (e) { $('storeState').textContent = '이 브라우저에서는 자동 저장을 쓸 수 없습니다.'; } }
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSettings, 400); }
function loadStoredSettings() {
  try { const t = localStorage.getItem(STORE_KEY); if (t) { applySettings(JSON.parse(t)); $('storeState').textContent = '저장된 설정을 불러왔습니다.'; } } catch (e) {}
  storeReady = true;
}
for (const ev of ['input', 'change', 'click']) document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('aside, .scope, .bar')) scheduleSave(); });
$('setExport').onclick = () => download('simu-settings.json', JSON.stringify(collectSettings(), null, 2), 'application/json');
$('setImport').onclick = () => $('setIn').click();
$('setIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { applySettings(JSON.parse(await f.text())) ? ($('storeState').textContent = f.name + ' 적용됨') : null; saveSettings(); } catch (er) { $('storeState').textContent = '설정 파일을 읽지 못했습니다: ' + er.message; } };
$('setReset').onclick = () => { try { localStorage.removeItem(STORE_KEY); } catch (e) {} location.reload(); };
$('dlCsv').onclick = () => { const L = T.log || []; if (!L.length) { $('csvNote').textContent = '아직 기록이 없습니다.'; return; } const f = v => isFinite(v) ? v.toFixed(6) : ''; download(`simu-timing-${Date.now()}.csv`, 'control_time,target,actual,observed,obs_age,sequence_id,sample_time,receive_time\n' + L.map(q => [f(q.t), f(q.tg), f(q.act), f(q.obs), f(q.age), q.seq, f(q.st), f(q.rt)].join(',')).join('\n'), 'text/csv'); };
