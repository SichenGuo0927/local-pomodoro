const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  powerMonitor,
  powerSaveBlocker,
  screen,
  shell,
  Tray
} = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DEFAULT_SETTINGS = {
  focusMinutes: 20,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true,
  soundEnabled: true,
  notificationsEnabled: true,
  countdownDisplayMode: "menuBar"
};

const PHASES = {
  focus: {
    title: "专注",
    nextShort: "短休",
    nextLong: "长休",
    minuteKey: "focusMinutes",
    notificationTitle: "该休息一下了",
    notificationBody: "看一下窗外，远眺一下。"
  },
  shortBreak: {
    title: "短休",
    next: "专注",
    minuteKey: "shortBreakMinutes",
    notificationTitle: "短休结束",
    notificationBody: "下一轮专注开始。"
  },
  longBreak: {
    title: "长休",
    next: "专注",
    minuteKey: "longBreakMinutes",
    notificationTitle: "长休结束",
    notificationBody: "回到下一轮专注。"
  }
};

const TRAY_ICON_TEMPLATE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAMklEQVR42mNgGIrgPxQPDoP+o2GqGEKWYf8JYKoYQpRh/0nEowbRKcDpl46omrIHDgAA259zjdbe7osAAAAASUVORK5CYII=";
const TRAY_SINGLE_CLICK_DELAY_MS = 220;
const SHORT_BREAK_NOTICE = {
  type: "shortBreak",
  title: "短休息开始",
  body: "看一下窗外，远眺一下。"
};
const LONG_BREAK_NOTICE = {
  type: "longBreak",
  title: "进入长休息",
  body: "喝水，站起来走动一下。"
};
const COUNTDOWN_DISPLAY_MODES = new Set(["menuBar", "floatingWindow"]);
const BREAK_PHASES = new Set(["shortBreak", "longBreak"]);
const FLOATING_WINDOW_SIZE = {
  width: 154,
  height: 138
};
const FOCUS_AUTO_PAUSE_NOTICES = {
  lockScreen: {
    type: "focusAutoPaused",
    title: "专注已暂停",
    body: "检测到锁屏，专注计时已暂停，返回后会自动继续。"
  },
  suspend: {
    type: "focusAutoPaused",
    title: "专注已暂停",
    body: "检测到熄屏、盒盖或系统休眠，专注计时已暂停，唤醒后会自动继续。"
  },
  sessionInactive: {
    type: "focusAutoPaused",
    title: "专注已暂停",
    body: "检测到系统暂离，专注计时已暂停，返回后会自动继续。"
  }
};
const SYSTEM_SOUND_DIR = "/System/Library/Sounds";
const SOUND_SEQUENCES = {
  rest: [
    { name: "Glass.aiff", delay: 0, volume: 1.7 },
    { name: "Ping.aiff", delay: 520, volume: 1.7 },
    { name: "Glass.aiff", delay: 1040, volume: 1.7 }
  ],
  focus: [
    { name: "Hero.aiff", delay: 0, volume: 1.6 },
    { name: "Ping.aiff", delay: 620, volume: 1.6 }
  ]
};
const BREAK_END_ALERT_REPEAT_MS = 3600;

let mainWindow;
let noticeWindow;
let floatingWindow;
let tray;
let settings = { ...DEFAULT_SETTINGS };
let isQuitting = false;
let powerSaveBlockerId = null;
let notice = null;
let trayMenuOpen = false;
let activeTrayMenu = null;
let pendingTrayClickTimer = null;
let lastTrayMenuClosedAt = 0;
let dailyStats = {};
let pendingFocusAutoResume = null;
let breakEndAlertIntervalId = null;
const activeSoundTimers = new Set();
const activeSoundPlayers = new Set();

const state = {
  phase: "focus",
  completedFocusInCycle: 0,
  running: false,
  totalSeconds: minutesToSeconds(DEFAULT_SETTINGS.focusMinutes),
  remainingSeconds: minutesToSeconds(DEFAULT_SETTINGS.focusMinutes),
  endsAt: null,
  intervalId: null,
  awaitingBreakAcknowledgement: false
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 640,
    minWidth: 420,
    minHeight: 560,
    title: "本地番茄钟",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111827" : "#f7f4ee",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.once("did-finish-load", broadcastState);
  mainWindow.on("show", broadcastState);
  mainWindow.on("close", event => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setIgnoreDoubleClickEvents(false);
  tray.on("click", scheduleTrayMenuToggle);
  tray.on("double-click", toggleTimerFromTrayShortcut);
  tray.on("right-click", toggleTimerFromTrayShortcut);
  updateTray();
}

function createTrayIcon() {
  const image = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_TEMPLATE_PNG, "base64"));
  image.setTemplateImage(true);
  return image;
}

function updateTray() {
  if (!tray) {
    return;
  }

  const snapshot = getSnapshot();
  const status = `${snapshot.phaseTitle} ${formatTime(snapshot.remainingSeconds)}`;
  tray.setToolTip(`本地番茄钟 - ${status}`);
  tray.setTitle(settings.countdownDisplayMode === "menuBar" && snapshot.running ? formatTime(snapshot.remainingSeconds) : "番茄钟");
}

function buildTrayMenu() {
  const snapshot = getSnapshot();
  const status = `${snapshot.phaseTitle} ${formatTime(snapshot.remainingSeconds)}`;
  return Menu.buildFromTemplate([
    {
      label: `当前循环 ${snapshot.focusNumber}/${settings.sessionsBeforeLongBreak}`,
      icon: createCycleProgressIcon(snapshot),
      enabled: false
    },
    {
      label: status,
      enabled: false
    },
    {
      label: "显示窗口",
      click: showMainWindow
    },
    { type: "separator" },
    {
      label: state.awaitingBreakAcknowledgement ? "回到专注" : (snapshot.running ? "暂停" : "开始"),
      click: () => {
        if (state.awaitingBreakAcknowledgement) {
          acknowledgeBreakEnd();
          return;
        }

        if (state.running) {
          pauseTimer();
        } else {
          startTimer();
        }
      }
    },
    {
      label: "停止并重置",
      click: resetCurrentPhase
    },
    {
      label: "跳到下一段",
      click: () => completePhase({ manual: true })
    },
    { type: "separator" },
    {
      label: "自动进入下一段",
      type: "checkbox",
      checked: settings.autoStartNext,
      click: menuItem => {
        updateSettings({ ...settings, autoStartNext: menuItem.checked }, { reset: false });
      }
    },
    {
      label: "声音提醒",
      type: "checkbox",
      checked: settings.soundEnabled,
      click: menuItem => {
        updateSettings({ ...settings, soundEnabled: menuItem.checked }, { reset: false });
      }
    },
    {
      label: "系统通知",
      type: "checkbox",
      checked: settings.notificationsEnabled,
      click: menuItem => {
        updateSettings({ ...settings, notificationsEnabled: menuItem.checked }, { reset: false });
      }
    },
    { type: "separator" },
    {
      label: "退出本地番茄钟",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function scheduleTrayMenuToggle() {
  if (Date.now() - lastTrayMenuClosedAt < TRAY_SINGLE_CLICK_DELAY_MS) {
    return;
  }

  clearPendingTrayClick();
  pendingTrayClickTimer = setTimeout(() => {
    pendingTrayClickTimer = null;
    toggleTrayMenu();
  }, TRAY_SINGLE_CLICK_DELAY_MS);
}

function toggleTrayMenu() {
  if (!tray) {
    return;
  }

  if (trayMenuOpen) {
    closeTrayMenu();
    return;
  }

  const menu = buildTrayMenu();
  activeTrayMenu = menu;
  trayMenuOpen = true;
  menu.once("menu-will-close", () => {
    lastTrayMenuClosedAt = Date.now();
    if (activeTrayMenu === menu) {
      trayMenuOpen = false;
      activeTrayMenu = null;
    }
  });
  tray.popUpContextMenu(menu);
}

function closeTrayMenu() {
  clearPendingTrayClick();
  if (tray && trayMenuOpen) {
    tray.closeContextMenu();
  }
  lastTrayMenuClosedAt = Date.now();
  trayMenuOpen = false;
  activeTrayMenu = null;
}

function clearPendingTrayClick() {
  if (pendingTrayClickTimer) {
    clearTimeout(pendingTrayClickTimer);
    pendingTrayClickTimer = null;
  }
}

function toggleTimerFromTrayShortcut() {
  closeTrayMenu();
  if (state.awaitingBreakAcknowledgement) {
    acknowledgeBreakEnd();
    return;
  }

  if (state.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function showMainWindow(options = {}) {
  const { stealFocus = false } = options;

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  if (typeof mainWindow.moveTop === "function") {
    mainWindow.moveTop();
  }
  mainWindow.focus();

  if (stealFocus && process.platform === "darwin") {
    app.focus({ steal: true });
  }
}

function startTimer(options = {}) {
  const { autoResume = false } = options;

  if (state.awaitingBreakAcknowledgement) {
    return acknowledgeBreakEnd();
  }

  if (!autoResume) {
    clearPendingFocusAutoResume();
  }

  if (state.running) {
    return getSnapshot();
  }

  if (state.phase === "focus") {
    clearNotice();
  }
  state.running = true;
  state.endsAt = Date.now() + state.remainingSeconds * 1000;
  state.intervalId = setInterval(tick, 1000);
  startPowerSaveBlocker();
  tick();
  return getSnapshot();
}

function pauseTimer(options = {}) {
  const { keepAutoResume = false } = options;

  if (!keepAutoResume) {
    clearPendingFocusAutoResume();
  }

  if (!state.running) {
    return getSnapshot();
  }

  clearInterval(state.intervalId);
  state.intervalId = null;
  state.remainingSeconds = secondsUntilEnd();
  state.running = false;
  state.endsAt = null;
  stopPowerSaveBlocker();
  broadcastState();
  return getSnapshot();
}

function pauseFocusForSystemAway(reason) {
  if (!state.running || state.phase !== "focus") {
    return getSnapshot();
  }

  const pauseNotice = FOCUS_AUTO_PAUSE_NOTICES[reason] || FOCUS_AUTO_PAUSE_NOTICES.suspend;
  pendingFocusAutoResume = {
    reason,
    pausedAt: Date.now()
  };
  pauseTimer({ keepAutoResume: true });
  notice = { ...pauseNotice };
  broadcastState();
  return getSnapshot();
}

function resumeFocusAfterSystemAway() {
  if (!pendingFocusAutoResume) {
    return getSnapshot();
  }

  clearPendingFocusAutoResume();

  if (state.running || state.phase !== "focus" || state.remainingSeconds <= 0) {
    return getSnapshot();
  }

  return startTimer({ autoResume: true });
}

function clearPendingFocusAutoResume() {
  pendingFocusAutoResume = null;
}

function resetCurrentPhase() {
  clearPendingFocusAutoResume();
  clearNotice();
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.running = false;
  state.totalSeconds = durationForPhase(state.phase);
  state.remainingSeconds = state.totalSeconds;
  state.endsAt = null;
  stopPowerSaveBlocker();
  broadcastState();
  return getSnapshot();
}

function tick() {
  state.remainingSeconds = secondsUntilEnd();
  if (state.remainingSeconds <= 0) {
    completePhase({ manual: false });
    return;
  }

  broadcastState();
}

function completePhase({ manual }) {
  clearPendingFocusAutoResume();
  if (state.awaitingBreakAcknowledgement) {
    return acknowledgeBreakEnd();
  }

  const completedPhase = state.phase;
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.running = false;
  state.remainingSeconds = 0;
  state.endsAt = null;
  stopPowerSaveBlocker();
  if (!manual && completedPhase === "focus") {
    recordCompletedFocusSession(state.totalSeconds);
  }
  broadcastState();

  advancePhase(completedPhase);
  if (!manual && isBreakPhase(completedPhase)) {
    showMainWindow({ stealFocus: true });
    beginBreakEndAcknowledgement(completedPhase);
    broadcastState();
    return getSnapshot();
  }

  if (state.phase !== "longBreak") {
    clearNotice();
  }

  if (!manual) {
    announceTransition(completedPhase, state.phase);
  } else {
    showNoticeForPhase(state.phase);
  }

  broadcastState();

  if (settings.autoStartNext && completedPhase !== "longBreak") {
    startTimer();
  }

  if (!manual && completedPhase === "longBreak") {
    showMainWindow({ stealFocus: true });
  }

  return getSnapshot();
}

function advancePhase(completedPhase) {
  if (completedPhase === "focus") {
    state.completedFocusInCycle += 1;
    state.phase = state.completedFocusInCycle >= settings.sessionsBeforeLongBreak ? "longBreak" : "shortBreak";
  } else {
    if (completedPhase === "longBreak") {
      state.completedFocusInCycle = 0;
    }
    state.phase = "focus";
  }

  state.totalSeconds = durationForPhase(state.phase);
  state.remainingSeconds = state.totalSeconds;
  state.endsAt = null;
}

function isBreakPhase(phase) {
  return phase === "shortBreak" || phase === "longBreak";
}

function beginBreakEndAcknowledgement(completedPhase) {
  state.awaitingBreakAcknowledgement = true;
  notice = createBreakEndNotice(completedPhase);

  if (settings.notificationsEnabled && Notification.isSupported()) {
    new Notification({
      title: notice.title,
      body: notice.body,
      silent: true
    }).show();
  }

  if (settings.soundEnabled) {
    startBreakEndAlert();
  }

  showNoticeWindow();
}

function createBreakEndNotice(completedPhase) {
  const completedTitle = PHASES[completedPhase].title;
  return {
    type: "breakEnd",
    title: `${completedTitle}结束`,
    body: "准备好后，回到下一轮专注。",
    actionLabel: "回到专注",
    requiresAcknowledgement: true
  };
}

function acknowledgeBreakEnd() {
  if (!state.awaitingBreakAcknowledgement) {
    return getSnapshot();
  }

  state.awaitingBreakAcknowledgement = false;
  stopAllSounds();
  clearNotice();
  startTimer();
  return getSnapshot();
}

function updateSettings(nextSettings, options = { reset: true }) {
  const previousSettings = settings;
  settings = normalizeSettings(nextSettings);
  saveSettings(settings);

  if (options.reset && shouldResetTimerForSettingsChange(previousSettings, settings)) {
    state.totalSeconds = durationForPhase(state.phase);
    state.remainingSeconds = Math.min(state.remainingSeconds, state.totalSeconds);
    resetCurrentPhase();
  } else {
    if (state.awaitingBreakAcknowledgement && !settings.soundEnabled) {
      stopAllSounds();
    } else if (state.awaitingBreakAcknowledgement && settings.soundEnabled && !breakEndAlertIntervalId) {
      startBreakEndAlert();
    }
    broadcastState();
  }

  return getSnapshot();
}

function shouldResetTimerForSettingsChange(previousSettings, nextSettings) {
  return previousSettings.focusMinutes !== nextSettings.focusMinutes
    || previousSettings.shortBreakMinutes !== nextSettings.shortBreakMinutes
    || previousSettings.longBreakMinutes !== nextSettings.longBreakMinutes
    || previousSettings.sessionsBeforeLongBreak !== nextSettings.sessionsBeforeLongBreak
    || previousSettings.autoStartNext !== nextSettings.autoStartNext
    || previousSettings.soundEnabled !== nextSettings.soundEnabled
    || previousSettings.notificationsEnabled !== nextSettings.notificationsEnabled;
}

function announceTransition(completedPhase, nextPhase) {
  if (settings.soundEnabled) {
    playTransitionSound(nextPhase);
  }

  if (settings.notificationsEnabled && Notification.isSupported()) {
    new Notification({
      title: PHASES[completedPhase].notificationTitle,
      body: PHASES[completedPhase].notificationBody,
      silent: true
    }).show();
  }

  if (nextPhase === "longBreak") {
    showLongBreakNotice();
  } else if (nextPhase === "shortBreak") {
    showShortBreakNotice();
  }
}

function playTransitionSound(nextPhase) {
  const sequence = nextPhase === "focus" ? SOUND_SEQUENCES.focus : SOUND_SEQUENCES.rest;
  playSoundSequence(sequence);
}

function startBreakEndAlert() {
  stopAllSounds();
  playBreakEndAlertPulse();
  breakEndAlertIntervalId = setInterval(playBreakEndAlertPulse, BREAK_END_ALERT_REPEAT_MS);
}

function playBreakEndAlertPulse() {
  playSoundSequence(SOUND_SEQUENCES.focus);
}

function playSoundSequence(sequence) {
  let played = false;

  sequence.forEach(({ name, delay, volume }) => {
    const soundPath = path.join(SYSTEM_SOUND_DIR, name);
    if (!fs.existsSync(soundPath)) {
      return;
    }

    played = true;
    scheduleSoundTimer(() => spawnSoundPlayer(soundPath, volume), delay);
  });

  if (!played) {
    [0, 260, 520, 780].forEach(delay => scheduleSoundTimer(() => shell.beep(), delay));
  }
}

function scheduleSoundTimer(callback, delay) {
  const timerId = setTimeout(() => {
    activeSoundTimers.delete(timerId);
    callback();
  }, delay);
  activeSoundTimers.add(timerId);
  return timerId;
}

function spawnSoundPlayer(soundPath, volume) {
  const player = spawn("afplay", ["-v", String(volume), soundPath], {
    stdio: "ignore"
  });
  activeSoundPlayers.add(player);

  const forgetPlayer = () => {
    activeSoundPlayers.delete(player);
  };
  player.once("exit", forgetPlayer);
  player.once("error", forgetPlayer);
}

function stopAllSounds() {
  if (breakEndAlertIntervalId) {
    clearInterval(breakEndAlertIntervalId);
    breakEndAlertIntervalId = null;
  }

  activeSoundTimers.forEach(timerId => clearTimeout(timerId));
  activeSoundTimers.clear();

  activeSoundPlayers.forEach(player => {
    if (!player.killed) {
      player.kill();
    }
  });
  activeSoundPlayers.clear();
}

function showLongBreakNotice() {
  notice = { ...LONG_BREAK_NOTICE };
  showNoticeWindow();
}

function showShortBreakNotice() {
  notice = { ...SHORT_BREAK_NOTICE };
  showNoticeWindow();
}

function showNoticeForPhase(phase) {
  if (phase === "longBreak") {
    showLongBreakNotice();
  } else if (phase === "shortBreak") {
    showShortBreakNotice();
  }
}

function showNoticeWindow() {
  if (!noticeWindow || noticeWindow.isDestroyed()) {
    noticeWindow = new BrowserWindow({
      width: 380,
      height: 260,
      minWidth: 340,
      minHeight: 220,
      maxWidth: 440,
      maxHeight: 320,
      title: "本地番茄钟提醒",
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? "#111827" : "#f7f4ee",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    });

    noticeWindow.loadFile(path.join(__dirname, "notice", "index.html"));
    noticeWindow.once("ready-to-show", () => {
      if (noticeWindow && !noticeWindow.isDestroyed()) {
        noticeWindow.show();
        noticeWindow.focus();
      }
    });
    noticeWindow.webContents.once("did-finish-load", broadcastState);
    noticeWindow.on("close", event => {
      if (isQuitting || !notice) {
        return;
      }
      event.preventDefault();
      noticeWindow.show();
    });
  } else {
    noticeWindow.show();
    noticeWindow.focus();
  }

  if (noticeWindow && !noticeWindow.isDestroyed()) {
    noticeWindow.flashFrame(true);
    noticeWindow.setAlwaysOnTop(true, "floating");
    setTimeout(() => {
      if (noticeWindow && !noticeWindow.isDestroyed()) {
        noticeWindow.flashFrame(false);
      }
    }, 3500);
  }
}

function clearNotice() {
  state.awaitingBreakAcknowledgement = false;
  stopAllSounds();
  notice = null;
  closeNoticeWindow();
}

function closeNoticeWindow() {
  if (!noticeWindow || noticeWindow.isDestroyed()) {
    return;
  }
  const windowToClose = noticeWindow;
  noticeWindow = null;
  windowToClose.close();
}

function syncFloatingCountdownWindow(snapshot = getSnapshot()) {
  if (!shouldShowFloatingCountdownWindow(snapshot)) {
    hideFloatingCountdownWindow();
    return;
  }

  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingCountdownWindow();
  }

  sendFloatingCountdownState(snapshot);
  showFloatingCountdownWindow();
}

function shouldShowFloatingCountdownWindow(snapshot) {
  return settings.countdownDisplayMode === "floatingWindow"
    && snapshot.running
    && !hasBreakNotice(snapshot);
}

function hasBreakNotice(snapshot) {
  if (!BREAK_PHASES.has(snapshot.phase)) {
    return false;
  }

  return Boolean(snapshot.notice) || Boolean(noticeWindow && !noticeWindow.isDestroyed());
}

function createFloatingCountdownWindow() {
  const nextFloatingWindow = new BrowserWindow({
    width: FLOATING_WINDOW_SIZE.width,
    height: FLOATING_WINDOW_SIZE.height,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    show: false,
    title: "本地番茄钟倒计时",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  floatingWindow = nextFloatingWindow;
  positionFloatingCountdownWindow();
  nextFloatingWindow.loadFile(path.join(__dirname, "floating", "index.html"));
  nextFloatingWindow.once("ready-to-show", () => {
    if (floatingWindow !== nextFloatingWindow || nextFloatingWindow.isDestroyed()) {
      return;
    }

    if (shouldShowFloatingCountdownWindow(getSnapshot())) {
      showFloatingCountdownWindow();
    }
  });
  nextFloatingWindow.webContents.once("did-finish-load", () => {
    if (floatingWindow !== nextFloatingWindow || nextFloatingWindow.isDestroyed()) {
      return;
    }

    sendFloatingCountdownState(getSnapshot());
    if (shouldShowFloatingCountdownWindow(getSnapshot())) {
      showFloatingCountdownWindow();
    }
  });
  nextFloatingWindow.on("closed", () => {
    if (floatingWindow === nextFloatingWindow) {
      floatingWindow = null;
    }
  });
}

function sendFloatingCountdownState(snapshot) {
  if (!floatingWindow || floatingWindow.isDestroyed() || floatingWindow.webContents.isLoading()) {
    return;
  }

  floatingWindow.webContents.send("timer-state", snapshot);
}

function showFloatingCountdownWindow() {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    return;
  }

  floatingWindow.setAlwaysOnTop(true, "floating");
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (floatingWindow.webContents.isLoading()) {
    return;
  }

  if (floatingWindow.isVisible()) {
    return;
  }

  if (typeof floatingWindow.showInactive === "function") {
    floatingWindow.showInactive();
  } else {
    floatingWindow.show();
  }
}

function hideFloatingCountdownWindow() {
  if (!floatingWindow || floatingWindow.isDestroyed() || !floatingWindow.isVisible()) {
    return;
  }

  floatingWindow.hide();
}

function positionFloatingCountdownWindow() {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    return;
  }

  const { workArea } = screen.getPrimaryDisplay();
  floatingWindow.setBounds({
    width: FLOATING_WINDOW_SIZE.width,
    height: FLOATING_WINDOW_SIZE.height,
    x: Math.round(workArea.x + workArea.width - FLOATING_WINDOW_SIZE.width - 16),
    y: Math.round(workArea.y + 16)
  });
}

function createCycleProgressIcon(snapshot) {
  const total = Math.max(1, settings.sessionsBeforeLongBreak);
  const progress = Math.min(Math.max(snapshot.focusNumber / total, 0), 1);
  return nativeImage.createFromBuffer(createProgressPng(progress));
}

function createProgressPng(progress) {
  const width = 44;
  const height = 44;
  const center = 22;
  const outerRadius = 15;
  const innerRadius = 10;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      const onRing = distance >= innerRadius && distance <= outerRadius;

      if (!onRing) {
        continue;
      }

      const angle = (Math.atan2(y + 0.5 - center, x + 0.5 - center) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      const isFilled = angle <= progress * Math.PI * 2;
      const color = isFilled ? [15, 118, 110, 255] : [209, 213, 219, 255];
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }

  return encodePng(width, height, pixels);
}

function encodePng(width, height, rgbaPixels) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
    rgbaPixels.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    createPngChunk("IDAT", zlib.deflateSync(raw)),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(crcInput))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function broadcastState() {
  const snapshot = getSnapshot();
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send("timer-state", snapshot);
    }
  });
  updateDockBadge(snapshot);
  updateTray();
  syncFloatingCountdownWindow(snapshot);
}

function getSnapshot() {
  return {
    phase: state.phase,
    phaseTitle: PHASES[state.phase].title,
    running: state.running,
    totalSeconds: state.totalSeconds,
    remainingSeconds: state.remainingSeconds,
    completedFocusInCycle: state.completedFocusInCycle,
    awaitingBreakAcknowledgement: state.awaitingBreakAcknowledgement,
    nextPhaseLabel: getNextPhaseLabel(),
    focusNumber: Math.min(state.completedFocusInCycle + 1, settings.sessionsBeforeLongBreak),
    todayStats: getTodayStats(),
    notice,
    settings
  };
}

function getNextPhaseLabel() {
  if (state.phase === "focus") {
    return state.completedFocusInCycle + 1 >= settings.sessionsBeforeLongBreak
      ? PHASES.focus.nextLong
      : PHASES.focus.nextShort;
  }
  return PHASES[state.phase].next;
}

function durationForPhase(phase) {
  return minutesToSeconds(settings[PHASES[phase].minuteKey]);
}

function minutesToSeconds(minutes) {
  return Math.max(1, Math.round(minutes * 60));
}

function secondsUntilEnd() {
  if (!state.endsAt) {
    return state.remainingSeconds;
  }
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function startPowerSaveBlocker() {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    return;
  }
  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
}

function stopPowerSaveBlocker() {
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }
  powerSaveBlockerId = null;
}

function updateDockBadge(snapshot) {
  if (process.platform === "darwin") {
    app.dock.setBadge(snapshot.running ? String(Math.ceil(snapshot.remainingSeconds / 60)) : "");
  }
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDailyStatsPath() {
  return path.join(app.getPath("userData"), "daily-stats.json");
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...saved });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(nextSettings) {
  ensureUserDataDir();
  fs.writeFileSync(getSettingsPath(), JSON.stringify(nextSettings, null, 2));
}

function loadDailyStats() {
  try {
    const saved = JSON.parse(fs.readFileSync(getDailyStatsPath(), "utf8"));
    return normalizeDailyStats(saved);
  } catch {
    return {};
  }
}

function saveDailyStats() {
  ensureUserDataDir();
  fs.writeFileSync(getDailyStatsPath(), JSON.stringify(dailyStats, null, 2));
}

function ensureUserDataDir() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
}

function recordCompletedFocusSession(durationSeconds) {
  const dateKey = getLocalDateKey();
  const currentStats = getStatsForDate(dateKey);
  dailyStats[dateKey] = {
    completedFocusSessions: currentStats.completedFocusSessions + 1,
    completedFocusMinutes: currentStats.completedFocusMinutes + secondsToCompletedMinutes(durationSeconds)
  };
  saveDailyStats();
}

function getTodayStats() {
  const dateKey = getLocalDateKey();
  return {
    date: dateKey,
    ...getStatsForDate(dateKey)
  };
}

function getStatsForDate(dateKey) {
  return normalizeDailyStat(dailyStats[dateKey]);
}

function normalizeDailyStats(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return Object.entries(raw).reduce((statsByDate, [dateKey, stats]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return statsByDate;
    }

    statsByDate[dateKey] = normalizeDailyStat(stats);
    return statsByDate;
  }, {});
}

function normalizeDailyStat(raw) {
  return {
    completedFocusSessions: clampNonNegativeInteger(raw?.completedFocusSessions),
    completedFocusMinutes: clampNonNegativeInteger(raw?.completedFocusMinutes)
  };
}

function clampNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function secondsToCompletedMinutes(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSettings(raw) {
  return {
    focusMinutes: clampInteger(raw.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
    shortBreakMinutes: clampDecimalMinutes(raw.shortBreakMinutes, 1 / 60, 60, DEFAULT_SETTINGS.shortBreakMinutes),
    longBreakMinutes: clampInteger(raw.longBreakMinutes, 1, 120, DEFAULT_SETTINGS.longBreakMinutes),
    sessionsBeforeLongBreak: clampInteger(raw.sessionsBeforeLongBreak, 1, 12, DEFAULT_SETTINGS.sessionsBeforeLongBreak),
    autoStartNext: Boolean(raw.autoStartNext),
    soundEnabled: Boolean(raw.soundEnabled),
    notificationsEnabled: Boolean(raw.notificationsEnabled),
    countdownDisplayMode: normalizeCountdownDisplayMode(raw.countdownDisplayMode)
  };
}

function normalizeCountdownDisplayMode(value) {
  return COUNTDOWN_DISPLAY_MODES.has(value) ? value : DEFAULT_SETTINGS.countdownDisplayMode;
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

ipcMain.handle("timer:get-state", async () => getSnapshot());
ipcMain.handle("timer:start", async () => startTimer());
ipcMain.handle("timer:pause", async () => pauseTimer());
ipcMain.handle("timer:reset", async () => resetCurrentPhase());
ipcMain.handle("timer:skip", async () => completePhase({ manual: true }));
ipcMain.handle("timer:acknowledge-break-end", async () => acknowledgeBreakEnd());
ipcMain.handle("timer:update-settings", async (_event, nextSettings) => updateSettings(nextSettings, { reset: true }));
ipcMain.handle("window:show", async () => showMainWindow());

app.whenReady().then(() => {
  app.setName("本地番茄钟");
  settings = loadSettings();
  dailyStats = loadDailyStats();
  state.totalSeconds = durationForPhase(state.phase);
  state.remainingSeconds = state.totalSeconds;
  powerMonitor.on("lock-screen", () => pauseFocusForSystemAway("lockScreen"));
  powerMonitor.on("suspend", () => pauseFocusForSystemAway("suspend"));
  powerMonitor.on("user-did-resign-active", () => pauseFocusForSystemAway("sessionInactive"));
  powerMonitor.on("resume", resumeFocusAfterSystemAway);
  powerMonitor.on("unlock-screen", resumeFocusAfterSystemAway);
  powerMonitor.on("user-did-become-active", resumeFocusAfterSystemAway);
  createTray();
  createWindow();

  app.on("activate", showMainWindow);
});

app.on("before-quit", () => {
  isQuitting = true;
  stopPowerSaveBlocker();
  stopAllSounds();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
