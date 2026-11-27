/* 3D 장면 구성과 동기화, 근사 장식(서보·눈) — 클래식 스크립트: 다른 js 파일과 전역 상태를 공유합니다 */
/* ---------- 3D 장면 ---------- */
function checker() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const a = dark() ? '#1c2126' : '#d9ddda', b = dark() ? '#252b31' : '#eef0ee';
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 64, j * 64, 64, 64); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildScene() {
  for (const o of geomObjs) if (o) { o.geometry.dispose(); o.material.dispose(); }
  root.clear(); geomObjs = [];
  const m = model, T = THREE;
  for (let i = 0; i < m.ngeom; i++) {
    const type = m.geom_type[i], s = m.geom_size.subarray(3 * i, 3 * i + 3), grp = m.geom_group[i];
    let geo = null, plane = false;
    if (type === 0) { const sx = s[0] > 0 ? s[0] * 2 : 40, sy = s[1] > 0 ? s[1] * 2 : 40; geo = new T.PlaneGeometry(sx, sy); plane = true; }
    else if (type === 1) geo = hfieldGeo(m.geom_dataid[i]);
    else if (type === 2) geo = new T.SphereGeometry(s[0], 24, 16);
    else if (type === 3) geo = new T.CapsuleGeometry(s[0], s[1] * 2, 8, 16).rotateX(Math.PI / 2);
    else if (type === 4) geo = new T.SphereGeometry(1, 24, 16).scale(s[0], s[1], s[2]);
    else if (type === 5) geo = new T.CylinderGeometry(s[0], s[0], s[1] * 2, 24).rotateX(Math.PI / 2);
    else if (type === 6) geo = new T.BoxGeometry(s[0] * 2, s[1] * 2, s[2] * 2);
    else if (type === 7) geo = meshGeo(m.geom_dataid[i]);
    if (!geo) { geomObjs.push(null); continue; }
    const mid = m.geom_matid[i];
    const rgba = mid >= 0 ? m.mat_rgba.subarray(4 * mid, 4 * mid + 4) : m.geom_rgba.subarray(4 * i, 4 * i + 4);
    const mat = new T.MeshStandardMaterial({ color: new T.Color(rgba[0], rgba[1], rgba[2]), roughness: 0.65, metalness: 0.05, transparent: rgba[3] < 1, opacity: rgba[3], flatShading: type === 7 });
    if (plane || type === 1) { mat.map = checker(); mat.map.repeat.set(plane ? geo.parameters.width / 0.5 : 20, plane ? geo.parameters.height / 0.5 : 20); mat.color.set(0xffffff); mat.roughness = 0.95; }
    const o = new T.Mesh(geo, mat);
    o.matrixAutoUpdate = false; o.castShadow = !plane && type !== 1; o.receiveShadow = true;
    o.userData = { grp, ground: plane || type === 1 };
    o.visible = rgba[3] > 0 && (grp < 3 || showCol);
    root.add(o); geomObjs.push(o);
  }
}
function meshGeo(id) {
  const m = model, va = m.mesh_vertadr[id], vn = m.mesh_vertnum[id], fa = m.mesh_faceadr[id], fn = m.mesh_facenum[id];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(m.mesh_vert.subarray(va * 3, (va + vn) * 3)), 3));
  g.setIndex(Array.from(m.mesh_face.subarray(fa * 3, (fa + fn) * 3)));
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); g.dispose(); return ng;
}
function hfieldGeo(id) {
  const m = model, nr = m.hfield_nrow[id], nc = m.hfield_ncol[id], sz = m.hfield_size.subarray(4 * id, 4 * id + 4), adr = m.hfield_adr[id];
  const g = new THREE.PlaneGeometry(sz[0] * 2, sz[1] * 2, nc - 1, nr - 1), p = g.attributes.position;
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) p.setZ(r * nc + c, m.hfield_data[adr + (nr - 1 - r) * nc + c] * sz[2]);
  g.computeVertexNormals(); return g;
}
const tmpM = new THREE.Matrix4();
/* ---------- 근사 장식: 서보·혼·눈 (물리와 무관) ---------- */
let decor = [], showDecor = true;
const V3 = (a, i) => new THREE.Vector3(a[3 * i], a[3 * i + 1], a[3 * i + 2]);
const vd = () => (typeof REP !== 'undefined' && REP.on && REP.rd) ? REP.rd : data;
function bodyMat(b, out) { const D = vd(), p = D.xpos, m = D.xmat, a = 9 * b, c = 3 * b; return out.set(m[a], m[a + 1], m[a + 2], p[c], m[a + 3], m[a + 4], m[a + 5], p[c + 1], m[a + 6], m[a + 7], m[a + 8], p[c + 2], 0, 0, 0, 1); }
function addDecor(geo, mat, b, world) {
  const o = new THREE.Mesh(geo, mat); o.matrixAutoUpdate = false; o.castShadow = true; o.visible = showDecor;
  const local = bodyMat(b, new THREE.Matrix4()).invert().multiply(world);
  const e = { o, b, local }; deco.add(o); decor.push(e); return e;
}
function buildDecor() {
  for (const d of decor) { d.o.geometry.dispose(); d.o.material.dispose(); }
  deco.clear(); decor = [];
  mj.mj_forward(model, data);
  let ext = 0; for (let i = 0; i < geomObjs.length; i++) if (geomObjs[i] && !geomObjs[i].userData.ground) ext = Math.max(ext, model.geom_rbound[i]);
  const sc = ext > 0.4 ? ext / 0.2 : 1, H = 0.035 * sc, L = 0.0452 * sc, W = 0.0247 * sc;
  const done = new Set();
  for (let i = 0; i < model.nu; i++) {
    const j = model.actuator_trnid[2 * i];
    if (model.actuator_trntype[i] !== 0 || j < 0 || model.jnt_type[j] !== 3 || done.has(j)) continue;
    done.add(j);
    const child = model.jnt_bodyid[j], parent = model.body_parentid[child];
    const A = V3(data.xanchor, j), ax = V3(data.xaxis, j).normalize(), pc = V3(data.xipos, parent);
    const z = ax.clone().multiplyScalar(Math.sign(pc.clone().sub(A).dot(ax)) || -1);
    const lx = pc.clone().sub(A); lx.sub(ax.clone().multiplyScalar(lx.dot(ax)));
    if (lx.length() < 1e-6) lx.copy(Math.abs(ax.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).sub(ax.clone().multiplyScalar(ax.z));
    lx.normalize(); const ly = new THREE.Vector3().crossVectors(z, lx);
    const body = new THREE.Matrix4().makeBasis(lx, ly, z).setPosition(A.clone().add(z.clone().multiplyScalar(H / 2 + 0.003 * sc)).add(lx.clone().multiplyScalar(0.01 * sc)));
    addDecor(new THREE.BoxGeometry(L, W, H), new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.45, metalness: 0.1 }), parent, body).act = i;
    const horn = new THREE.Matrix4().makeBasis(lx, ly, z).setPosition(A.clone().add(z.clone().multiplyScalar(0.001 * sc)));
    addDecor(new THREE.CylinderGeometry(0.0105 * sc, 0.0105 * sc, 0.003 * sc, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.35, metalness: 0.4 }), child, horn);
  }
  const M = mj.mjtObj.mjOBJ_MESH.value; let hg = -1, best = -1;
  for (let g = 0; g < model.ngeom; g++) {
    if (model.geom_type[g] !== 7) continue; const n = mj.mj_id2name(model, M, model.geom_dataid[g]) || '';
    const sc2 = n === 'head' ? 10 : /head/i.test(n) && !/_to_|sheet|holder|mount/i.test(n) ? 5 : -1;
    if (sc2 > 0 && sc2 + model.geom_rbound[g] > best) { best = sc2 + model.geom_rbound[g]; hg = g; }
  }
  if (hg < 0) return;
  const hb = model.geom_bodyid[hg], rb = rootBody(), rm = data.xmat;
  const f = new THREE.Vector3(rm[9 * rb], rm[9 * rb + 3], rm[9 * rb + 6]).normalize(), up = new THREE.Vector3(0, 0, 1), left = new THREE.Vector3().crossVectors(up, f).normalize();
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; const gm = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let g = 0; g < model.ngeom; g++) {
    if (g !== hg) continue;
    const id = model.geom_dataid[g], va = model.mesh_vertadr[id], vn = model.mesh_vertnum[id], xm = data.geom_xmat, xp = data.geom_xpos, a = 9 * g, b = 3 * g;
    gm.set(xm[a], xm[a + 1], xm[a + 2], xp[b], xm[a + 3], xm[a + 4], xm[a + 5], xp[b + 1], xm[a + 6], xm[a + 7], xm[a + 8], xp[b + 2], 0, 0, 0, 1);
    for (let k = va; k < va + vn; k++) {
      v.set(model.mesh_vert[3 * k], model.mesh_vert[3 * k + 1], model.mesh_vert[3 * k + 2]).applyMatrix4(gm);
      const q = [v.dot(f), v.dot(left), v.dot(up)]; for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], q[c]); mx[c] = Math.max(mx[c], q[c]); }
    }
  }
  const wid = mx[1] - mn[1], hei = mx[2] - mn[2], r = Math.min(0.3 * hei, 0.09 * wid);
  for (const side of [-1, 1]) {
    const pos = f.clone().multiplyScalar(mx[0] - r * 0.1).add(left.clone().multiplyScalar((mn[1] + mx[1]) / 2 + side * 0.24 * wid)).add(up.clone().multiplyScalar(mn[2] + 0.5 * hei));
    const fr = new THREE.Matrix4().makeBasis(left, up, f).setPosition(pos);
    addDecor(new THREE.CylinderGeometry(r, r, r * 0.4, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.12, metalness: 0.3 }), hb, fr);
    addDecor(new THREE.TorusGeometry(r, r * 0.13, 10, 32), new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.4, metalness: 0.5 }), hb, fr.clone());
    const hl = new THREE.Matrix4().makeBasis(left, up, f).setPosition(pos.clone().add(f.clone().multiplyScalar(r * 0.22)).add(left.clone().multiplyScalar(r * 0.3)).add(up.clone().multiplyScalar(r * 0.35)));
    addDecor(new THREE.SphereGeometry(r * 0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), hb, hl);
  }
}
const tmpB = new THREE.Matrix4();
function syncDecor() { for (const d of decor) { d.o.matrix.multiplyMatrices(bodyMat(d.b, tmpB), d.local); d.o.matrixWorldNeedsUpdate = true; } }
function syncScene() {
  const D = vd(), xp = D.geom_xpos, xm = D.geom_xmat;
  for (let i = 0; i < geomObjs.length; i++) {
    const o = geomObjs[i]; if (!o) continue;
    const a = 9 * i, b = 3 * i;
    o.matrix.set(xm[a], xm[a + 1], xm[a + 2], xp[b], xm[a + 3], xm[a + 4], xm[a + 5], xp[b + 1], xm[a + 6], xm[a + 7], xm[a + 8], xp[b + 2], 0, 0, 0, 1);
    o.matrixWorldNeedsUpdate = true;
  }
  syncDecor();
}
function rootBody() { for (let b = 1; b < model.nbody; b++) if (model.body_parentid[b] === 0 && model.body_jntnum[b] > 0) return b; return model.nbody > 1 ? 1 : 0; }
function frameCamera() {
  mj.mj_forward(model, data);
  const b = rootBody(), c = data.subtree_com.subarray(3 * b, 3 * b + 3);
  let ext = 0.1;
  for (let i = 0; i < model.ngeom; i++) {
    const o = geomObjs[i]; if (!o || o.userData.ground) continue;
    const p = data.geom_xpos; ext = Math.max(ext, Math.hypot(p[3 * i] - c[0], p[3 * i + 1] - c[1], p[3 * i + 2] - c[2]) + model.geom_rbound[i]);
  }
  ext = Math.min(ext, 5);
  orbit.target.set(c[0], c[1], c[2]);
  camera.position.set(c[0] + ext * 1.6, c[1] - ext * 1.9, c[2] + ext * 0.9);
  camera.near = ext / 100; camera.far = ext * 400; camera.updateProjectionMatrix();
  sun.shadow.camera.left = sun.shadow.camera.bottom = -ext * 2; sun.shadow.camera.right = sun.shadow.camera.top = ext * 2;
  sun.shadow.camera.updateProjectionMatrix();
}

