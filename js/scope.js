/* 센서 타이밍 스코프와 지표 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 스코프 + 지표 ---------- */
const sc = $('scope'), sctx = sc.getContext('2d');
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const probe = document.createElement('span'); probe.hidden = true; document.body.append(probe);
const css = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
function drawScope() {
  const W = sc.clientWidth, H = sc.clientHeight, r = devicePixelRatio || 1;
  if (!W || !H) return;
  if (sc.width !== W * r || sc.height !== H * r) { sc.width = W * r; sc.height = H * r; }
  const g = sctx; g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
  const rows = T.rows || []; const narrow = W < 520;
  const padL = narrow ? 8 : 44, padB = 18, ageH = 30, top = 6, mainH = H - padB - ageH - top - 6;
  g.font = '11px Inter, sans-serif'; g.fillStyle = css('--mute'); g.strokeStyle = css('--line'); g.lineWidth = 1;
  if (!rows.length) { g.fillText(model ? '재생하면 관찰 관절의 목표·실제·관측 신호가 여기에 그려집니다.' : '모델을 불러오면 시작합니다.', padL, H / 2); return; }
  const t1 = rows[rows.length - 1].t, t0 = t1 - 5, X = t => padL + (t - t0) / 5 * (W - padL - 6);
  const vis = rows.filter(q => q.t >= t0);
  let lo = Infinity, hi = -Infinity; for (const q of vis) for (const v of [q.tg, q.act, q.obs]) if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (hi - lo < 0.02) { lo -= 0.05; hi += 0.05; } const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const Y = v => top + (hi - v) / (hi - lo) * mainH;
  for (let k = 0; k <= 2; k++) { const v = lo + (hi - lo) * k / 2, y = Y(v); g.beginPath(); g.moveTo(padL, y); g.lineTo(W - 6, y); g.stroke(); if (!narrow) g.fillText(v.toFixed(2), 4, y + 4); }
  for (let s = Math.ceil(t0); s <= t1; s++) { const x = X(s); g.fillText(s + 's', x - 6, H - 4); }
  g.fillStyle = css('--red'); for (const d of T.drops) if (d >= t0) g.fillRect(X(d) - 1, top, 2, mainH);
  const line = (key, col, dash, step) => { g.strokeStyle = col; g.lineWidth = 1.8; g.setLineDash(dash); g.beginPath(); let started = false, py = 0; for (const q of vis) { const v = q[key]; if (!isFinite(v)) continue; const x = X(q.t), y = Y(v); if (!started) { g.moveTo(x, y); started = true; } else { if (step) g.lineTo(x, py); g.lineTo(x, y); } py = y; } g.stroke(); g.setLineDash([]); };
  line('tg', css('--mute'), [5, 4]); line('obs', css('--violet'), [], true); line('act', css('--teal'), []);
  const ay = H - padB - ageH, ages = vis.map(q => q.age).filter(isFinite), amax = Math.max(0.05, ...ages);
  g.fillStyle = css('--mute'); if (!narrow) g.fillText('나이', 4, ay + 18);
  g.strokeStyle = css('--line'); g.strokeRect(padL, ay, W - padL - 6, ageH);
  g.strokeStyle = css('--amber'); g.lineWidth = 1.5; g.beginPath(); let st = false;
  for (const q of vis) { if (!isFinite(q.age)) continue; const x = X(q.t), y = ay + ageH - q.age / amax * (ageH - 3); st ? g.lineTo(x, y) : (g.moveTo(x, y), st = true); } g.stroke();
  g.fillStyle = css('--amber'); g.fillText('최대 ' + (amax * 1000).toFixed(0) + 'ms', W - 70, ay + 11);
}
function updateStats() {
  if (!model) return;
  const t = data.time; $('hTime').textContent = 't ' + t.toFixed(2) + 's';
  const rb = rootBody(), fj = model.body_jntnum[rb] > 0 && model.jnt_type[model.body_jntadr[rb]] === 0;
  $('hPose').hidden = !fj; if (fj) { const up = data.xmat[9 * rb + 8] > 0.6; if (DIAG.wasUp && !up) { const r = rootPose(); MAP.falls.push([r.x, r.y]); logEv('넘어짐 감지', 'e'); } DIAG.wasUp = up; $('hPose').textContent = up ? '자세 안정' : '넘어짐 — 리셋'; $('hPose').style.color = up ? '' : 'var(--red)'; }
  if (rtfAcc[1] > 0.4) { $('hRtf').textContent = '실시간 ×' + (rtfAcc[0] / rtfAcc[1]).toFixed(2); rtfAcc = [0, 0]; }
  const rows = (T.rows || []).filter(q => q.t >= t - 5);
  const ages = rows.map(q => q.age).filter(isFinite);
  const ms = v => isFinite(v) ? (v * 1000).toFixed(0) : '–';
  $('kAge').textContent = ages.length ? `${ms(pct(ages, .5))} / ${ms(pct(ages, .95))}ms` : '–';
  $('kDrop').textContent = T.samples ? (T.dropped / T.samples * 100).toFixed(1) + '%' : '–';
  $('kLat').textContent = T.lats && T.lats.length ? `${ms(pct(T.lats, .5))} / ${ms(pct(T.lats, .95))}ms` : '–';
  const e = rows.map(q => q.act - q.tg); const rm = e.length ? Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length) : NaN;
  $('kRmse').textContent = isFinite(rm) ? (rm * 180 / Math.PI).toFixed(2) + '°' : '–';
  if (POL.active) {
    const fj = model.jnt_type[0] === 0 ? model.jnt_dofadr[0] : -1;
    if (fj >= 0) POL.vel = POL.vel * 0.7 + 0.3 * Math.hypot(data.qvel[fj], data.qvel[fj + 1]);
    const c = POL.cmd, f2 = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    $('locoStats').innerHTML = [['명령 전진·옆·회전', `${f2(c[0])} · ${f2(c[1])} · ${f2(c[2])}`], ['실제 이동 속도', POL.vel.toFixed(3) + ' m/s'], ['머리 명령 (목·끄덕·좌우·기울)', c.slice(3).map(v => v.toFixed(2)).join(' ')], ['걸음 위상', `${Math.round(POL.ii)} / ${POL.period} (×${(POL.freq || 1).toFixed(2)})`], ['정책 추론 시간', POL.infMs.toFixed(2) + ' ms'], ['관측 입력', C.loop ? `지연 ${Math.round(C.lat * 1000)}ms · 누락 ${Math.round(C.drop * 100)}%` : '실시간']].map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('');
  }
  const sd = data.sensordata;
  for (let i = 0; i < model.nsensor; i++) { const el = $('s' + i); if (!el) continue; const a = model.sensor_adr[i], n = model.sensor_dim[i]; el.textContent = Array.from(sd.subarray(a, a + n), v => v.toFixed(3)).join('  '); }
}
