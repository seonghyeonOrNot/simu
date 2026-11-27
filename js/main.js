/* 시작: 저장된 설정 복원, 메인 루프, 10Hz 화면 갱신 */
loadStoredSettings();
requestAnimationFrame(loop);
setInterval(() => { drawScope(); updateStats(); if (model) { mapRecord(); if (DIAG.on) diagUpdate(); } drawMap(); if (REP.on) drawRepMarks(); }, 100);
