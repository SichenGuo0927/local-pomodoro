# Handoff Notes

## Status

- Product: minimal macOS Pomodoro timer.
- Current app version: `0.3.0`.
- Tech stack: Electron, plain HTML/CSS/JavaScript, pnpm.
- Current branch: `main`.
- GitHub remote: `https://github.com/SichenGuo0927/local-pomodoro`.
- Public-facing documentation is in `README.md`; version history is in `CHANGELOG.md`; this file is for handoff notes only.
- End-user install path is the one-line `install.sh` command in `README.md`; it downloads the `v0.3.0` GitHub Release DMG.

## User-Approved Behavior

- App opens paused, not auto-started.
- Timer continues in the Electron main process when the main window is hidden or closed.
- Menu Bar item remains visible and controls the app.
- Menu Bar interactions:
  - Single click opens the menu.
  - Single click again closes the menu.
  - Double click, two-finger press, or right click toggles start/pause.
- Menu Bar menu includes a circular progress icon for the current cycle.
- Main window should stay visually close to the user's screenshot: compact timer UI, alert banner when relevant, settings hidden behind the gear button and opened as a modal dialog.
- Short break starts:
  - Plays the rest sound sequence.
  - Opens a separate notice window.
  - Notice says to look out the window and stays until the next focus session starts.
- Long break starts:
  - Plays the rest sound sequence.
  - Opens a separate notice window.
  - Notice says to drink water and move around.
- Long break ends:
  - Plays the focus sound sequence.
  - Stops at the next focus session.
  - Does not auto-start the next Pomodoro cycle.
  - Brings the main app window to the front so the user can choose whether to start the next cycle.
- Rest mode:
  - Relaxed mode keeps normal reminder-window behavior.
  - Strict mode keeps the compact reminder window visible while blocking other interactions as far as Electron overlay windows allow.
  - During strict rest, Settings is the only allowed escape path; switching to relaxed mode immediately removes blockers.
- During rest, the desired visual order is app main view below the reminder window, and Settings above the reminder when open.

## 0.3.0 Upgrade Notes

- Added daily focus statistics.
- Added focus auto-pause/auto-resume on screen lock, sleep, lid close, and system-away events.
- Added break-end acknowledgement before the next focus countdown starts.
- Added relaxed/strict rest modes with strict-mode input blockers and a Settings escape path.
- Rest mode changes preserve the current phase and remaining time.

## 0.2.6 Upgrade Notes

- The settings entry changed from an inline slide-down panel to a centered modal dialog, so opening settings no longer changes the main timer layout.
- Closing the settings dialog without saving discards draft values and restores the currently saved settings; saving persists the values and closes the dialog.
- Natural long-break completion now stops at the next focus session and brings the main app window forward so the user can choose whether to start another cycle.
- The temporary feature branch `codex/settings-longbreak-popup` was merged into the renamed primary branch `main`.

## Important Files

- `README.md`
  - GitHub-facing project overview, install commands, run/build instructions, and user notes.
- `CHANGELOG.md`
  - Version history and verification notes.
- `install.sh`
  - One-line installer target. Downloads the release DMG, mounts it, and copies the app bundle into `/Applications`.
- `src/main.js`
  - Owns all timer state.
  - Builds the Menu Bar tray.
  - Plays system sounds with `afplay`.
  - Creates and closes the independent notice window.
  - Persists settings to Electron `userData/settings.json`.
- `src/renderer/`
  - Main app window.
  - Settings dialog is hidden by default and opened by the gear button.
- `src/notice/`
  - Independent break reminder window.
  - Receives the same timer state over IPC as the main window.
- `src/preload.js`
  - IPC bridge used by both windows.

## Verification Already Run

```bash
node --check src/main.js
node --check src/renderer/app.js
node --check src/notice/app.js
pnpm run package:mac
hdiutil imageinfo dist/本地番茄钟-0.2.6.dmg
```

Packaging produced `dist/本地番茄钟-0.2.6.dmg`; the `electron-builder` parent process did not exit after the artifact appeared, so it was cancelled after `hdiutil imageinfo` confirmed the DMG was valid.

Electron/CDP smoke checks were also run for:

- App opens at `20:00` with the start button.
- Settings dialog is hidden by default, opens as a centered modal from the gear button, discards unsaved edits on close, and persists saved edits.
- The long-break completion path stops at the next focus session and brings the main app window to the front.

## Generated Files And Cleanup

The workspace was cleaned before handoff:

- Removed old `dist/本地番茄钟-0.2.0` through `0.2.4` DMGs and blockmaps.
- Removed `dist/builder-debug.yml`.
- Removed root `.DS_Store`.
- Latest local installer after this upgrade: `dist/本地番茄钟-0.3.0.dmg`.

Ignored local generated directories remain present on disk but are not tracked:

- `node_modules/`
- `.pnpm-store/`
- `dist/`

## GitHub Handoff

The repository has been created and uploaded:

```text
https://github.com/SichenGuo0927/local-pomodoro
```

Notes:

- `origin` is configured as `https://github.com/SichenGuo0927/local-pomodoro.git`.
- GitHub default branch is `main`; the old remote `master` ref was removed after the rename.
- Direct `git push` hit intermittent GitHub HTTPS connectivity issues on this machine.
- The remote was populated and updated through GitHub's REST Git Database API using `gh api` when direct Git HTTPS stalled.
- If future `git push` fails with HTTP/2 errors, keep this local setting:

```bash
git config http.version HTTP/1.1
```

If the network is healthy, future pushes should be:

```bash
git push origin main
```
