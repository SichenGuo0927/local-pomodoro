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
  timeDisplay: document.querySelector("#timeDisplay"),
  acknowledgeButton: document.querySelector("#acknowledgeButton")
};

let snapshot = null;
let acknowledgementInFlight = false;

elements.acknowledgeButton.addEventListener("click", acknowledgeIfRequired);
elements.noticeCard.addEventListener("pointerdown", event => {
  if (event.target !== elements.acknowledgeButton) {
    acknowledgeIfRequired();
  }
});
document.addEventListener("keydown", acknowledgeIfRequired);

bridge.onState(render);
bridge.getState().then(render);

function render(nextSnapshot) {
  snapshot = nextSnapshot;
  acknowledgementInFlight = false;

  const notice = nextSnapshot.notice || {
    type: nextSnapshot.phase,
    title: nextSnapshot.phaseTitle,
    body: ""
  };

  document.title = `${formatTime(nextSnapshot.remainingSeconds)} - ${notice.title}`;
  elements.noticeCard.dataset.notice = notice.type || nextSnapshot.phase;
  elements.noticeCard.dataset.awaitingAcknowledgement = notice.requiresAcknowledgement ? "true" : "false";
  elements.phaseLabel.textContent = PHASES[nextSnapshot.phase] || nextSnapshot.phaseTitle;
  elements.noticeTitle.textContent = notice.title;
  elements.noticeBody.textContent = notice.body;
  elements.timeDisplay.textContent = formatTime(nextSnapshot.remainingSeconds);
  elements.phaseLabel.hidden = Boolean(notice.requiresAcknowledgement);
  elements.timeDisplay.hidden = Boolean(notice.requiresAcknowledgement);
  elements.acknowledgeButton.textContent = notice.actionLabel || "回到专注";
  elements.acknowledgeButton.hidden = !notice.requiresAcknowledgement;
}

async function acknowledgeIfRequired() {
  if (acknowledgementInFlight || !snapshot?.notice?.requiresAcknowledgement) {
    return;
  }

  acknowledgementInFlight = true;
  render(await bridge.acknowledgeBreakEnd());
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
