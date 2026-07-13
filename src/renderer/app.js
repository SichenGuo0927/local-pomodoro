const DEFAULT_SETTINGS = {
  focusMinutes: 20,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true,
  openAtLogin: false,
  restMode: "relaxed",
  soundEnabled: true,
  notificationsEnabled: true,
  countdownDisplayMode: "menuBar"
};
const REST_MODES = new Set(["relaxed", "strict"]);

const PHASES = {
  focus: "专注",
  shortBreak: "短休",
  longBreak: "长休"
};

const bridge = window.pomodoroApp;
let snapshot = {
  phase: "focus",
  phaseTitle: "专注",
  running: false,
  totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
  remainingSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
  completedFocusInCycle: 0,
  awaitingBreakAcknowledgement: false,
  nextPhaseLabel: "短休",
  focusNumber: 1,
  todayStats: {
    date: "",
    completedFocusSessions: 0,
    completedFocusMinutes: 0
  },
  notice: null,
  settings: { ...DEFAULT_SETTINGS }
};

const elements = {
  phaseLabel: document.querySelector("#phaseLabel"),
  cyclePill: document.querySelector("#cyclePill"),
  timeDisplay: document.querySelector("#timeDisplay"),
  nextLabel: document.querySelector("#nextLabel"),
  progressBar: document.querySelector("#progressBar"),
  todayPomodoros: document.querySelector("#todayPomodoros"),
  todayFocusMinutes: document.querySelector("#todayFocusMinutes"),
  startPauseButton: document.querySelector("#startPauseButton"),
  resetButton: document.querySelector("#resetButton"),
  skipButton: document.querySelector("#skipButton"),
  attentionBanner: document.querySelector("#attentionBanner"),
  attentionTitle: document.querySelector("#attentionTitle"),
  attentionBody: document.querySelector("#attentionBody"),
  attentionActionButton: document.querySelector("#attentionActionButton"),
  settingsToggleButton: document.querySelector("#settingsToggleButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsCloseButton: document.querySelector("#settingsCloseButton"),
  settingsForm: document.querySelector("#settingsForm"),
  focusMinutes: document.querySelector("#focusMinutes"),
  shortBreakMinutes: document.querySelector("#shortBreakMinutes"),
  longBreakMinutes: document.querySelector("#longBreakMinutes"),
  sessionsBeforeLongBreak: document.querySelector("#sessionsBeforeLongBreak"),
  countdownMenuBar: document.querySelector("#countdownMenuBar"),
  countdownFloatingWindow: document.querySelector("#countdownFloatingWindow"),
  restModeOptions: Array.from(document.querySelectorAll("input[name='restMode']")),
  autoStartNext: document.querySelector("#autoStartNext"),
  openAtLogin: document.querySelector("#openAtLogin"),
  soundEnabled: document.querySelector("#soundEnabled"),
  notificationsEnabled: document.querySelector("#notificationsEnabled")
};

bindEvents();
render(snapshot);

bridge.onState(nextSnapshot => {
  snapshot = nextSnapshot;
  render(snapshot);
});

bridge.getState().then(nextSnapshot => {
  snapshot = nextSnapshot;
  render(snapshot);
});

function bindEvents() {
  window.addEventListener("pointerdown", () => {
    if (isRestActive(snapshot)) {
      bridge.reassertRestStack();
    }
  }, { capture: true });

  elements.startPauseButton.addEventListener("click", async () => {
    if (snapshot.awaitingBreakAcknowledgement) {
      snapshot = await bridge.acknowledgeBreakEnd();
      render(snapshot);
      return;
    }

    if (isStrictRestActive(snapshot)) {
      return;
    }

    snapshot = snapshot.running ? await bridge.pause() : await bridge.start();
    render(snapshot);
  });

  elements.resetButton.addEventListener("click", async () => {
    if (isStrictRestActive(snapshot)) {
      return;
    }

    snapshot = await bridge.reset();
    render(snapshot);
  });

  elements.skipButton.addEventListener("click", async () => {
    if (isStrictRestActive(snapshot)) {
      return;
    }

    snapshot = await bridge.skip();
    render(snapshot);
  });

  elements.attentionActionButton.addEventListener("click", async () => {
    snapshot = await bridge.acknowledgeBreakEnd();
    render(snapshot);
  });

  elements.settingsToggleButton.addEventListener("click", openSettingsDialog);

  elements.settingsCloseButton.addEventListener("click", closeSettingsDialog);

  elements.settingsDialog.addEventListener("click", event => {
    if (event.target === elements.settingsDialog) {
      closeSettingsDialog();
    }
  });

  elements.settingsDialog.addEventListener("close", () => {
    bridge.setSettingsOpen(false);
    elements.settingsToggleButton.setAttribute("aria-expanded", "false");
    renderSettings(snapshot.settings);
  });

  elements.settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    snapshot = await bridge.updateSettings(readSettingsForm());
    render(snapshot);
    closeSettingsDialog();
  });
}

async function openSettingsDialog() {
  if (isRestActive(snapshot)) {
    snapshot = await bridge.openRestSettingsWindow();
    render(snapshot);
    return;
  }

  if (elements.settingsDialog.open) {
    return;
  }

  renderSettings(snapshot.settings);
  elements.settingsToggleButton.setAttribute("aria-expanded", "true");

  if (typeof elements.settingsDialog.showModal === "function") {
    elements.settingsDialog.showModal();
  } else {
    elements.settingsDialog.setAttribute("open", "");
  }

  bridge.setSettingsOpen(true);
  if (isStrictRestActive(snapshot)) {
    elements.restModeOptions.find(option => option.value === "relaxed")?.focus();
  } else {
    elements.focusMinutes.focus();
  }
}

function closeSettingsDialog() {
  if (elements.settingsDialog.open && typeof elements.settingsDialog.close === "function") {
    elements.settingsDialog.close();
    return;
  }

  elements.settingsDialog.removeAttribute("open");
  bridge.setSettingsOpen(false);
  elements.settingsToggleButton.setAttribute("aria-expanded", "false");
  renderSettings(snapshot.settings);
}

function readSettingsForm() {
  return normalizeSettings({
    focusMinutes: elements.focusMinutes.value,
    shortBreakMinutes: elements.shortBreakMinutes.value,
    longBreakMinutes: elements.longBreakMinutes.value,
    sessionsBeforeLongBreak: elements.sessionsBeforeLongBreak.value,
    countdownDisplayMode: elements.countdownFloatingWindow.checked ? "floatingWindow" : "menuBar",
    restMode: elements.restModeOptions.find(option => option.checked)?.value,
    autoStartNext: elements.autoStartNext.checked,
    openAtLogin: elements.openAtLogin.checked,
    soundEnabled: elements.soundEnabled.checked,
    notificationsEnabled: elements.notificationsEnabled.checked
  });
}

function normalizeSettings(raw) {
  return {
    focusMinutes: clampInteger(raw.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
    shortBreakMinutes: clampDecimalMinutes(raw.shortBreakMinutes, 1 / 60, 60, DEFAULT_SETTINGS.shortBreakMinutes),
    longBreakMinutes: clampInteger(raw.longBreakMinutes, 1, 120, DEFAULT_SETTINGS.longBreakMinutes),
    sessionsBeforeLongBreak: clampInteger(raw.sessionsBeforeLongBreak, 1, 12, DEFAULT_SETTINGS.sessionsBeforeLongBreak),
    countdownDisplayMode: normalizeCountdownDisplayMode(raw.countdownDisplayMode),
    restMode: normalizeRestMode(raw.restMode),
    autoStartNext: Boolean(raw.autoStartNext),
    openAtLogin: Boolean(raw.openAtLogin),
    soundEnabled: Boolean(raw.soundEnabled),
    notificationsEnabled: Boolean(raw.notificationsEnabled)
  };
}

function normalizeCountdownDisplayMode(value) {
  return value === "floatingWindow" ? "floatingWindow" : DEFAULT_SETTINGS.countdownDisplayMode;
}

function normalizeRestMode(restMode) {
  return REST_MODES.has(restMode) ? restMode : DEFAULT_SETTINGS.restMode;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function clampDecimalMinutes(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function render(nextSnapshot) {
  const settings = nextSnapshot.settings;
  const strictRestActive = isStrictRestActive(nextSnapshot);
  const progress = nextSnapshot.totalSeconds === 0
    ? 0
    : ((nextSnapshot.totalSeconds - nextSnapshot.remainingSeconds) / nextSnapshot.totalSeconds) * 100;

  document.body.dataset.phase = nextSnapshot.phase;
  document.body.dataset.strictRest = strictRestActive ? "true" : "false";
  document.title = `${formatTime(nextSnapshot.remainingSeconds)} - ${PHASES[nextSnapshot.phase]}`;
  elements.phaseLabel.textContent = nextSnapshot.phaseTitle;
  elements.cyclePill.textContent = `${nextSnapshot.focusNumber}/${settings.sessionsBeforeLongBreak}`;
  elements.timeDisplay.textContent = formatTime(nextSnapshot.remainingSeconds);
  elements.nextLabel.textContent = `下一段：${nextSnapshot.nextPhaseLabel}`;
  elements.progressBar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
  elements.startPauseButton.textContent = nextSnapshot.awaitingBreakAcknowledgement
    ? "回到专注"
    : (nextSnapshot.running ? "⏸ 暂停" : "▶ 开始");
  renderTodayStats(nextSnapshot.todayStats);
  elements.startPauseButton.disabled = strictRestActive;
  elements.resetButton.disabled = strictRestActive;
  elements.skipButton.disabled = strictRestActive;
  renderNotice(nextSnapshot.notice);
  if (!elements.settingsDialog.open) {
    renderSettings(settings);
  }
}

function renderTodayStats(todayStats = {}) {
  elements.todayPomodoros.textContent = String(readStatNumber(todayStats.completedFocusSessions));
  elements.todayFocusMinutes.textContent = String(readStatNumber(todayStats.completedFocusMinutes));
}

function readStatNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function renderSettings(settings) {
  elements.focusMinutes.value = settings.focusMinutes;
  elements.shortBreakMinutes.value = settings.shortBreakMinutes;
  elements.longBreakMinutes.value = settings.longBreakMinutes;
  elements.sessionsBeforeLongBreak.value = settings.sessionsBeforeLongBreak;
  elements.countdownMenuBar.checked = settings.countdownDisplayMode !== "floatingWindow";
  elements.countdownFloatingWindow.checked = settings.countdownDisplayMode === "floatingWindow";
  elements.restModeOptions.forEach(option => {
    option.checked = option.value === normalizeRestMode(settings.restMode);
  });
  elements.autoStartNext.checked = settings.autoStartNext;
  elements.openAtLogin.checked = settings.openAtLogin;
  elements.soundEnabled.checked = settings.soundEnabled;
  elements.notificationsEnabled.checked = settings.notificationsEnabled;

  const restrictToRestMode = isStrictRestActive(snapshot);
  [
    elements.focusMinutes,
    elements.shortBreakMinutes,
    elements.longBreakMinutes,
    elements.sessionsBeforeLongBreak,
    elements.autoStartNext,
    elements.openAtLogin,
    elements.soundEnabled,
    elements.notificationsEnabled
  ].forEach(element => {
    element.disabled = restrictToRestMode;
  });
}

function renderNotice(notice) {
  if (!notice) {
    elements.attentionBanner.hidden = true;
    elements.attentionBanner.removeAttribute("data-notice");
    elements.attentionActionButton.hidden = true;
    return;
  }

  elements.attentionBanner.dataset.notice = notice.type || "";
  elements.attentionTitle.textContent = notice.title;
  elements.attentionBody.textContent = notice.body;
  elements.attentionActionButton.textContent = notice.actionLabel || "回到专注";
  elements.attentionActionButton.hidden = !notice.requiresAcknowledgement;
  elements.attentionBanner.hidden = false;
}

function isStrictRestActive(nextSnapshot) {
  return nextSnapshot.running
    && nextSnapshot.settings.restMode === "strict"
    && (nextSnapshot.phase === "shortBreak" || nextSnapshot.phase === "longBreak");
}

function isRestActive(nextSnapshot) {
  return (nextSnapshot.phase === "shortBreak" || nextSnapshot.phase === "longBreak")
    && (nextSnapshot.running || Boolean(nextSnapshot.notice));
}
