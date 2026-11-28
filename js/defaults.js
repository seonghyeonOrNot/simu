/* 기본 모델: 시작할 때 Open Duck Mini v2와 걷기 정책을 자동으로 불러옴 — 클래식 스크립트
   모델 파일은 원본 저장소(apirrone/Open_Duck_Playground)의 고정 커밋에서 직접 받아오고, 이 저장소에는 복사하지 않습니다.
   걷기 정책은 Open_Duck_Mini(Apache-2.0)의 BEST_WALK_ONNX_2.onnx를 models/에 둡니다. */
const DEFAULT_MODEL = {
  label: 'Open Duck Mini v2 (기본)',
  base: 'https://raw.githubusercontent.com/apirrone/Open_Duck_Playground/b9be205ac64488c23504ca42e5ec790337adeec3/playground/open_duck_mini_v2/xmls/',
  files: ['joints_properties.xml', 'open_duck_mini_v2.xml', 'open_duck_mini_v2_backlash.xml', 'scene_flat_terrain.xml', 'scene_flat_terrain_backlash.xml', 'scene_rough_terrain_backlash.xml', 'sensors.xml',
    ...['antenna', 'body_back', 'body_front', 'body_middle_bottom', 'body_middle_top', 'foot_bottom_pla', 'foot_bottom_tpu', 'foot_side', 'foot_top', 'head_bot_sheet', 'head_pitch_to_yaw', 'head_yaw_to_roll', 'head', 'left_antenna_holder', 'left_cache', 'left_knee_to_ankle_left_sheet', 'left_knee_to_ankle_right_sheet', 'left_roll_to_pitch', 'leg_spacer', 'neck_left_sheet', 'neck_right_sheet', 'right_antenna_holder', 'right_cache', 'right_roll_to_pitch', 'roll_motor_bottom', 'roll_motor_top', 'trunk_bottom', 'trunk_top'].map(n => `assets/${n}.stl`), 'assets/hfield.png'],
  policy: 'models/BEST_WALK_ONNX_2.onnx', policyName: 'BEST_WALK_ONNX_2.onnx'
};
let defaultLoading = false;
async function loadDefaultModel() {
  if (defaultLoading) return; defaultLoading = true;
  const st = $('loadState'), F = DEFAULT_MODEL.files; let n = 0;
  st.textContent = '기본 모델(Open Duck Mini v2) 불러오는 중…';
  try {
    const out = {};
    await Promise.all(F.map(async p => {
      const r = await fetch(DEFAULT_MODEL.base + p); if (!r.ok) throw new Error(`${p} (${r.status})`);
      out['xmls/' + p] = new Uint8Array(await r.arrayBuffer()); st.textContent = `기본 모델 불러오는 중… ${++n}/${F.length}`;
    }));
    await ingest(out, DEFAULT_MODEL.label);
  } catch (e) { st.textContent = '기본 모델을 받지 못했습니다 (' + (e.message || e) + '). 인터넷 연결을 확인하거나 zip을 직접 올려 주세요.'; defaultLoading = false; return; }
  try {
    if (!POL.sess) {
      const r = await fetch(DEFAULT_MODEL.policy); if (!r.ok) throw new Error('정책 파일 ' + r.status);
      await loadPolicy(new Uint8Array(await r.arrayBuffer()), DEFAULT_MODEL.policyName);
    } else startPolicy();
  } catch (e) { $('polState').textContent = '기본 걷기 정책을 불러오지 못했습니다 (' + (e.message || e) + '). 로컬 파일로 열었다면 정책 파일을 직접 불러와 주세요.'; }
  defaultLoading = false;
}

/* 모델 닫기: 장면과 시뮬레이션을 비우고 업로드 화면으로 돌아감. 불러온 정책은 기억해 두었다가 다음 모델에 다시 적용 */
function closeModel() {
  if (!model) return;
  repReset(); if (DIAG.on) setDiag(false);
  POL.active = false; updateJoy(); $('locoCtl').hidden = true; $('polOff').hidden = true;
  MAP.goal = null; MAP.trail = []; MAP.falls = []; MAP.dist = 0; MAP.view = null;
  for (const o of geomObjs) if (o) { o.geometry.dispose(); o.material.dispose(); } root.clear(); geomObjs = [];
  for (const d of decor) { d.o.geometry.dispose(); d.o.material.dispose(); } deco.clear(); decor = [];
  data.delete(); model.delete(); data = null; model = null; files = {};
  T = { rows: [], log: [], drops: [], lats: [], samples: 0, dropped: 0 };
  $('drop').hidden = false; for (const id of ['hud', 'bar', 'tag', 'closeBtn', 'sceneSel']) $(id).hidden = true;
  $('modelName').textContent = '모델 없음'; $('loadState').textContent = '모델을 닫았습니다. zip을 올리거나 설정 탭에서 기본 모델을 다시 불러올 수 있습니다.';
  $('acts').innerHTML = '<p class="note">모델을 불러오면 액추에이터마다 슬라이더가 생깁니다.</p>'; $('sens').innerHTML = '<span>센서 없음</span><span></span>'; $('nAct').textContent = '';
  $('polState').textContent = POL.sess ? `${POL.label} 불러옴. 다음 모델에 자동으로 적용됩니다.` : $('polState').textContent;
}
