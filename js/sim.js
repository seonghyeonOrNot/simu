/* 물리 스텝과 메인 루프 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
function stepOnce() {
  const t = data.time, mon = monJoint(), qp = data.qpos, ctrl = data.ctrl;
  if (mon) {
    while (t >= T.nextS - 1e-9) {
      T.seq++; T.samples++;
      if (rng() < C.drop) { T.dropped++; T.drops.push(T.nextS); }
      else { const d = Math.max(0, C.lat + (rng() * 2 - 1) * C.jit); T.q.push({ seq: T.seq, st: T.nextS, v: qp[mon.adr], arr: T.nextS + d }); T.lats.push(d); }
      T.nextS += C.sens;
    }
    T.q.sort((a, b) => a.arr - b.arr);
    while (T.q.length && T.q[0].arr <= t + 1e-9) { const o = T.q.shift(); if (!T.obs || o.seq > T.obs.seq) T.obs = { ...o, rt: t }; }
  }
  if (t >= T.nextC - 1e-9) {
    T.nextC += C.ctrl;
    controlTick(t, C.ctrl);
    if (mon) {
      const tg = smooth[monAct], act = qp[mon.adr];
      let cmd = tg;
      if (C.loop && T.obs && !frozen && !POL.active) cmd = tg + 1.5 * (tg - T.obs.v);
      const [lo, hi] = actRange(monAct); T.cmd = Math.min(hi, Math.max(lo, cmd));
      const row = { t, tg, act, obs: T.obs ? T.obs.v : NaN, age: T.obs ? t - T.obs.st : NaN, seq: T.obs ? T.obs.seq : -1, st: T.obs ? T.obs.st : NaN, rt: T.obs ? T.obs.rt : NaN };
      T.rows.push(row); if (T.log.length < 60000) T.log.push(row);
      const cut = t - HIST; while (T.rows.length && T.rows[0].t < cut) T.rows.shift();
      while (T.drops.length && T.drops[0] < cut) T.drops.shift();
      if (T.lats.length > 2000) T.lats.splice(0, T.lats.length - 2000);
    }
  }
  for (let i = 0; i < model.nu; i++) ctrl[i] = POL.active && !frozen ? POL.mt[i] : (smooth[i] ?? base[i]);
  if (mon && T.cmd !== null) ctrl[monAct] = T.cmd;
  pushStep(t);
  mj.mj_step(model, data);
  if (!isFinite(data.qpos[0])) { running = false; showMsg('시뮬레이션이 발산했습니다. 리셋해 주세요.'); }
}
let last = performance.now(), rtfAcc = [0, 0];
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  if (model && data) {
    if (REP.on) repTick(dt);
    else if (running && POL.active) { if (!POL.busy) policyAdvance(data.time + dt * speed); rtfAcc[1] += dt; }
    else if (running) {
      const goal = data.time + dt * speed, t0 = data.time, w0 = performance.now(); let n = 0;
      while (data.time < goal && n < 2000) { stepOnce(); n++; if (performance.now() - w0 > 25) break; }
      rtfAcc[0] += data.time - t0; rtfAcc[1] += dt;
    }
    if (!REP.on) { syncScene(); repRecord(); }
    gvSync();
    if (follow) { const b = rootBody(), c = vd().subtree_com.subarray(3 * b, 3 * b + 3), d = new THREE.Vector3(c[0], c[1], c[2]).applyMatrix4(worldG.matrixWorld).sub(orbit.target); orbit.target.add(d.multiplyScalar(0.1)); camera.position.add(d); sun.position.set(orbit.target.x + 2, orbit.target.y - 3, orbit.target.z + 5); sun.target.position.copy(orbit.target); }
  }
  orbit.update(); renderer.render(scene, camera);
}
