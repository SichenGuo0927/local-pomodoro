const test = require("node:test");
const assert = require("node:assert/strict");

const { canCloseNoticeWindow } = require("../src/notice-close-policy");

test("allows the reminder window to close during a long break", () => {
  assert.equal(canCloseNoticeWindow({
    phase: "longBreak",
    notice: { type: "longBreak" }
  }), true);
});

test("allows the return-to-focus reminder to close after a long break", () => {
  assert.equal(canCloseNoticeWindow({
    phase: "focus",
    notice: { type: "breakEnd", completedPhase: "longBreak" }
  }), true);
});

test("keeps short-break reminders protected from direct closing", () => {
  assert.equal(canCloseNoticeWindow({
    phase: "shortBreak",
    notice: { type: "shortBreak" }
  }), false);

  assert.equal(canCloseNoticeWindow({
    phase: "focus",
    notice: { type: "breakEnd", completedPhase: "shortBreak" }
  }), false);
});
