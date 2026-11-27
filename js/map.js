/* 관제 테이블 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 관제 테이블 ---------- */
const MAP = { trail: [], falls: [], goal: null, dist: 0, view: null, reached: 0 };
function rootPose() { const rb = rootBody(), p = data.xpos, m = data.xmat; return { x: p[3 * rb], y: p[3 * rb + 1], yaw: Math.atan2(m[9 * rb + 3], m[9 * rb]) }; }
function autoDir() {
  const r = rootPose(), dx = MAP.goal.x - r.x, dy = MAP.goal.y - r.y, dist = Math.hypot(dx, dy);
  if (dist < 0.06) { MAP.goal = null; MAP.reached++; logEv('목표 지점 도착'); $('mapHint').textContent = '도착했습니다. 다른 지점을 탭하면 다시 이동합니다.'; return { f: 0, s: 0, t: 0 }; }
  let err = Math.atan2(dy, dx) - r.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
  return { f: Math.abs(err) < 0.6 ? Math.min(1, 0.35 + dist / 0.2) : 0, s: 0, t: Math.max(-1, Math.min(1, 2 * err)) };
}
function mapRecord() {
  if (!model || rootBody() < 1) return;
  const r = rootPose(), last = MAP.trail[MAP.trail.length - 1];
  if (!last || Math.hypot(r.x - last[0], r.y - last[1]) > 0.005) { if (last) MAP.dist += Math.hypot(r.x - last[0], r.y - last[1]); MAP.trail.push([r.x, r.y]); if (MAP.trail.length > 4000) MAP.trail.shift(); }
}
const mc = $('map'), mctx = mc.getContext('2d');
function mapXform() {
  const W = mc.clientWidth, H = mc.clientHeight, v = MAP.view;
  const s = Math.min(W, H) / (2 * v.half);
  return { W, H, s, X: x => W / 2 + (x - v.cx) * s, Y: y => H / 2 - (y - v.cy) * s, inv: (px, py) => [v.cx + (px - W / 2) / s, v.cy - (py - H / 2) / s] };
}
function drawMap() {
  const W = mc.clientWidth, H = mc.clientHeight, r0 = devicePixelRatio || 1;
  if (mc.width !== W * r0 || mc.height !== H * r0) { mc.width = W * r0; mc.height = H * r0; }
  const g = mctx; g.setTransform(r0, 0, 0, r0, 0, 0); g.clearRect(0, 0, W, H);
  if (!model) { g.fillStyle = css('--mute'); g.font = '12px Inter, sans-serif'; g.fillText('모델을 불러오면 위치가 표시됩니다.', 10, H / 2); return; }
  const r = rootPose(), pts = [...MAP.trail, [r.x, r.y]]; if (MAP.goal) pts.push([MAP.goal.x, MAP.goal.y]);
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity; for (const [x, y] of pts) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
  const tgt = { cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2, half: Math.max(0.6, Math.max(mxx - mnx, mxy - mny) / 2 * 1.25 + 0.15) };
  MAP.view = MAP.view ? { cx: MAP.view.cx + (tgt.cx - MAP.view.cx) * 0.15, cy: MAP.view.cy + (tgt.cy - MAP.view.cy) * 0.15, half: MAP.view.half + (tgt.half - MAP.view.half) * 0.15 } : tgt;
  const T = mapXform(), step = T.s * 0.25 < 14 ? 1 : 0.25;
  const [x0, y1] = T.inv(0, 0), [x1, y0] = T.inv(W, H);
  g.lineWidth = 1;
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { g.strokeStyle = Math.abs(x - Math.round(x)) < 1e-6 ? css('--mute') : css('--line'); g.globalAlpha = Math.abs(x - Math.round(x)) < 1e-6 ? 0.35 : 1; g.beginPath(); g.moveTo(T.X(x), 0); g.lineTo(T.X(x), H); g.stroke(); }
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { g.strokeStyle = Math.abs(y - Math.round(y)) < 1e-6 ? css('--mute') : css('--line'); g.globalAlpha = Math.abs(y - Math.round(y)) < 1e-6 ? 0.35 : 1; g.beginPath(); g.moveTo(0, T.Y(y)); g.lineTo(W, T.Y(y)); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = css('--mute'); g.font = '11px Inter, sans-serif'; g.fillText(step === 1 ? '격자 1m' : '격자 25cm', 8, H - 8);
  g.strokeStyle = css('--mute'); g.beginPath(); g.arc(T.X(0), T.Y(0), 4, 0, 7); g.stroke();
  if (MAP.trail.length > 1) { g.strokeStyle = css('--teal'); g.lineWidth = 2; g.beginPath(); MAP.trail.forEach(([x, y], i) => i ? g.lineTo(T.X(x), T.Y(y)) : g.moveTo(T.X(x), T.Y(y))); g.lineTo(T.X(r.x), T.Y(r.y)); g.stroke(); }
  g.strokeStyle = css('--red'); g.lineWidth = 2; for (const [x, y] of MAP.falls) { const px = T.X(x), py = T.Y(y); g.beginPath(); g.moveTo(px - 5, py - 5); g.lineTo(px + 5, py + 5); g.moveTo(px + 5, py - 5); g.lineTo(px - 5, py + 5); g.stroke(); }
  if (MAP.goal) {
    const gx = T.X(MAP.goal.x), gy = T.Y(MAP.goal.y); g.strokeStyle = css('--amber'); g.lineWidth = 2;
    g.setLineDash([4, 4]); g.beginPath(); g.moveTo(T.X(r.x), T.Y(r.y)); g.lineTo(gx, gy); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(gx, gy, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(gx - 4, gy); g.lineTo(gx + 4, gy); g.moveTo(gx, gy - 4); g.lineTo(gx, gy + 4); g.stroke();
  }
  const px = T.X(r.x), py = T.Y(r.y), sz = 11, a = -r.yaw;
  g.fillStyle = css('--teal'); g.strokeStyle = css('--bg'); g.lineWidth = 2; g.beginPath();
  g.moveTo(px + Math.cos(a) * sz, py + Math.sin(a) * sz); g.lineTo(px + Math.cos(a + 2.5) * sz * 0.8, py + Math.sin(a + 2.5) * sz * 0.8); g.lineTo(px + Math.cos(a - 2.5) * sz * 0.8, py + Math.sin(a - 2.5) * sz * 0.8); g.closePath(); g.fill(); g.stroke();
  const gd = MAP.goal ? Math.hypot(MAP.goal.x - r.x, MAP.goal.y - r.y) : NaN;
  $('mapStats').innerHTML = [['위치 x · y', `${r.x.toFixed(2)} · ${r.y.toFixed(2)} m`], ['방향', `${Math.round(r.yaw * 180 / Math.PI)}°`], ['이동 거리', MAP.dist.toFixed(2) + ' m'], ['목표까지', isFinite(gd) ? gd.toFixed(2) + ' m' : '–'], ['도착 · 넘어짐', `${MAP.reached}회 · ${MAP.falls.length}회`], ['조작', POL.active ? (MAP.goal && !held.size ? '자동 이동 중' : '수동') : '정책 없음 (위치만 표시)']].map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('');
}
mc.addEventListener('pointerdown', e => {
  if (!model || !MAP.view) return; const b = mc.getBoundingClientRect(), T = mapXform(), [x, y] = T.inv(e.clientX - b.left, e.clientY - b.top);
  MAP.goal = { x, y }; $('mapHint').textContent = POL.active ? `목표 (${x.toFixed(2)}, ${y.toFixed(2)})로 이동 중. 방향 키를 누르면 수동 조작이 우선합니다.` : '걷기 정책을 불러와야 목표 지점으로 이동할 수 있습니다.';
  if (POL.active && (POL.gait === 'stand')) setGait('walk');
});

