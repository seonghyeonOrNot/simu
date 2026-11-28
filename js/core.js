/* 공유 상태, 렌더러, 파일 불러오기, 모델 컴파일 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
const $ = id => document.getElementById(id);
let mj = null, model = null, data = null, files = {}, loadN = 0;
let running = true, speed = 1, follow = true, showCol = false;
let geomObjs = [], base = [], monAct = 0, pushUntil = -1;
const HIST = 6;

const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.up.set(0, 0, 1); camera.position.set(0.8, -0.8, 0.5);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 0, 0.1); orbit.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x445055, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2, -3, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 20 });
scene.add(sun, sun.target);
const root = new THREE.Group(); scene.add(root);
const deco = new THREE.Group(); scene.add(deco);
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
const bgCol = () => scene.background = new THREE.Color(dark() ? 0x0c0e10 : 0xe7eae8);
bgCol();
new MutationObserver(bgCol).observe(document.documentElement, { attributes: true });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', bgCol);

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
const roView = new ResizeObserver(resize); roView.observe(view);

function showMsg(t) { const m = $('msg'); m.style.color = ''; m.style.background = ''; m.textContent = t || ''; m.style.display = t ? 'block' : 'none'; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

loadMujoco().then(m => { mj = m; $('loadState').textContent = 'MuJoCo ' + (mj.mj_versionString ? mj.mj_versionString() : '') + ' 준비됨'; })
  .catch(e => { $('loadState').textContent = (/claude\.ai|claudeusercontent/.test(location.hostname) ? '이 claude.ai 페이지에서는 보안 정책상 물리 엔진(wasm)을 받을 수 없습니다. GitHub Pages 주소나 로컬 파일로 열어 주세요. (' : '물리 엔진을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. (') + (e.message || e) + ')'; });

async function waitMj() { while (!mj) await new Promise(r => setTimeout(r, 100)); }

async function fromZip(file) {
  const zip = await JSZip.loadAsync(file); const out = {};
  const ents = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(f.name));
  for (const f of ents) out[f.name] = await f.async('uint8array');
  return out;
}
async function fromList(list) {
  const out = {};
  for (const f of list) { const p = f.webkitRelativePath || f.name; if (/\.DS_Store$/.test(p)) continue; out[p] = new Uint8Array(await f.arrayBuffer()); }
  return out;
}
function stripRoot(fs) {
  const keys = Object.keys(fs); if (!keys.length) return fs;
  const first = keys[0].split('/')[0];
  if (keys.every(k => k.includes('/') && k.split('/')[0] === first)) { const o = {}; for (const k of keys) o[k.slice(first.length + 1)] = fs[k]; return o; }
  return fs;
}
async function ingest(fs, label) {
  await waitMj(); showMsg('');
  files = stripRoot(fs);
  const dec = new TextDecoder();
  const xmls = Object.keys(files).filter(k => /\.xml$/i.test(k) && /<mujoco[\s>]/.test(dec.decode(files[k].slice(0, 4000))));
  if (!xmls.length) { showMsg('zip 안에서 <mujoco>로 시작하는 XML을 찾지 못했습니다.'); return; }
  const included = new Set();
  for (const k of xmls) for (const m of dec.decode(files[k]).matchAll(/<include\s+file="([^"]+)"/g)) included.add(m[1].split('/').pop());
  const score = k => (/scene/i.test(k) ? 0 : 2) + (included.has(k.split('/').pop()) ? 4 : 0) + (/rough|backlash/i.test(k) ? 1 : 0);
  xmls.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  const sel = $('sceneSel'); sel.innerHTML = xmls.map(k => `<option>${esc(k)}</option>`).join(''); sel.hidden = xmls.length < 2;
  $('files').textContent = Object.keys(files).length + '개 파일 · ' + Object.keys(files).join(', ');
  $('modelName').textContent = label;
  loadScene(xmls[0]);
  const onnx = Object.keys(files).find(k => /\.onnx$/i.test(k));
  if (onnx) loadPolicy(files[onnx], onnx.split('/').pop());
}

function writeFS(dir) {
  const FS = mj.FS; FS.mkdir(dir);
  for (const [p, bytes] of Object.entries(files)) {
    const parts = p.split('/'); let cur = dir;
    for (const seg of parts.slice(0, -1)) { cur += '/' + seg; try { FS.mkdir(cur); } catch (e) {} }
    FS.writeFile(dir + '/' + p, bytes);
  }
}

function loadScene(xmlPath) {
  const dir = '/w' + (++loadN);
  const fixes = [];
  try {
    writeFS(dir);
    let m = null;
    for (let tries = 0; !m; tries++) {
      try { m = mj.MjModel.from_xml_path(dir + '/' + xmlPath); }
      catch (e) {
        const miss = String(e.message || e).match(/Error opening file '([^']+)'/), want = miss && miss[1];
        const hit = want && Object.keys(files).find(k => k.split('/').pop() === want.split('/').pop());
        if (!hit || tries > 8) throw e;
        const base = (xmlPath.includes('/') ? xmlPath.slice(0, xmlPath.lastIndexOf('/') + 1) : ''), dest = want.startsWith('/') ? want : dir + '/' + base + want;
        let cur = ''; for (const seg of dest.split('/').slice(1, -1)) { cur += '/' + seg; try { mj.FS.mkdir(cur); } catch (er) {} }
        mj.FS.writeFile(dest, files[hit]); fixes.push(`${want} → ${hit}`);
      }
    }
    repReset(); if (data) data.delete(); if (model) model.delete();
    model = m; data = new mj.MjData(model);
  } catch (e) { showMsg('모델 컴파일 실패\n' + (e.message || e)); return; }
  $('drop').hidden = true; $('hud').hidden = false; $('bar').hidden = false; $('tag').hidden = false; $('closeBtn').hidden = false;
  $('modelName').textContent = xmlPath;
  MAP.falls = []; MAP.reached = 0; MAP.view = null; DIAG.ev = [];
  buildScene(); buildPanel(); resetSim(); frameCamera(); buildDecor(); if (DIAG.on) setDiag(true);
  applyScenario(true);
  POL.active = false; $('locoCtl').hidden = true; $('polOff').hidden = true; updateJoy(); if (POL.sess) startPolicy();
  if (fixes.length) { const n = $('msg'); showMsg('경로를 자동으로 맞춘 파일: ' + fixes.join(', ')); n.style.color = 'var(--amber)'; n.style.background = 'color-mix(in srgb,var(--amber) 12%,var(--panel))'; }
}

