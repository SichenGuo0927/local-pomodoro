const PHASES = {
  focus: "专注",
  shortBreak: "短休",
  longBreak: "长休"
};

const bridge = window.pomodoroApp;
const elements = {
  openButton: document.querySelector("#openButton"),
  phaseLabel: document.querySelector("#phaseLabel"),
  timeDisplay: document.querySelector("#timeDisplay")
};

elements.openButton.addEventListener("click", showMainWindow);

bridge.onState(render);
bridge.getState().then(render);

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
