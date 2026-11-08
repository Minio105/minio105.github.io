"use strict";

/* =======================================================================
   USTAWIENIA — dźwięk, głośność, wydajność i animacje
   ======================================================================= */
(function(){
  const $ = sel => document.querySelector(sel);
  const overlay = $("#settingsOverlay");
  if(!overlay) return;

  const clampVolume = v => Math.max(0, Math.min(1, Number(v) || 0));
  const saveSettings = () => { if(typeof save === "function") save(); };

  function refreshSoundButton(){
    const b = $("#soundBtn");
    if(!b) return;
    b.textContent = state.sound ? "🔊" : "🔇";
    b.title = state.sound ? "Dźwięk: włączony" : "Dźwięk: wyłączony";
  }

  function refreshFastButton(){
    const b = $("#fastBtn");
    if(b) b.classList.toggle("on", !!state.fast);
  }

  function syncSettingsUI(){
    const sound = $("#setSound");
    if(sound) sound.checked = state.sound !== false;

    const volume = state.volume === undefined ? 1 : clampVolume(state.volume);
    const slider = $("#setVolume");
    if(slider){
      slider.value = Math.round(volume * 100);
      slider.disabled = state.sound === false;
    }
    const volVal = $("#setVolVal");
    if(volVal) volVal.textContent = Math.round(volume * 100) + "%";

    const perf = state.perfMode === true;
    const perfEl = $("#setPerf");
    if(perfEl) perfEl.checked = perf;

    const sub = $("#settingsFxSub");
    if(sub) sub.classList.toggle("disabled", perf);

    const particles = $("#setParticles");
    if(particles){
      particles.checked = state.fxParticles !== false;
      particles.disabled = perf;
    }
    const shake = $("#setShake");
    if(shake){
      shake.checked = state.screenShake !== false;
      shake.disabled = perf;
    }
    const uiAnim = $("#setUiAnim");
    if(uiAnim){
      uiAnim.checked = state.uiAnim !== false;
      uiAnim.disabled = perf;
    }

    const fast = $("#setFast");
    if(fast) fast.checked = state.fast === true;

    refreshSoundButton();
    refreshFastButton();
  }

  function clearParticles(){
    const wrap = $("#particles");
    if(wrap) wrap.innerHTML = "";
  }

  function applySettings(){
    const perf = state.perfMode === true;
    const noParticles = perf || state.fxParticles === false;
    const noUiAnim = perf || state.uiAnim === false;
    const noShake = perf || state.screenShake === false;

    document.body.classList.toggle("perf-lite", perf);
    document.body.classList.toggle("no-particles", noParticles);
    document.body.classList.toggle("no-ui-anim", noUiAnim);
    document.body.classList.toggle("no-shake", noShake);

    if(noParticles) clearParticles();
    syncSettingsUI();
  }

  function openSettings(){
    syncSettingsUI();
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-open");
    setTimeout(()=>$("#settingsClose")?.focus(), 40);
  }

  function closeSettings(){
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-open");
    $("#settingsBtn")?.focus();
  }

  $("#settingsBtn")?.addEventListener("click", openSettings);
  $("#settingsClose")?.addEventListener("click", closeSettings);
  $("#settingsDone")?.addEventListener("click", closeSettings);
  overlay.addEventListener("click", e => { if(e.target === overlay) closeSettings(); });

  document.addEventListener("keydown", e => {
    if(e.key !== "Escape" || !overlay.classList.contains("show")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeSettings();
  }, true);

  $("#setSound")?.addEventListener("change", e => {
    state.sound = e.target.checked;
    if(state.sound && typeof sfxCoin === "function") sfxCoin();
    applySettings();
    saveSettings();
  });

  $("#setVolume")?.addEventListener("input", e => {
    state.volume = clampVolume(Number(e.target.value) / 100);
    const volVal = $("#setVolVal");
    if(volVal) volVal.textContent = Math.round(state.volume * 100) + "%";
    if(typeof markDirty === "function") markDirty();
  });
  $("#setVolume")?.addEventListener("change", () => {
    if(state.sound && typeof sfxCoin === "function") sfxCoin();
    applySettings();
    saveSettings();
  });

  $("#setPerf")?.addEventListener("change", e => {
    state.perfMode = e.target.checked;
    if(e.target.checked && typeof toast === "function"){
      toast("⚡ Tryb wydajności: <b>WŁĄCZONY</b> — mniej efektów i animacji.", "good");
    }
    applySettings();
    saveSettings();
  });

  $("#setParticles")?.addEventListener("change", e => {
    state.fxParticles = e.target.checked;
    applySettings();
    saveSettings();
  });

  $("#setShake")?.addEventListener("change", e => {
    state.screenShake = e.target.checked;
    applySettings();
    saveSettings();
  });

  $("#setUiAnim")?.addEventListener("change", e => {
    state.uiAnim = e.target.checked;
    applySettings();
    saveSettings();
  });

  $("#setFast")?.addEventListener("change", e => {
    state.fast = e.target.checked;
    applySettings();
    saveSettings();
  });

  /* Szybkie przyciski w topbarze też mają odświeżać panel ustawień. */
  $("#soundBtn")?.addEventListener("click", applySettings);
  $("#fastBtn")?.addEventListener("click", applySettings);

  applySettings();
})();
