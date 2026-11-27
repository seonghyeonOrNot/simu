/* 반복 실험: 지연 조건 × 시드로 걷기 정책을 자동 실행하고 bootstrap 95% CI로 비교 — 클래식 스크립트 */
const EXP = { running: false, stop: false, eps: [], summary: [], meta: null };

function expCfg() {
  const lats = [...new Set(String($('eLats').value).split(/[,\s]+/).map(Number).filter(v => isFinite(v) && v >= 0))].slice(0, 8);
  return {
    lats: lats.length ? lats : [0],
    drop: Math.min(90, Math.max(0, +$('eDrop').value || 0)) / 100,
    jit: Math.max(0, +$('eJit').value || 0),
    seeds: Math.min(30, Math.max(2, Math.round(+$('eSeeds').value || 8))),
    dur: Math.min(30, Math.max(2, +$('eDur').value || 8)),
    cmd: Math.min(0.3, Math.max(-0.3, +$('eCmd').value || 0)),
    scn: $('eScn').getAttribute('aria-pressed') === 'true'
  };
}

function contactsOf(D) {
  const { lf, rf, fl } = POL.ids; let L = 0, R = 0; if (lf < 0 && rf < 0) return [0, 0];
  const cs = D.contact, n = cs.size();
  for (let i = 0; i < n; i++) { const c = cs.get(i), a = model.geom_bodyid[c.geom1], b = model.geom_bodyid[c.geom2];
    if ((a === lf && b === fl) || (a === fl && b === lf)) L = 1; if ((a === rf && b === fl) || (a === fl && b === rf)) R = 1; }
  cs.delete(); return [L, R];
}

/* 에피소드 1회. rS(시드만 사용): 초기 관절 잡음(±0.01rad)·외란 → 같은 시드는 지연 조건이 달라도 같은 조건에서 출발(짝 비교)
   rN(시드+지연): 누락·지터 */
async function runEpisode(D, latMs, seed, cfg) {
  const rS = mulberry(seed * 1000003 + 17), rN = mulberry(seed * 7919 + latMs * 104729 + 3), I = POL.ids;
  mj.mj_resetDataKeyframe(model, D, 0);
  const rb = rootBody(), fq = model.jnt_qposadr[model.body_jntadr[rb]];
  for (const a of I.qadr) D.qpos[a] += (rS() * 2 - 1) * 0.01;
  D.qpos[fq + 2] += 0.002;
  mj.mj_forward(model, D);
  const x0 = D.qpos[fq], y0 = D.qpos[fq + 1];
  const def = Array.from(model.key_ctrl.subarray(0, 14)), md = 5.24 * model.opt.timestep * POL.dec, z14 = () => new Array(14).fill(0);
  let mt = [...def], prev = [...def], la = z14(), lla = z14(), llla = z14(), ii = 0, q = [], snap = null;
  let fellAt = -1, pu = -1, pfx = 0, pfy = 0, nextPush = SCN.every, pushes = 0;
  const pushOn = cfg.scn && SCN.pushOn, cmd = [cfg.cmd, 0, 0, 0, 0, 0, 0], n = Math.round(cfg.dur / model.opt.timestep);
  const xf = D.xfrc_applied;
  for (let k = 0; k < n; k++) {
    const t = D.time;
    if (k % POL.dec === 0) {
      ii = (ii + 1) % POL.period; const ang = ii / POL.period * 2 * Math.PI, sd = D.sensordata;
      const s = { t, g: Array.from(sd.subarray(I.gyro, I.gyro + 3)), a: Array.from(sd.subarray(I.acc, I.acc + 3)), q: I.qadr.map((a, i) => D.qpos[a] - def[i]), v: I.vadr.map(a => D.qvel[a] * 0.05), c: contactsOf(D) };
      if (rN() >= cfg.drop) q.push({ s, arr: t + Math.max(0, latMs / 1000 + (rN() * 2 - 1) * cfg.jit / 1000) });
      q.sort((a, b) => a.arr - b.arr);
      while (q.length && q[0].arr <= t + 1e-9) { const o = q.shift(); if (!snap || o.s.t > snap.t) snap = o.s; }
      const u = snap || s, acc = [...u.a]; acc[0] += 1.3;
      const obs = Float32Array.from([...u.g, ...acc, ...cmd, ...u.q, ...u.v, ...la, ...lla, ...llla, ...mt, ...u.c, Math.cos(ang), Math.sin(ang)]);
      const out = await POL.sess.run({ [POL.inName]: new ort.Tensor('float32', obs, [1, 101]) });
      const act = Array.from(out[POL.outName].data);
      llla = lla; lla = la; la = act;
      mt = act.map((x, i) => Math.min(prev[i] + md, Math.max(prev[i] - md, def[i] + x * 0.25))); prev = [...mt];
      for (let i = 0; i < 14; i++) D.ctrl[i] = mt[i];
    }
    if (pushOn && t >= nextPush) { const a = rS() * 2 * Math.PI; pfx = SCN.force * Math.cos(a); pfy = SCN.force * Math.sin(a); pu = t + 0.1; nextPush = t + SCN.every; pushes++; }
    if (t < pu) { xf[6 * rb] = pfx; xf[6 * rb + 1] = pfy; } else { xf[6 * rb] = 0; xf[6 * rb + 1] = 0; }
    mj.mj_step(model, D);
    if (k % 25 === 0 && D.xmat[9 * rb + 8] < 0.5) { fellAt = D.time; break; }
    if (EXP.stop) break;
  }
  return { lat: latMs, seed, fell: fellAt >= 0, tFall: fellAt, dist: D.qpos[fq] - x0, lateral: D.qpos[fq + 1] - y0, simT: D.time, pushes };
}

function bootCI(vals, rng, B = 2000) {
  const n = vals.length; if (!n) return [NaN, NaN]; if (n === 1) return [vals[0], vals[0]];
  const m = new Float64Array(B);
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += vals[Math.floor(rng() * n)]; m[b] = s / n; }
  m.sort(); return [m[Math.floor(0.025 * (B - 1))], m[Math.ceil(0.975 * (B - 1))]];
}
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;

function summarize(cfg) {
  const rng = mulberry(20261127), base = cfg.lats[0];
  const bySeedBase = new Map(EXP.eps.filter(e => e.lat === base).map(e => [e.seed, e]));
  EXP.summary = cfg.lats.map(lat => {
    const es = EXP.eps.filter(e => e.lat === lat), d = es.map(e => e.dist), f = es.map(e => e.fell ? 1 : 0);
    const pairs = es.filter(e => bySeedBase.has(e.seed)).map(e => e.dist - bySeedBase.get(e.seed).dist);
    return { lat, n: es.length, falls: f.reduce((s, v) => s + v, 0), fallCI: bootCI(f, rng), dist: mean(d), distCI: bootCI(d, rng), diff: lat === base ? 0 : mean(pairs), diffCI: lat === base ? [0, 0] : bootCI(pairs, rng) };
  });
}

function renderResults(cfg) {
  const S = EXP.summary; if (!S.length) { $('eResult').innerHTML = ''; return; }
  const base = cfg.lats[0], maxD = Math.max(0.05, ...S.map(s => Math.max(Math.abs(s.distCI[1]), Math.abs(s.dist))));
  const f = (v, d = 3) => isFinite(v) ? v.toFixed(d) : '–', ci = c => `[${f(c[0])}, ${f(c[1])}]`;
  const rows = S.map(s => {
    const sig = s.lat === base ? '기준' : s.diffCI[1] < 0 ? '유의하게 감소' : s.diffCI[0] > 0 ? '유의하게 증가' : '차이 불확실';
    const w = Math.max(0, s.dist) / maxD * 100, l = Math.max(0, s.distCI[0]) / maxD * 100, r = Math.max(0, s.distCI[1]) / maxD * 100;
    return `<tr><td>${s.lat}ms</td><td>${s.falls}/${s.n}</td><td>${f(s.dist)}<div class="cibar"><i style="width:${w}%"></i><b style="left:${l}%;width:${Math.max(0.5, r - l)}%"></b></div><span class="ci">${ci(s.distCI)}</span></td><td>${s.lat === base ? '–' : (s.diff >= 0 ? '+' : '') + f(s.diff)}<span class="ci">${s.lat === base ? '' : ci(s.diffCI)}</span></td><td>${sig}</td></tr>`;
  }).join('');
  const worst = S.slice(1).filter(s => s.diffCI[1] < 0);
  const line = worst.length ? `지연 ${worst[0].lat}ms부터 기준(${base}ms) 대비 이동 거리가 통계적으로 줄었습니다 (시드별 짝 비교, 95% CI가 0을 포함하지 않음).` : S.length > 1 ? `시험한 지연 범위에서는 기준(${base}ms) 대비 이동 거리 차이가 95% CI로 확인되지 않았습니다.` : '';
  $('eResult').innerHTML = `<p class="note" style="margin:10px 0 6px">${esc(line)}</p><div class="scroll"><table class="dtbl etbl"><thead><tr><th>지연</th><th>넘어짐</th><th>이동 거리 m (95% CI)</th><th>기준 대비 차이 (95% CI)</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">조건: 명령 ${cfg.cmd} m/s · ${cfg.dur}초 · 시드 ${cfg.seeds}개 · 누락 ${Math.round(cfg.drop * 100)}% · 지터 ±${cfg.jit}ms · ${cfg.scn ? `지형·외란 적용 (마찰 ${SCN.fric}, 경사 ${SCN.slope}°, 밀기 ${SCN.pushOn ? SCN.force + 'N/' + SCN.every + 's' : '없음'})` : '평지 기본값'}. 같은 시드는 모든 지연 조건에서 같은 초기 자세 잡음과 외란을 받습니다. 신뢰구간은 시계열 행이 아니라 시드 단위로 재표본해 계산했습니다.</p>`;
}

function expCSV() {
  const m = EXP.meta; if (!m) return '';
  const head = `# simu 반복 실험 ${m.at}\n# model=${m.model} policy=${m.policy} cmd=${m.cfg.cmd} dur=${m.cfg.dur}s seeds=${m.cfg.seeds} drop=${m.cfg.drop} jitter_ms=${m.cfg.jit} scenario=${m.cfg.scn ? `fric=${SCN.fric};slope=${SCN.slope};push=${SCN.pushOn ? SCN.force + 'N/' + SCN.every + 's' : 'off'}` : 'off'}\n`;
  const eps = 'latency_ms,seed,fell,t_fall_s,dist_m,lateral_m,sim_time_s,pushes\n' + EXP.eps.map(e => [e.lat, e.seed, e.fell ? 1 : 0, e.fell ? e.tFall.toFixed(3) : '', e.dist.toFixed(4), e.lateral.toFixed(4), e.simT.toFixed(3), e.pushes].join(',')).join('\n');
  const sum = '\n\nlatency_ms,n,falls,dist_mean,dist_ci_lo,dist_ci_hi,diff_vs_base,diff_ci_lo,diff_ci_hi\n' + EXP.summary.map(s => [s.lat, s.n, s.falls, s.dist, ...s.distCI, s.diff, ...s.diffCI].map(v => typeof v === 'number' ? +v.toFixed(5) : v).join(',')).join('\n');
  return head + eps + sum + '\n';
}

async function runExperiment() {
  if (EXP.running) return;
  if (!model) { $('eState').textContent = '먼저 모델을 불러와 주세요.'; return; }
  if (!POL.sess) { $('eState').textContent = '걷기 정책(.onnx)을 먼저 불러와 주세요.'; return; }
  const err = policyCheck(); if (err) { $('eState').textContent = err; return; }
  const cfg = expCfg(), total = cfg.lats.length * cfg.seeds;
  EXP.running = true; EXP.stop = false; EXP.eps = []; EXP.summary = [];
  EXP.meta = { at: new Date().toISOString(), model: $('modelName').textContent, policy: POL.label || '', cfg };
  const wasRunning = running; running = false; $('playBtn').textContent = '재생';
  $('eRun').textContent = '실행 중…'; $('eBar').style.width = '0%';
  if (!cfg.scn) { const gv = model.opt.gravity; gv[0] = 0; gv[1] = 0; gv[2] = -9.81; for (const [i, g] of groundGeoms().entries()) if (SCN.orig && SCN.orig[i] !== undefined) model.geom_friction[3 * g] = SCN.orig[i]; }
  const D = new mj.MjData(model), t0 = performance.now(); let done = 0;
  try {
    for (let s = 1; s <= cfg.seeds && !EXP.stop; s++) {
      for (const lat of cfg.lats) {
        if (EXP.stop) break;
        $('eState').textContent = `${done + 1}/${total} 실행 중 · 지연 ${lat}ms · 시드 ${s}`;
        EXP.eps.push(await runEpisode(D, lat, s, cfg)); done++;
        $('eBar').style.width = (done / total * 100) + '%';
        if (done % cfg.lats.length === 0) { summarize(cfg); renderResults(cfg); }
        await new Promise(r => setTimeout(r, 0));
      }
    }
    summarize(cfg); renderResults(cfg);
    $('eState').textContent = `${EXP.stop ? '중지됨' : '완료'} · 에피소드 ${done}개 · ${((performance.now() - t0) / 1000).toFixed(1)}초 걸림`;
  } catch (e) { $('eState').textContent = '실험 오류: ' + (e.message || e); }
  finally {
    D.delete(); EXP.running = false; $('eRun').textContent = '실험 실행';
    applyScenario(); running = wasRunning; $('playBtn').textContent = running ? '일시정지' : '재생';
  }
}

$('eRun').onclick = runExperiment;
$('eStop').onclick = () => { if (EXP.running) EXP.stop = true; };
$('eScn').onclick = () => { const on = $('eScn').getAttribute('aria-pressed') !== 'true'; toggle($('eScn'), on, '적용', '평지'); };
$('eCsv').onclick = () => { const t = expCSV(); if (!t) { $('eState').textContent = '아직 결과가 없습니다.'; return; } download(`simu-experiment-${Date.now()}.csv`, t, 'text/csv'); };
$('eCopy').onclick = async () => { const t = expCSV(); if (!t) { $('eState').textContent = '아직 결과가 없습니다.'; return; } try { await navigator.clipboard.writeText(t); $('eState').textContent = 'CSV를 클립보드에 복사했습니다.'; } catch (e) { $('eState').textContent = '클립보드 접근이 막혔습니다. CSV 내려받기를 써 주세요.'; } };
