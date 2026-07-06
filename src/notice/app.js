const PHASES = {
  focus: "专注",
  shortBreak: "短休",
  longBreak: "长休"
};

const bridge = window.pomodoroApp;
const elements = {
  noticeCard: document.querySelector("#noticeCard"),
  phaseLabel: document.querySelector("#phaseLabel"),
  noticeTitle: document.querySelector("#noticeTitle"),
  noticeBody: document.querySelector("#noticeBody"),
  timeDisplay: document.querySelector("#timeDisplay")
};

window.addEventListener("pointerdown", () => {
  bridge.reassertRestStack();
}, { capture: true });

bridge.onState(render);
bridge.getState().then(render);

function render(snapshot) {
  const notice = snapshot.notice || {
    type: snapshot.phase,
    title: snapshot.phaseTitle,
    body: ""
  };

  document.title = `${formatTime(snapshot.remainingSeconds)} - ${notice.title}`;
  elements.noticeCard.dataset.notice = notice.type || snapshot.phase;
  elements.phaseLabel.textContent = PHASES[snapshot.phase] || snapshot.phaseTitle;
  elements.noticeTitle.textContent = notice.title;
  elements.noticeBody.textContent = notice.body;
  elements.timeDisplay.textContent = formatTime(snapshot.remainingSeconds);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
