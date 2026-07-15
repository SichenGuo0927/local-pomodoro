function canCloseNoticeWindow({ phase, notice }) {
  if (phase === "longBreak") {
    return true;
  }

  return notice?.type === "breakEnd" && notice.completedPhase === "longBreak";
}

module.exports = { canCloseNoticeWindow };
