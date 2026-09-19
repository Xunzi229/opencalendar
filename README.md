# Calendar

一个基于 `Tauri 2 + React + TypeScript` 的中文桌面日历应用。

![](html/QQ20260422-230931.png)

## 当前能力

- 中文月历视图，按周一到周日展示
- 年份、月份、节假日快速切换
- 点击日期自动更新选中态和黄历面板
- 节假日显示“休”，补班日显示“班”
- 内置 TianAPI Key 设置面板
- 本地 SQLite 缓存黄历数据
- Tauri 系统托盘控制主窗口显示与隐藏

## 技术栈

- Tauri 2
- React 19
- TypeScript
- Vite
- Rust
- SQLite

## 开发

安装 Node.js 依赖：

```bash
npm install
```

只运行前端：

```bash
npm run dev
```

运行 Tauri 桌面端：

```bash
npm run tauri:dev
```

## 界面与验证

- macOS 风格浅灰工具栏、系统字体、细分隔线与蓝色选中态，支持窄窗口。
- 农历由系统 `Intl` 中国历计算，无需配置 API Key；黄历宜忌仍需 TianAPI。
- 内置放假及补班安排目前仅覆盖 2026 年，其他年份不推测法定假期。
- 日期计算集中在 `src/renderer/src/calendar.ts`，设置页位于 `SettingsApp.tsx`。
- 浏览器预览仅验证前端；托盘、自动窗口尺寸和黄历服务需在 Tauri 中联调。

```bash
npm test
npm run typecheck
```

## 构建

前端构建：

```bash
npm run build
```

桌面应用构建：

```bash
npm run tauri:build
```

## 目录

```text
opencalendar/
├─ src/
│  ├─ renderer/
│  │  └─ src/
│  │     ├─ api/
│  │     ├─ global.d.ts
│  │     ├─ main.tsx
│  │     └─ styles.css
│  └─ shared/
├─ src-tauri/
│  ├─ capabilities/
│  ├─ src/
│  ├─ Cargo.toml
│  └─ tauri.conf.json
└─ TAURI_MIGRATION_PLAN.md
```

## 说明

- 浏览器模式下仍可通过 `npm run dev` 开发界面，桌面 API 会自动回退到浏览器实现。
- 由于当前机器未安装 Rust 工具链，Tauri 桌面端尚未在本机完成编译验证；安装 Rust 后即可继续联调。

## 自动发布

GitHub Actions 在推送 `v*` 标签时构建 macOS、Windows、Linux 的 x64 / ARM64 安装包；也可以在 Actions → Release 中填写已有标签手动重试。

1. 同步更新 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock` 的应用版本。
2. 更新 `.github/RELEASE_NOTES.md`，提交并推送代码。
3. 创建并推送标签，例如 `git tag v0.1.0` 和 `git push origin v0.1.0`。

工作流先执行前端测试和构建，再创建草稿 Release。六组平台构建全部成功后才公开 Release，并上传 `SHA256SUMS.txt`。失败时草稿保留，可重跑失败的任务；已公开版本不能覆盖发布，应创建新版本。

Windows ARM64 提供 NSIS 安装程序，Windows x64 另提供 MSI；macOS 提供 DMG 和应用压缩包；Linux 提供 DEB、RPM 和 AppImage。当前未配置平台签名证书或 Apple 公证凭据。

发布文件统一包含版本、系统和架构。Windows 另提供不带 `-setup` 后缀的免安装 EXE（需要系统 WebView2 Runtime）。已有版本可通过 Actions → Windows standalone EXE 补建 x64 / ARM64 可执行文件并更新校验文件。
