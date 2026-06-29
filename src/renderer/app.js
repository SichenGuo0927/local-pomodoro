const DEFAULT_SETTINGS = {
  focusMinutes: 20,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true,
  soundEnabled: true,
  notificationsEnabled: true
};

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
  nextPhaseLabel: "短休",
  focusNumber: 1,
  notice: null,
  settings: { ...DEFAULT_SETTINGS }
};

const elements = {
  phaseLabel: document.querySelector("#phaseLabel"),
  cyclePill: document.querySelector("#cyclePill"),
  timeDisplay: document.querySelector("#timeDisplay"),
  nextLabel: document.querySelector("#nextLabel"),
  progressBar: document.querySelector("#progressBar"),
  startPauseButton: document.querySelector("#startPauseButton"),
  resetButton: document.querySelector("#resetButton"),
  skipButton: document.querySelector("#skipButton"),
  attentionBanner: document.querySelector("#attentionBanner"),
  attentionTitle: document.querySelector("#attentionTitle"),
  attentionBody: document.querySelector("#attentionBody"),
  settingsToggleButton: document.querySelector("#settingsToggleButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsForm: document.querySelector("#settingsForm"),
  focusMinutes: document.querySelector("#focusMinutes"),
  shortBreakMinutes: document.querySelector("#shortBreakMinutes"),
  longBreakMinutes: document.querySelector("#longBreakMinutes"),
  sessionsBeforeLongBreak: document.querySelector("#sessionsBeforeLongBreak"),
  autoStartNext: document.querySelector("#autoStartNext"),
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
  elements.startPauseButton.addEventListener("click", async () => {
    snapshot = snapshot.running ? await bridge.pause() : await bridge.start();
    render(snapshot);
  });

  elements.resetButton.addEventListener("click", async () => {
    snapshot = await bridge.reset();
    render(snapshot);
  });

  elements.skipButton.addEventListener("click", async () => {
    snapshot = await bridge.skip();
    render(snapshot);
  });

  elements.settingsToggleButton.addEventListener("click", () => {
    elements.settingsPanel.hidden = !elements.settingsPanel.hidden;
  });

  elements.settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    snapshot = await bridge.updateSettings(readSettingsForm());
    render(snapshot);
  });
}

function readSettingsForm() {
  return normalizeSettings({
    focusMinutes: elements.focusMinutes.value,
    shortBreakMinutes: elements.shortBreakMinutes.value,
    longBreakMinutes: elements.longBreakMinutes.value,
    sessionsBeforeLongBreak: elements.sessionsBeforeLongBreak.value,
    autoStartNext: elements.autoStartNext.checked,
    soundEnabled: elements.soundEnabled.checked,
    notificationsEnabled: elements.notificationsEnabled.checked
  });
}

function normalizeSettings(raw) {
  return {
    focusMinutes: clampInteger(raw.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
    shortBreakMinutes: clampInteger(raw.shortBreakMinutes, 1, 60, DEFAULT_SETTINGS.shortBreakMinutes),
    longBreakMinutes: clampInteger(raw.longBreakMinutes, 1, 120, DEFAULT_SETTINGS.longBreakMinutes),
    sessionsBeforeLongBreak: clampInteger(raw.sessionsBeforeLongBreak, 1, 12, DEFAULT_SETTINGS.sessionsBeforeLongBreak),
    autoStartNext: Boolean(raw.autoStartNext),
    soundEnabled: Boolean(raw.soundEnabled),
    notificationsEnabled: Boolean(raw.notificationsEnabled)
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
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
  const progress = nextSnapshot.totalSeconds === 0
    ? 0
    : ((nextSnapshot.totalSeconds - nextSnapshot.remainingSeconds) / nextSnapshot.totalSeconds) * 100;

  document.body.dataset.phase = nextSnapshot.phase;
  document.title = `${formatTime(nextSnapshot.remainingSeconds)} - ${PHASES[nextSnapshot.phase]}`;
  elements.phaseLabel.textContent = nextSnapshot.phaseTitle;
  elements.cyclePill.textContent = `${nextSnapshot.focusNumber}/${settings.sessionsBeforeLongBreak}`;
  elements.timeDisplay.textContent = formatTime(nextSnapshot.remainingSeconds);
  elements.nextLabel.textContent = `下一段：${nextSnapshot.nextPhaseLabel}`;
  elements.progressBar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
  elements.startPauseButton.textContent = nextSnapshot.running ? "⏸ 暂停" : "▶ 开始";
  renderNotice(nextSnapshot.notice);

  elements.focusMinutes.value = settings.focusMinutes;
  elements.shortBreakMinutes.value = settings.shortBreakMinutes;
  elements.longBreakMinutes.value = settings.longBreakMinutes;
  elements.sessionsBeforeLongBreak.value = settings.sessionsBeforeLongBreak;
  elements.autoStartNext.checked = settings.autoStartNext;
  elements.soundEnabled.checked = settings.soundEnabled;
  elements.notificationsEnabled.checked = settings.notificationsEnabled;
}

function renderNotice(notice) {
  if (!notice) {
    elements.attentionBanner.hidden = true;
    elements.attentionBanner.removeAttribute("data-notice");
    return;
  }

  elements.attentionBanner.dataset.notice = notice.type || "";
  elements.attentionTitle.textContent = notice.title;
  elements.attentionBody.textContent = notice.body;
  elements.attentionBanner.hidden = false;
}
