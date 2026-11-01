## OpenCalendar v0.2.5-beta.1

这是基于 v0.2.4 的预发布版本，主要优化 Windows 日历弹窗间距和托盘日期可读性，并包含日历头部精简与年份选择改进。

## 更新内容

- **弹窗更贴近任务栏**：Windows 日历弹窗底部间距从 12 缩至 4 个逻辑像素，随系统 DPI 缩放；内容高度变化时仍保持底部间距。
- **多屏定位改进**：Windows 优先在托盘所在显示器弹出，并以物理坐标设置窗口位置，减少不同缩放比例下的定位偏差。
- **日期图标更清晰**：托盘日期采用白底、窄红条和大号深色数字，去除小尺寸下难以辨认的装饰，重新生成 1–31 日的 64px 图标；日期仍随系统日期自动更新，标题栏保留原有日历图标风格。
- **日历界面更紧凑**：移除重复的年月标题、图例和顶部假期更新状态行。
- **年份选择更方便**：每次打开年份下拉列表时，年份范围重新围绕当前年份展开。

## 预发布试用重点

- 检查 Windows 100%、150%、200% 缩放下，日历与任务栏的间距和托盘数字清晰度。
- 多显示器使用不同缩放比例时，检查弹窗所在屏幕与位置；展开或收起详情后检查底部间距。
- 检查跨午夜后的日期图标自动更新，以及单数字、双数字日期的可读性。

本版本标记为 Pre-release，供提前试用；稳定版本仍为 v0.2.4。

## 下载选择

| 系统 | 架构 | 安装包 |
| --- | --- | --- |
| macOS | Apple Silicon / ARM64 | `Calendar_0.2.5-beta.1_macOS_aarch64.dmg` / `.app.tar.gz` |
| macOS | Intel / x64 | `Calendar_0.2.5-beta.1_macOS_x64.dmg` / `.app.tar.gz` |
| Windows | Intel / AMD x64 | `Calendar_0.2.5-beta.1_Windows_x64-setup.exe` / `.msi`（安装版）；`Calendar_0.2.5-beta.1_Windows_x64.exe`（免安装） |
| Windows | ARM64 | `Calendar_0.2.5-beta.1_Windows_arm64-setup.exe`（安装版）；`Calendar_0.2.5-beta.1_Windows_arm64.exe`（免安装） |
| Linux | x64 | `Calendar_0.2.5-beta.1_Linux_amd64.deb` / `.AppImage`，`Calendar_0.2.5-beta.1_Linux_x86_64.rpm` |
| Linux | ARM64 | `Calendar_0.2.5-beta.1_Linux_arm64.deb`，`Calendar_0.2.5-beta.1_Linux_aarch64.rpm` / `.AppImage` |

`SHA256SUMS.txt` 提供所有安装包的 SHA-256 校验值。

## 使用说明

- 应用启动后驻留系统托盘，通过托盘图标或菜单显示日历。
- 农历无需联网；黄历宜忌需要在托盘设置中配置自己的 TianAPI Key。
- 内置 2026 年放假安排；联网更新来自 lanceliao/china-holiday-calender 的第三方整理数据，附政府通知链接。缓存和检查频率按当前应用、本机自然日保存。
- 当前安装包未配置 Apple 公证或 Windows 代码签名，首次运行可能出现系统安全提示。
- Linux 需要支持 AppIndicator 的桌面环境。x64 包基于 Ubuntu 22.04，ARM64 包基于 Ubuntu 24.04 构建，旧发行版可能不兼容。

Windows 免安装 EXE 下载后直接运行，无需安装本应用，但系统需已有 Microsoft Edge WebView2 Runtime。配置和缓存仍保存在系统应用数据目录，不是随 EXE 移动的数据便携模式。

## 完整变更

[查看 v0.2.4 至 v0.2.5-beta.1 的代码变更](https://github.com/Xunzi229/opencalendar/compare/v0.2.4...v0.2.5-beta.1)
