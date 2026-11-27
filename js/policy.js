/* 학습된 걷기 정책(ONNX) 실행 — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 학습된 걷기 정책 (ONNX) ---------- */
const GAITS = { stand: { v: 0, f: 1 }, walk: { v: 0.15, f: 1 }, fast: { v: 0.3, f: 1.3 } };
const GAIT_MSG = {
  stand: '제자리에서 균형을 잡습니다. 방향 버튼을 누르면 학습 범위 속도(전진 명령 0.15)로 걷습니다.',
  walk: '학습 범위 그대로 걷습니다. 실제 속도는 약 0.09 m/s입니다.',
  fast: '학습 범위의 2배 명령(0.3)에 걸음 주기 1.3배입니다. 실제 약 0.18 m/s로, 사전 테스트에서 넘어지지 않은 상한입니다.',
  run: '뛰기는 이 정책이 학습하지 않은 동작입니다. 사전 테스트에서 명령 0.45 이상은 모든 조합에서 넘어졌습니다. 뛰기 정책을 새로 학습해야 합니다.',
  jump: '점프도 학습된 적 없는 동작이라 이 정책으로는 할 수 없습니다. 점프 보상으로 정책을 새로 학습해야 합니다.'
};
const POL = { sess: null, inName: 'obs', outName: '', active: false, busy: false, gait: 'stand', dir: { f: 0, s: 0, t: 0 }, k: 0, dec: 10, period: 27, ii: 0, phase: [0, 0], la: [], lla: [], llla: [], mt: [], prev: [], def: [], q: [], qdl: [], ids: null, cmd: [0, 0, 0, 0, 0, 0, 0], infMs: 0, vel: 0, freq: 1, snapQ: [], snap: null };
function policyCheck() {
  const S = mj.mjtObj.mjOBJ_SENSOR.value, B = mj.mjtObj.mjOBJ_BODY.value;
  const g = mj.mj_name2id(model, S, 'gyro'), a = mj.mj_name2id(model, S, 'accelerometer');
  if (model.nu !== 14 || g < 0 || a < 0 || !model.nkey) return 'Open Duck Mini v2 형식의 모델이 아닙니다 (액추에이터 14개, gyro·accelerometer 센서, home 키프레임이 필요).';
  let lf = mj.mj_name2id(model, B, 'foot_assembly'), rf = mj.mj_name2id(model, B, 'foot_assembly_2'), fl = mj.mj_name2id(model, B, 'floor');
  if (fl < 0) fl = 0;
  const qadr = [], vadr = [];
  for (let i = 0; i < 14; i++) { const j = model.actuator_trnid[2 * i]; qadr.push(model.jnt_qposadr[j]); vadr.push(model.jnt_dofadr[j]); }
  POL.ids = { gyro: model.sensor_adr[g], acc: model.sensor_adr[a], lf, rf, fl, qadr, vadr };
  POL.dec = Math.max(1, Math.round(0.02 / model.opt.timestep));
  return '';
}
function policyReset() {
  POL.def = Array.from(model.key_ctrl.subarray(0, 14)); POL.mt = [...POL.def]; POL.prev = [...POL.def];
  POL.la = new Array(14).fill(0); POL.lla = new Array(14).fill(0); POL.llla = new Array(14).fill(0);
  POL.ii = 0; POL.phase = [0, 0]; POL.k = 0; POL.snapQ = []; POL.snap = null;
}
async function loadPolicy(bytes, label) {
  const st = $('polState');
  try {
    if (!window.ort) throw new Error('ONNX 실행기를 불러오지 못했습니다');
    ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
    st.textContent = '정책 불러오는 중…';
    const sess = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    POL.sess = sess; POL.inName = sess.inputNames[0]; POL.outName = sess.outputNames[0];
    const r = await sess.run({ [POL.inName]: new ort.Tensor('float32', new Float32Array(101), [1, 101]) });
    if (r[POL.outName].data.length !== 14) throw new Error('출력이 14개가 아닙니다');
    POL.label = label; st.textContent = `${label} 불러옴 (입력 101 → 출력 14).`;
    if (model) startPolicy();
  } catch (e) { POL.sess = null; st.textContent = '정책을 쓸 수 없습니다: ' + (e.message || e) + ' (입력 101개 형식의 Open Duck 정책이 필요합니다)'; }
}
function startPolicy() {
  if (!POL.sess || !model) return;
  const err = policyCheck(); if (err) { $('polState').textContent = err; POL.active = false; return; }
  mj.mj_resetDataKeyframe(model, data, 0); mj.mj_forward(model, data); resetTiming(); policyReset(); repClear(); MAP.trail = []; MAP.dist = 0; MAP.goal = null;
  if (frozen) setFrozen(false);
  POL.active = true; $('locoCtl').hidden = false; $('polOff').hidden = false; setGait(POL.gait === 'run' || POL.gait === 'jump' ? 'stand' : POL.gait);
  $('polState').textContent = `${POL.label} 실행 중 · 제어 50Hz (물리 ${POL.dec}스텝마다 추론)`;
  drawRadar();
}
function setGait(g) {
  $('gaitNote').textContent = GAIT_MSG[g];
  if (g === 'run' || g === 'jump') { $('gaitNote').style.color = 'var(--amber)'; return; }
  $('gaitNote').style.color = ''; POL.gait = g;
  document.querySelectorAll('#gaits button').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === g));
}
function footContacts() {
  const { lf, rf, fl } = POL.ids; let L = 0, R = 0; if (lf < 0 && rf < 0) return [0, 0];
  const cs = data.contact, n = cs.size();
  for (let i = 0; i < n; i++) { const c = cs.get(i), a = model.geom_bodyid[c.geom1], b = model.geom_bodyid[c.geom2];
    if ((a === lf && b === fl) || (a === fl && b === lf)) L = 1; if ((a === rf && b === fl) || (a === fl && b === rf)) R = 1; }
  cs.delete(); return [L, R];
}
function policyCommand(t) {
  const G = GAITS[POL.gait] || GAITS.stand, E = persona.v[0] / 100, d = MAP.goal && !held.size ? autoDir() : POL.dir;
  const vmax = POL.gait === 'stand' ? 0.15 : G.v * (persona.on ? 0.85 + 0.3 * E : 1);
  const cmd = [Math.min(0.3, vmax) * d.f * (d.f < 0 ? 0.6 : 1), 0.2 * d.s, 1.0 * d.t, 0, 0, 0, 0];
  if (persona.on && !frozen) {
    const off = personaOffsets(t), slot = { neck: 3, hpitch: 4, hyaw: 5, hroll: 6 }, lim = { 3: [-0.34, 1.1], 4: [-0.78, 0.78], 5: [-1.5, 1.5], 6: [-0.5, 0.5] };
    roles.forEach((r, i) => { const k = slot[r]; if (k) cmd[k] = Math.min(lim[k][1], Math.max(lim[k][0], off[i] * (r === 'hyaw' ? 1.5 : 1))); });
  }
  POL.freq = G.f * (persona.on ? 0.9 + 0.25 * E : 1);
  return cmd;
}
async function policyTick() {
  const t = data.time, I = POL.ids, sd = data.sensordata, qp = data.qpos, qv = data.qvel;
  POL.cmd = policyCommand(t);
  POL.ii = (POL.ii + POL.freq) % POL.period;
  const ang = POL.ii / POL.period * 2 * Math.PI; POL.phase = [Math.cos(ang), Math.sin(ang)];
  const snap = { t, g: Array.from(sd.subarray(I.gyro, I.gyro + 3)), a: Array.from(sd.subarray(I.acc, I.acc + 3)), q: I.qadr.map((a, i) => qp[a] - POL.def[i]), v: I.vadr.map(a => qv[a] * 0.05), c: footContacts() };
  let use = snap;
  if (C.loop) {
    if (rng() >= C.drop) POL.snapQ.push({ s: snap, arr: t + Math.max(0, C.lat + (rng() * 2 - 1) * C.jit) });
    POL.snapQ.sort((a, b) => a.arr - b.arr);
    while (POL.snapQ.length && POL.snapQ[0].arr <= t + 1e-9) { const o = POL.snapQ.shift(); if (!POL.snap || o.s.t > POL.snap.t) POL.snap = o.s; }
    use = POL.snap || snap;
  }
  const a = [...use.a]; a[0] += 1.3;
  const obs = Float32Array.from([...use.g, ...a, ...POL.cmd, ...use.q, ...use.v, ...POL.la, ...POL.lla, ...POL.llla, ...POL.mt, ...use.c, ...POL.phase]);
  const t0 = performance.now();
  const out = await POL.sess.run({ [POL.inName]: new ort.Tensor('float32', obs, [1, 101]) });
  POL.infMs = POL.infMs * 0.9 + (performance.now() - t0) * 0.1;
  const act = Array.from(out[POL.outName].data);
  POL.llla = POL.lla; POL.lla = POL.la; POL.la = act;
  const md = 5.24 * model.opt.timestep * POL.dec;
  POL.mt = act.map((x, i) => Math.min(POL.prev[i] + md, Math.max(POL.prev[i] - md, POL.def[i] + x * 0.25)));
  POL.prev = [...POL.mt];
}
async function policyAdvance(goal, dt) {
  POL.busy = true; const t0 = data.time, w0 = performance.now();
  try {
    while (data.time < goal && running && POL.active) {
      if (POL.k % POL.dec === 0 && !frozen) await policyTick();
      stepOnce(); POL.k++;
      if (performance.now() - w0 > 30) break;
    }
  } catch (e) { POL.active = false; showMsg('정책 실행 오류: ' + (e.message || e)); }
  finally { POL.busy = false; rtfAcc[0] += data.time - t0; }
}

