const PHASES = {
  focus: "专注",
  shortBreak: "短休",
  longBreak: "长休"
};
const SECONDARY_DOUBLE_CLICK_MS = 320;
const SECONDARY_LONG_PRESS_MS = 700;
const GESTURE_FEEDBACK_MS = 260;

const bridge = window.pomodoroApp;
let snapshot = null;
let secondaryPress = null;
let pendingSecondaryClickTimer = null;
let lastSecondaryReleaseAt = 0;
let feedbackTimer = null;
const elements = {
  openButton: document.querySelector("#openButton"),
  phaseLabel: document.querySelector("#phaseLabel"),
  timeDisplay: document.querySelector("#timeDisplay")
};

elements.openButton.addEventListener("click", event => {
  if (event.button === 0) {
    showMainWindow();
  }
});
elements.openButton.addEventListener("pointerdown", handlePointerDown);
elements.openButton.addEventListener("pointerup", handlePointerUp);
elements.openButton.addEventListener("pointercancel", cancelSecondaryPress);
elements.openButton.addEventListener("lostpointercapture", cancelSecondaryPress);
elements.openButton.addEventListener("contextmenu", event => event.preventDefault());

bridge.onState(nextSnapshot => {
  snapshot = nextSnapshot;
  render(snapshot);
});
bridge.getState().then(nextSnapshot => {
  snapshot = nextSnapshot;
  render(snapshot);
});

function handlePointerDown(event) {
  if (event.button !== 2) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const doubleClickCandidate = Date.now() - lastSecondaryReleaseAt <= SECONDARY_DOUBLE_CLICK_MS;
  if (doubleClickCandidate) {
    clearPendingSecondaryClick();
  }

  elements.openButton.setPointerCapture?.(event.pointerId);
  setGestureFeedback("holding", { persistent: true });
  secondaryPress = {
    pointerId: event.pointerId,
    doubleClickCandidate,
    longPressTriggered: false,
    longPressTimer: setTimeout(() => {
      if (!secondaryPress || secondaryPress.pointerId !== event.pointerId) {
        return;
      }
      secondaryPress.longPressTriggered = true;
      clearPendingSecondaryClick();
      performGestureAction("reset");
    }, SECONDARY_LONG_PRESS_MS)
  };
}

function handlePointerUp(event) {
  if (event.button !== 2 || !secondaryPress || secondaryPress.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const completedPress = secondaryPress;
  clearTimeout(completedPress.longPressTimer);
  secondaryPress = null;
  elements.openButton.releasePointerCapture?.(event.pointerId);

  if (completedPress.longPressTriggered) {
    return;
  }

  if (completedPress.doubleClickCandidate) {
    lastSecondaryReleaseAt = 0;
    performGestureAction("skip");
    return;
  }

  lastSecondaryReleaseAt = Date.now();
  setGestureFeedback(null);
  clearPendingSecondaryClick();
  pendingSecondaryClickTimer = setTimeout(() => {
    pendingSecondaryClickTimer = null;
    lastSecondaryReleaseAt = 0;
    performGestureAction("toggle");
  }, SECONDARY_DOUBLE_CLICK_MS);
}

function cancelSecondaryPress(event) {
  if (!secondaryPress || (event.pointerId !== undefined && secondaryPress.pointerId !== event.pointerId)) {
    return;
  }

  clearTimeout(secondaryPress.longPressTimer);
  secondaryPress = null;
  setGestureFeedback(null);
}

function clearPendingSecondaryClick() {
  if (pendingSecondaryClickTimer !== null) {
    clearTimeout(pendingSecondaryClickTimer);
    pendingSecondaryClickTimer = null;
  }
}

async function performGestureAction(action) {
  if (!snapshot) {
    return;
  }

  if (action === "skip") {
    setGestureFeedback("skip");
    snapshot = await bridge.skip();
  } else if (action === "reset") {
    setGestureFeedback("reset");
    snapshot = await bridge.reset();
  } else {
    setGestureFeedback(snapshot.running ? "pause" : "start");
    snapshot = snapshot.running ? await bridge.pause() : await bridge.start();
  }
  render(snapshot);
}

function setGestureFeedback(gesture, options = {}) {
  const { persistent = false } = options;
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }

  if (gesture) {
    document.body.dataset.gesture = gesture;
  } else {
    delete document.body.dataset.gesture;
  }

  if (gesture && !persistent) {
    feedbackTimer = setTimeout(() => {
      feedbackTimer = null;
      delete document.body.dataset.gesture;
    }, GESTURE_FEEDBACK_MS);
  }
}

function render(snapshot) {
  document.body.dataset.phase = snapshot.phase;
  document.title = `${formatTime(snapshot.remainingSeconds)} - ${snapshot.phaseTitle}`;
  elements.phaseLabel.textContent = PHASES[snapshot.phase] || snapshot.phaseTitle;
  elements.timeDisplay.textContent = formatTime(snapshot.remainingSeconds);
}

function showMainWindow() {
  bridge.showWindow();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
