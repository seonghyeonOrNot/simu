/* 보행 데이터 시각화: 3D 위 발 접촉·속도 화살표, "보행 데이터" 탭의 실시간 차트 — 클래식 스크립트 */
const GV = { hist: [], max: 600, on: true, objs: null };

/* 정책 추론 1회(50Hz)마다 호출: 그 순간의 명령·실제 움직임·위상·발 접촉·추론 시간을 기록 */
function gaitRecord(contacts) {
  const rb = rootBody(), dof = model.jnt_dofadr[model.body_jntadr[rb]], yaw = rootPose().yaw, qv = data.qvel;
  const vx = qv[dof], vy = qv[dof + 1], c = Math.cos(yaw), s = Math.sin(yaw);
  GV.hist.push({
    t: data.time, cmd: [...POL.cmd], fwd: c * vx + s * vy, lat: -s * vx + c * vy, wz: qv[dof + 5],
    ph: POL.ii / POL.period, cL: contacts[0], cR: contacts[1], inf: POL.lastInf, src: POL.src
  });
  if (GV.hist.length > GV.max) GV.hist.shift();
}
function gaitClear() { GV.hist = []; }

/* ---------- 3D 표시: 발 밑 접촉 원, 명령(주황)·실제(초록) 속도 화살표 ---------- */
function gvBuild() {
  if (GV.objs) return;
  const ring = col => { const m = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.046, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false })); m.renderOrder = 2; return m; };
  const arrow = col => new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.1, col, 0.035, 0.022);
  GV.objs = { L: ring(0x2fbf9b), R: ring(0x2fbf9b), cmd: arrow(0xf2a541), act: arrow(0x1fae94) };
  worldG.add(GV.objs.L, GV.objs.R, GV.objs.cmd, GV.objs.act);
}
const gvDir = new THREE.Vector3(), gvOrg = new THREE.Vector3();
function gvSync() {
  const show = GV.on && POL.active && POL.ids && !REP.on && data;
  if (!show) { if (GV.objs) for (const o of Object.values(GV.objs)) o.visible = false; return; }
  gvBuild();
  const h = GV.hist[GV.hist.length - 1], I = POL.ids, xp = data.xpos, S = 2.5;
  for (const [k, b, on] of [['L', I.lf, h ? h.cL : 0], ['R', I.rf, h ? h.cR : 0]]) {
    const o = GV.objs[k]; o.visible = b >= 0; if (b < 0) continue;
    o.position.set(xp[3 * b], xp[3 * b + 1], 0.003); o.material.opacity = on ? 1 : 0.22; o.scale.setScalar(on ? 1.15 : 1);
  }
  const r = rootPose(), c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  gvOrg.set(r.x, r.y, 0.006);
  const place = (a, fx, fy) => {
    const len = Math.hypot(fx, fy) * S; a.visible = len > 0.012; if (!a.visible) return;
    gvDir.set(fx, fy, 0).normalize(); a.position.copy(gvOrg); a.setDirection(gvDir); a.setLength(Math.max(len, 0.04), Math.min(0.035, len * 0.4), 0.022);
  };
  const cm = POL.cmd || [0, 0, 0];
  place(GV.objs.cmd, c * cm[0] - s * cm[1], s * cm[0] + c * cm[1]);
  if (h) place(GV.objs.act, c * h.fwd - s * h.lat, s * h.fwd + c * h.lat); else GV.objs.act.visible = false;
}

/* ---------- 보행 데이터 탭: 공통 시간축(최근 6초) 차트 ---------- */
const GV_ROWS = [
  { id: 'gvSpeed', title: '전진 속도 (m/s)', lines: [['명령', h => h.cmd[0], '--mute', [5, 4]], ['실제', h => h.fwd, '--teal']], sm: true },
  { id: 'gvTurn', title: '회전 속도 (rad/s)', lines: [['명령', h => h.cmd[2], '--mute', [5, 4]], ['실제', h => h.wz, '--violet']], sm: true },
  { id: 'gvPhase', title: '걸음 위상과 발 접촉', gait: true },
  { id: 'gvHead', title: '머리 명령 (rad)', lines: [['목', h => h.cmd[3], '--teal'], ['끄덕', h => h.cmd[4], '--violet'], ['좌우', h => h.cmd[5], '--amber'], ['기울', h => h.cmd[6], '--red']] },
  { id: 'gvInf', title: '정책 추론 시간 (ms)', lines: [['추론', h => h.inf, '--amber']], zero: true }
];
function gvSmooth(arr, k = 5) { return arr.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - k + 1); j <= i; j++) if (isFinite(arr[j])) { s += arr[j]; n++; } return n ? s / n : NaN; }); }
function drawGait() {
  if ($('pane-gait').hidden) return;
  const H = GV.hist, win = 6, t1 = H.length ? H[H.length - 1].t : 0, t0 = t1 - win, vis = H.filter(h => h.t >= t0);
  for (const row of GV_ROWS) {
    const cv = $(row.id), W = cv.clientWidth, Hh = cv.clientHeight, r = devicePixelRatio || 1; if (!W) continue;
    if (cv.width !== W * r || cv.height !== Hh * r) { cv.width = W * r; cv.height = Hh * r; }
    const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, Hh);
    const padL = W < 520 ? 6 : 42, X = t => padL + (t - t0) / win * (W - padL - 6);
    g.font = '11px Inter, sans-serif'; g.strokeStyle = css('--line'); g.fillStyle = css('--mute'); g.lineWidth = 1;
    for (let s = Math.ceil(t0); s <= t1; s++) { const x = X(s); g.beginPath(); g.moveTo(x, 2); g.lineTo(x, Hh - 2); g.stroke(); }
    if (!vis.length) { g.fillText(POL.active ? '데이터 모으는 중…' : '걷기 정책이 켜지면 기록됩니다.', padL + 4, Hh / 2 + 4); continue; }
    if (row.gait) {
      const lane = (Hh - 8) / 3, lanes = [['위상', 0], ['왼발', 1], ['오른발', 2]];
      lanes.forEach(([n, i]) => { if (padL > 10) g.fillText(n, 2, 4 + lane * i + lane / 2 + 4); });
      g.strokeStyle = css('--violet'); g.lineWidth = 1.5; g.beginPath(); let prev = null;
      for (const h of vis) { const x = X(h.t), y = 4 + lane * (1 - h.ph) * 0.9 + lane * 0.05; if (prev !== null && h.ph < prev) g.moveTo(x, y); else if (prev === null) g.moveTo(x, y); else g.lineTo(x, y); prev = h.ph; }
      g.stroke();
      const bars = (key, i, col) => { g.fillStyle = col; let st = null; for (let k = 0; k < vis.length; k++) { const on = vis[k][key]; if (on && st === null) st = vis[k].t; if ((!on || k === vis.length - 1) && st !== null) { g.fillRect(X(st), 4 + lane * i + lane * 0.2, Math.max(1, X(vis[k].t) - X(st)), lane * 0.6); st = null; } } };
      bars('cL', 1, css('--teal')); bars('cR', 2, css('--amber'));
      continue;
    }
    const series = row.lines.map(([n, f]) => { const v = vis.map(f); return row.sm && n === '실제' ? gvSmooth(v) : v; });
    let lo = Infinity, hi = -Infinity; for (const s of series) for (const v of s) if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (row.zero) lo = 0; if (hi - lo < 0.05) { const m = (hi + lo) / 2; lo = m - 0.05; hi = m + 0.05; } const pd = (hi - lo) * 0.12; lo -= row.zero ? 0 : pd; hi += pd;
    const Y = v => 4 + (hi - v) / (hi - lo) * (Hh - 8);
    if (lo < 0 && hi > 0) { g.strokeStyle = css('--mute'); g.globalAlpha = 0.4; g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(W - 6, Y(0)); g.stroke(); g.globalAlpha = 1; }
    if (padL > 10) { g.fillStyle = css('--mute'); g.fillText(hi.toFixed(2), 2, 13); g.fillText(lo.toFixed(2), 2, Hh - 4); }
    row.lines.forEach(([n, , col, dash], i) => {
      g.strokeStyle = css(col); g.lineWidth = 1.8; g.setLineDash(dash || []); g.beginPath(); let st = false;
      vis.forEach((h, k) => { const v = series[i][k]; if (!isFinite(v)) return; const x = X(h.t), y = Y(v); st ? g.lineTo(x, y) : (g.moveTo(x, y), st = true); });
      g.stroke(); g.setLineDash([]);
    });
    const last = row.lines.map(([n, f], i) => `${n} ${(series[i][series[i].length - 1] ?? NaN).toFixed(row.zero ? 2 : 3)}`).join(' · ');
    $(row.id + 'V').textContent = last;
  }
  const L = vis.length, cyc = (() => { let n = 0; for (let k = 1; k < L; k++) if (vis[k].ph < vis[k - 1].ph) n++; return n; })();
  const stance = k => L ? Math.round(vis.filter(h => h[k]).length / L * 100) : 0;
  $('gvPhaseV').textContent = L ? `걸음 주기 ${cyc ? (win / cyc).toFixed(2) + 's' : '–'} · 접지 비율 왼 ${stance('cL')}% · 오른 ${stance('cR')}%` : '';
}
$('gvShow').onclick = () => { GV.on = !GV.on; toggle($('gvShow'), GV.on, '켬', '끔'); };
