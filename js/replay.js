/* 리플레이: 최근 30초 자세를 30Hz로 기록하고 되감아 봅니다 — 클래식 스크립트 */
const REP = { buf: [], max: 900, on: false, rd: null, cur: 0, playing: false, rate: 1, lastRec: -1, wasRunning: true };

function repRecord() {
  if (REP.on || !model || !data) return;
  if (REP.lastRec >= 0 && data.time >= REP.lastRec && data.time - REP.lastRec < 1 / 30 - 1e-9) return;
  REP.lastRec = data.time;
  REP.buf.push({ t: data.time, q: Float64Array.from(data.qpos) });
  if (REP.buf.length > REP.max) REP.buf.shift();
}
function repClear() { REP.buf = []; REP.lastRec = -1; if (REP.on) repExit(); }
/* 모델을 바꾸기 직전에 호출: 이전 모델용 리플레이 데이터 해제 */
function repReset() { if (REP.on) repExit(); REP.buf = []; REP.lastRec = -1; if (REP.rd) { REP.rd.delete(); REP.rd = null; } }

function repEnter() {
  if (!model || REP.buf.length < 2) { showMsg('아직 기록된 장면이 없습니다. 잠시 시뮬레이션을 돌린 뒤 다시 눌러 주세요.'); return; }
  showMsg('');
  REP.on = true; REP.wasRunning = running; running = false; $('playBtn').textContent = '재생';
  if (!REP.rd) REP.rd = new mj.MjData(model);
  REP.cur = REP.buf.length - 1; REP.playing = false;
  const s = $('repSlider'); s.max = REP.buf.length - 1; s.value = REP.cur;
  $('repBox').hidden = false; toggle($('repBtn'), true); $('repPlay').textContent = '재생';
  repShow(); drawRepMarks();
}
function repExit() {
  REP.on = false; REP.playing = false; $('repBox').hidden = true; toggle($('repBtn'), false);
  running = REP.wasRunning; $('playBtn').textContent = running ? '일시정지' : '재생';
  if (data) syncScene();
}
function repShow() {
  const i = Math.max(0, Math.min(REP.buf.length - 1, Math.round(REP.cur))), f = REP.buf[i];
  REP.rd.qpos.set(f.q); mj.mj_forward(model, REP.rd); syncScene();
  $('repSlider').value = i;
  const ago = REP.buf[REP.buf.length - 1].t - f.t;
  $('repInfo').textContent = `t ${f.t.toFixed(2)}s · 현재보다 ${ago.toFixed(1)}초 전 · ${i + 1}/${REP.buf.length}`;
}
function repTick(dt) {
  if (!REP.playing) return;
  REP.cur += dt * REP.rate * 30;
  if (REP.cur >= REP.buf.length - 1) { REP.cur = REP.buf.length - 1; REP.playing = false; $('repPlay').textContent = '재생'; }
  repShow();
}
function drawRepMarks() {
  const c = $('repMarks'), W = c.clientWidth, H = c.clientHeight, r = devicePixelRatio || 1;
  if (c.width !== W * r || c.height !== H * r) { c.width = W * r; c.height = H * r; }
  const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
  if (REP.buf.length < 2) return;
  const t0 = REP.buf[0].t, t1 = REP.buf[REP.buf.length - 1].t, X = t => 9 + (t - t0) / Math.max(1e-6, t1 - t0) * (W - 18);
  for (const e of DIAG.ev) {
    if (e.t < t0 || e.t > t1) continue;
    g.fillStyle = e.level === 'e' ? css('--red') : e.level === 'w' ? css('--amber') : css('--teal');
    const h = /넘어짐/.test(e.text) ? H : e.level ? H * 0.6 : H * 0.8; g.fillRect(X(e.t) - 1, H - h, 2, h);
  }
}
function lastFallIndex() {
  const t0 = REP.buf[0].t, t1 = REP.buf[REP.buf.length - 1].t;
  const fall = DIAG.ev.find(e => /넘어짐 감지/.test(e.text) && e.t >= t0 && e.t <= t1);
  if (!fall) return -1;
  const target = fall.t - 2; return Math.max(0, REP.buf.findIndex(f => f.t >= target));
}

$('repBtn').onclick = () => REP.on ? repExit() : repEnter();
$('repExit').onclick = () => repExit();
$('repSlider').addEventListener('input', e => { REP.cur = +e.target.value; REP.playing = false; $('repPlay').textContent = '재생'; repShow(); });
$('repPlay').onclick = () => { if (REP.cur >= REP.buf.length - 1) REP.cur = 0; REP.playing = !REP.playing; $('repPlay').textContent = REP.playing ? '멈춤' : '재생'; };
$('repRate').onchange = e => REP.rate = +e.target.value;
$('repFall').onclick = () => {
  const i = lastFallIndex();
  if (i < 0) { $('repInfo').textContent = '기록 구간 안에 넘어짐이 없습니다.'; return; }
  REP.cur = i; REP.rate = 0.25; $('repRate').value = '0.25'; REP.playing = true; $('repPlay').textContent = '멈춤'; repShow();
};
new ResizeObserver(() => REP.on && drawRepMarks()).observe($('repMarks'));
