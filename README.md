# 本地番茄钟

本地番茄钟是一个面向 macOS 的极简番茄钟应用。它使用 Electron 构建，计时状态由主进程维护，因此主窗口隐藏、关闭到后台或失焦后，计时仍会继续运行。

当前版本：`0.2.6`

## 特性

- 自定义专注、短休、长休时长。
- 自定义进入长休前的番茄循环次数。
- App 打开后默认暂停，必须由用户手动开始。
- Menu Bar 常驻入口：
  - 单击打开菜单，再单击关闭菜单。
  - 双击、双指按压或右键切换开始/暂停。
  - 菜单顶部显示当前循环进度。
- 自动进入下一段：
  - 专注结束后可自动进入短休或长休。
  - 短休结束后可自动进入下一段专注。
  - 长休结束后停在下一轮专注，等待用户手动开始。
- 系统声音提醒：
  - 进入休息播放 `Glass + Ping + Glass`。
  - 进入专注播放 `Hero + Ping`。
- 休息提醒窗口：
  - 短休开始时弹出独立提醒窗口，提醒远眺窗外。
  - 长休开始时弹出独立提醒窗口，提醒喝水和走动。
  - 长休自然结束后主窗口会弹出，方便用户决定是否开始下一轮。
- 主窗口设置通过右上角齿轮以独立弹窗打开，不挤压计时器主界面。

## 快速安装

推荐直接安装打包版。复制下面一行命令到终端执行即可：

```bash
curl -fsSL https://raw.githubusercontent.com/SichenGuo0927/local-pomodoro/main/install.sh | bash
```

这条命令会下载 GitHub Release 中的 DMG，挂载安装包，并把 `本地番茄钟.app` 安装到 `/Applications`。如果 `/Applications` 需要管理员权限，脚本会请求 `sudo`。

也可以手动下载打包版本：

[下载 v0.2.6 DMG](https://github.com/SichenGuo0927/local-pomodoro/releases/tag/v0.2.6)

安装包当前未签名，首次打开时 macOS 可能需要右键打开，或在系统设置中允许打开。

## 从源码运行

开发或本地调试需要：

- macOS
- Node.js `22.12+`
- pnpm `11+`

如果本机还没有 Node.js 和 pnpm，可以用 Homebrew 安装：

```bash
brew install node pnpm
```

从 GitHub 克隆并安装依赖：

```bash
git clone https://github.com/SichenGuo0927/local-pomodoro.git && cd local-pomodoro && pnpm install
```

启动开发版：

```bash
pnpm start
```

## 打包

生成 macOS DMG 安装包：

```bash
pnpm run package:mac
```

构建产物会输出到 `dist/`。该目录是本地生成物，不纳入 Git。

## 使用说明

1. 打开 App 后点击 `开始` 启动当前专注阶段。
2. 右上角齿轮打开设置弹窗，可调整专注、短休、长休和循环次数。
3. Menu Bar 图标可在主窗口隐藏时继续控制计时器。
4. 长休结束后 App 会停在下一轮专注，并把主窗口带到前台等待用户确认。

## 项目结构

```text
src/main.js              Electron 主进程、计时状态、Menu Bar、提醒和声音
src/preload.js           安全暴露给页面的 IPC API
src/renderer/            主窗口 UI
src/notice/              独立休息提醒窗口 UI
package.json             Electron 启动、打包脚本和构建配置
install.sh               一键下载安装脚本
pnpm-lock.yaml           pnpm 依赖锁文件
pnpm-workspace.yaml      pnpm workspace 配置
```

## 常用命令

```bash
curl -fsSL https://raw.githubusercontent.com/SichenGuo0927/local-pomodoro/main/install.sh | bash
pnpm install
pnpm start
pnpm run package:mac
```

## 版本记录

版本变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 开发备注

- GitHub 默认分支是 `main`。
- `dist/`、`node_modules/`、`.pnpm-store/` 和 `.DS_Store` 不纳入 Git。
- 如果继续接手开发，请先阅读 [HANDOFF.md](./HANDOFF.md)。

## License

`UNLICENSED`。当前仓库未声明开源许可证，公开分发前建议补充正式 `LICENSE` 文件。
