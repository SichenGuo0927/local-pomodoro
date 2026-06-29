# Handoff Notes

## Status

- Product: minimal macOS Pomodoro timer.
- Current app version: `0.2.5`.
- Tech stack: Electron, plain HTML/CSS/JavaScript, pnpm.
- Current branch: repository is still on initial `master` unless changed after this handoff.
- No GitHub remote was configured at handoff time.

## User-Approved Behavior

- App opens paused, not auto-started.
- Timer continues in the Electron main process when the main window is hidden or closed.
- Menu Bar item remains visible and controls the app.
- Menu Bar interactions:
  - Single click opens the menu.
  - Single click again closes the menu.
  - Double click, two-finger press, or right click toggles start/pause.
- Menu Bar menu includes a circular progress icon for the current cycle.
- Main window should stay visually close to the user's screenshot: compact timer UI, alert banner when relevant, settings hidden behind the gear button.
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

## Important Files

- `src/main.js`
  - Owns all timer state.
  - Builds the Menu Bar tray.
  - Plays system sounds with `afplay`.
  - Creates and closes the independent notice window.
  - Persists settings to Electron `userData/settings.json`.
- `src/renderer/`
  - Main app window.
  - Settings panel is hidden by default and toggled by the gear button.
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
hdiutil imageinfo dist/本地番茄钟-0.2.5.dmg
```

Playwright/Electron smoke checks were also run for:

- App opens at `20:00` with the start button.
- Settings panel is hidden by default and opens from the gear button.
- Skipping from focus to short break creates a second independent notice window.

## Generated Files And Cleanup

The workspace was cleaned before handoff:

- Removed old `dist/本地番茄钟-0.2.0` through `0.2.4` DMGs and blockmaps.
- Removed `dist/builder-debug.yml`.
- Removed root `.DS_Store`.
- Kept only the latest local installer: `dist/本地番茄钟-0.2.5.dmg`.

Ignored local generated directories remain present on disk but are not tracked:

- `node_modules/`
- `.pnpm-store/`
- `dist/`

## GitHub Handoff

At handoff time, `gh` was installed but not authenticated:

```text
You are not logged into any GitHub hosts.
```

There was no Git remote configured. To push this project later:

```bash
gh auth login
gh repo create local-pomodoro --private --source . --remote origin --push
```

If the repository already exists, add the remote and push:

```bash
git remote add origin <repo-url>
git push -u origin master
```
