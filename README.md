# 本地番茄钟

本地番茄钟是一个面向 macOS 的极简番茄钟应用。它使用 Electron 构建，计时状态由主进程维护，因此主窗口隐藏、关闭到后台或失焦后，计时仍会继续运行。

当前源码版本与最新安装包：`0.3.2`

## 特性

- 自定义专注、短休、长休时长。
- 自定义进入长休前的番茄循环次数。
- App 打开后默认暂停，必须由用户手动开始。
- Menu Bar 常驻入口：
  - 单击打开菜单，再单击关闭菜单。
  - 双击、双指按压或右键切换开始/暂停。
  - 菜单顶部显示当前循环进度。
- 浮动番茄默认显示在桌面左下角，暂停或停止并重置后仍会保留；在中央时间面板上双指单击可暂停、双指快速双击可跳过、双指长按可停止并重置当前阶段。
- 手动暂停后若连续 1 分钟没有键鼠输入，重新使用电脑时会播放三声独立的短促提示音并闪烁浮动番茄；未使用浮动模式时则会弹出 App 主窗口。若返回后持续操作约 15 秒仍未继续，浮动番茄会摇摆移动到屏幕中央。
- 自动进入下一段：
  - 专注结束后可自动进入短休或长休。
  - 短休结束后可自动进入下一段专注。
  - 长休结束后停在下一轮专注，等待用户手动开始。
- 系统声音提醒：
  - 进入休息播放 `Glass + Ping + Glass`。
  - 进入专注播放 `Hero + Ping`。
- 休息提醒窗口：
  - 短休开始时弹出独立提醒窗口，提醒远眺窗外。
  - 长休开始时弹出独立提醒窗口，提醒喝水和走动；长休期间可直接关闭该窗口。
  - 长休自然结束后主窗口会弹出，方便用户决定是否开始下一轮；“回到专注”独立提示窗也可直接关闭，且不会自动开始下一轮。
- 主窗口设置通过右上角齿轮以独立弹窗打开，不挤压计时器主界面。
- 可选择开机自动启动；若已选择浮动窗口模式，登录启动时只显示浮动番茄，不弹出 App 主窗口。
- 今日统计会记录当天自然完成的专注次数和专注分钟数。
- 专注中熄屏、盒盖或锁屏会自动暂停，返回后自动继续。
- 短休结束后会持续提醒，直到用户回到桌面确认后再开始下一轮专注；长休结束只响铃一次，并停在下一轮专注等待确认。
- 休息模式支持“轻松模式”和“强制模式”；强制模式会限制休息期间的其他操作，并保留设置入口用于切回轻松模式。

## 下载与安装

当前安装包适用于 Apple Silicon Mac（M 系列芯片）。

1. [直接下载本地番茄钟 v0.3.2 DMG](https://github.com/SichenGuo0927/local-pomodoro/releases/download/v0.3.2/%E6%9C%AC%E5%9C%B0%E7%95%AA%E8%8C%84%E9%92%9F-0.3.2.dmg)。
2. 双击下载的 `本地番茄钟-0.3.2.dmg`。
3. 将“本地番茄钟”拖到安装窗口中的 `Applications` 文件夹。
4. 从“应用程序”文件夹打开“本地番茄钟”。

### 首次打开

当前试用版尚未使用 Apple Developer ID 签名和公证，因此全新的 Mac 会在第一次打开时显示安全提示。请先尝试打开一次，然后进入：

`系统设置 → 隐私与安全性 → 安全性 → 仍要打开 → 打开`

只需要操作一次；之后可以像普通 App 一样双击使用。请只从本仓库的 GitHub Release 下载，并可参考 [Apple 官方的未公证 App 打开说明](https://support.apple.com/102445)。

熟悉终端的用户也可以使用一行安装命令：

```bash
curl -fsSL https://raw.githubusercontent.com/SichenGuo0927/local-pomodoro/main/install.sh | bash
```

这条命令会下载 GitHub Release 中的 DMG，挂载安装包，并把 `本地番茄钟.app` 安装到 `/Applications`。如果 `/Applications` 需要管理员权限，脚本会请求 `sudo`。

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
