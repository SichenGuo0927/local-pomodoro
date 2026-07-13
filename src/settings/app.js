const DEFAULT_SETTINGS = {
  focusMinutes: 20,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true,
  openAtLogin: false,
  restMode: "relaxed",
  soundEnabled: true,
  notificationsEnabled: true
};
const REST_MODES = new Set(["relaxed", "strict"]);

const bridge = window.pomodoroApp;
let snapshot = {
  phase: "focus",
  running: false,
  notice: null,
  settings: { ...DEFAULT_SETTINGS }
};
let formDirty = false;

const elements = {
  settingsCloseButton: document.querySelector("#settingsCloseButton"),
  settingsForm: document.querySelector("#settingsForm"),
  focusMinutes: document.querySelector("#focusMinutes"),
  shortBreakMinutes: document.querySelector("#shortBreakMinutes"),
  longBreakMinutes: document.querySelector("#longBreakMinutes"),
  sessionsBeforeLongBreak: document.querySelector("#sessionsBeforeLongBreak"),
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
  if (!formDirty) {
    render(snapshot);
  }
});

bridge.getState().then(nextSnapshot => {
  snapshot = nextSnapshot;
  render(snapshot);
  elements.restModeOptions.find(option => option.checked)?.focus();
});

function bindEvents() {
  window.addEventListener("pointerdown", () => {
    bridge.reassertRestStack();
  }, { capture: true });
  elements.settingsCloseButton.addEventListener("click", () => window.close());
  elements.settingsForm.addEventListener("input", () => {
    formDirty = true;
  });
  elements.settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    snapshot = await bridge.updateSettings(readSettingsForm());
    formDirty = false;
    render(snapshot);
    window.close();
  });
}

function readSettingsForm() {
  return normalizeSettings({
    focusMinutes: elements.focusMinutes.value,
    shortBreakMinutes: elements.shortBreakMinutes.value,
    longBreakMinutes: elements.longBreakMinutes.value,
    sessionsBeforeLongBreak: elements.sessionsBeforeLongBreak.value,
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
    restMode: normalizeRestMode(raw.restMode),
    autoStartNext: Boolean(raw.autoStartNext),
    openAtLogin: Boolean(raw.openAtLogin),
    soundEnabled: Boolean(raw.soundEnabled),
    notificationsEnabled: Boolean(raw.notificationsEnabled)
  };
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

function render(nextSnapshot) {
  renderSettings(nextSnapshot.settings);
}

function renderSettings(settings) {
  elements.focusMinutes.value = settings.focusMinutes;
  elements.shortBreakMinutes.value = settings.shortBreakMinutes;
  elements.longBreakMinutes.value = settings.longBreakMinutes;
  elements.sessionsBeforeLongBreak.value = settings.sessionsBeforeLongBreak;
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

function isStrictRestActive(nextSnapshot) {
  return nextSnapshot.running
    && nextSnapshot.settings.restMode === "strict"
    && (nextSnapshot.phase === "shortBreak" || nextSnapshot.phase === "longBreak");
}
