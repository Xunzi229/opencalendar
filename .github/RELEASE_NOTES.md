## OpenCalendar v0.2.5

本次正式版新增 Windows、macOS、Linux 开机自动启动设置，优化日历弹窗动画、任务栏间距和日期图标，并包含自 v0.2.4 以来的界面改进。

## 更新内容

- **开机自动启动**：在托盘菜单的“设置”中开启后，应用会在下次登录系统时自动运行并驻留托盘；关闭开关会移除启动项。默认关闭，开关操作立即生效，无需点击 TianAPI Key 的保存按钮。
- **自动检测启动状态**：打开或返回设置页时重新读取系统启动项，修改后再次确认；支持检测 Windows 任务管理器中的禁用状态。读取或写入失败时提供提示及重新检测入口。
- **三大桌面系统适配**：Windows 使用当前用户启动项，macOS 使用 LaunchAgent，Linux 使用 XDG 自启动项并遵循 `XDG_CONFIG_HOME`；AppImage 保留原始文件路径，启动路径支持空格和特殊字符。
- **弹窗轻柔滑入**：每次打开日历时播放约 200 毫秒的轻微位移与淡入动画，支持反复打开和快速切换；系统开启“减少动态效果”时直接显示。Windows / Linux 从下向上进入，macOS 从菜单栏方向进入。
- **更贴近任务栏**：Windows 日历弹窗与任务栏之间的间距由 12 缩至 **1 个逻辑像素**，随系统 DPI 缩放；内容高度变化时保持底部间距。
- **多屏定位改进**：Windows 优先在托盘所在显示器弹出，并以物理坐标设置窗口位置，改善不同缩放比例下的定位。
- **日期图标更清晰**：重新生成 1–31 日的 64px 托盘图标，采用白底、窄红条和大号深色数字；日期随系统日期自动更新，标题栏保留原有日历图标风格。
- **日历界面更紧凑**：移除重复的年月标题、图例和顶部假期更新状态行；每次打开年份列表时，年份范围重新围绕当前年份展开。

## 下载选择

| 系统 | 架构 | 安装包 |
| --- | --- | --- |
| Windows | Intel / AMD x64 | `Calendar_0.2.5_Windows_x64-setup.exe` / `.msi`（安装版）；`Calendar_0.2.5_Windows_x64.exe`（免安装） |
| Windows | ARM64 | `Calendar_0.2.5_Windows_arm64-setup.exe`（安装版）；`Calendar_0.2.5_Windows_arm64.exe`（免安装） |
| macOS | Apple Silicon / ARM64 | `Calendar_0.2.5_macOS_aarch64.dmg` / `.app.tar.gz` |
| macOS | Intel / x64 | `Calendar_0.2.5_macOS_x64.dmg` / `.app.tar.gz` |
| Linux | x64 | `Calendar_0.2.5_Linux_amd64.deb` / `.AppImage`，`Calendar_0.2.5_Linux_x86_64.rpm` |
| Linux | ARM64 | `Calendar_0.2.5_Linux_arm64.deb`，`Calendar_0.2.5_Linux_aarch64.rpm` / `.AppImage` |

`SHA256SUMS.txt` 提供全部 15 个安装包及应用归档的 SHA-256 校验值。

## 使用与升级

- 应用启动后驻留系统托盘，点击图标或通过托盘菜单显示日历；“设置”同时提供自启动开关和 TianAPI Key 配置。
- 更新应用后，打开“设置”可重新检测自启动状态。Windows 免安装 EXE 和 Linux AppImage 应放在固定位置；移动文件后重新开启自动启动，以更新启动路径。
- Windows 免安装 EXE 下载后直接运行，系统需已有 Microsoft Edge WebView2 Runtime；配置和缓存仍保存在系统应用数据目录，不随 EXE 移动。
- 农历无需联网；黄历宜忌需配置自己的 TianAPI Key，未配置或 Key 失效时自动隐藏黄历面板。
- 内置 2026 年放假安排，联网更新来自 `lanceliao/china-holiday-calender` 的第三方整理数据，并附政府通知链接。缓存与检查频率按当前应用、本机自然日保存。
- 安装包尚未配置 Apple 公证或 Windows 代码签名，首次运行可能出现系统安全提示。
- Linux 需要支持 AppIndicator 的桌面环境；x64 包基于 Ubuntu 22.04，ARM64 包基于 Ubuntu 24.04 构建，旧发行版可能不兼容。

## 验证与完整变更

发布工作流执行前端测试、TypeScript 类型检查与构建，并在 Windows x64、macOS Apple Silicon 和 Linux x64 运行原生日历及自启动辅助逻辑测试；六个平台安装包全部构建成功后公开 Release。

[查看 v0.2.4 至 v0.2.5 的完整代码变更](https://github.com/Xunzi229/opencalendar/compare/v0.2.4...v0.2.5)
