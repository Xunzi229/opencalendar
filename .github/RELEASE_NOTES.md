## 更新内容

- macOS 风格日历界面，统一工具栏、日期选中态和设置页。
- 使用真实农历，修复跨年日期和假期倒计时。
- 优化黄历异步请求、时钟刷新、窗口尺寸监听和开发热更新。
- 增加键盘焦点、窄窗口适配及日期回归测试。

## 下载选择

| 系统 | 架构 | 安装包 |
| --- | --- | --- |
| macOS | Apple Silicon / ARM64 | 文件名含 `aarch64` 的 `.dmg` 或 `.app.tar.gz` |
| macOS | Intel / x64 | 文件名含 `x64` 的 `.dmg`，或 `x86_64` 的 `.app.tar.gz` |
| Windows | Intel / AMD x64 | 文件名含 `x64` 的 `.exe` 或 `.msi` |
| Windows | ARM64 | 文件名含 `arm64` 的 `.exe` |
| Linux | x64 | `amd64` / `x86_64` 的 `.deb`、`.rpm` 或 `.AppImage` |
| Linux | ARM64 | `arm64` / `aarch64` 的 `.deb`、`.rpm` 或 `.AppImage` |

`SHA256SUMS.txt` 提供所有安装包的 SHA-256 校验值。

## 使用说明

- 应用启动后驻留系统托盘，通过托盘图标或菜单显示日历。
- 农历无需联网；黄历宜忌需要在托盘设置中配置自己的 TianAPI Key。
- 内置法定放假及补班数据目前仅覆盖 2026 年。
- 当前安装包未配置 Apple 公证或 Windows 代码签名，首次运行可能出现系统安全提示。
- Linux 需要支持 AppIndicator 的桌面环境。x64 包基于 Ubuntu 22.04，ARM64 包基于 Ubuntu 24.04 构建，旧发行版可能不兼容。
