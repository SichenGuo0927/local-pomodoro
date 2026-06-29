# Changelog

本文件记录本地番茄钟的重要版本变更。

## [0.2.6] - 2026-06-29

### Changed

- 将主窗口的设置入口从内联下滑面板改为独立弹窗，打开设置时不再改变计时器主界面布局。
- 设置弹窗支持点击关闭按钮或遮罩关闭；关闭未保存内容时会恢复为当前已保存设置。
- 保存设置后弹窗会自动关闭。
- 长休自然倒计时结束后，应用停在下一轮专注的待开始状态，并主动把主窗口带到前台。
- 主分支从 `master` 改名为 `main`。

### Verified

- `node --check src/main.js`
- `node --check src/renderer/app.js`
- `node --check src/notice/app.js`
- Electron/CDP 设置弹窗烟测
- 长休结束主窗口唤起路径验证
- `hdiutil imageinfo dist/本地番茄钟-0.2.6.dmg`

## [0.2.5] - 2026-06-29

### Added

- Electron 主进程计时，主窗口隐藏或关闭到后台后仍继续计时。
- Menu Bar 常驻入口和当前循环进度展示。
- 自定义专注、短休、长休时长以及长休循环次数。
- 短休和长休独立提醒窗口。
- 休息和专注阶段的系统声音提醒。
- macOS DMG 打包配置。
