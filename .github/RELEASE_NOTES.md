## 更新内容

- 全新 macOS 风格日历图标，同步应用内标识与各平台安装包。
- 假期倒计时始终以今天为基准，浏览其他日期或年份不再改变倒计时。
- 中国大陆节假日数据每天最多联网检查一次，保存本地缓存，断网或更新失败时继续查看已有数据。
- 标注第三方整理来源、政府通知地址与更新时间；未收录年份明确提示，不推测调休安排。
- 日期详情区分放假和调休补班，历史年度假期支持快速跳转。
- 新增缓存、限频、异常数据和跨年回归测试，共 15 项测试通过。

## 下载选择

| 系统 | 架构 | 安装包 |
| --- | --- | --- |
| macOS | Apple Silicon / ARM64 | `Calendar_0.2.0_macOS_aarch64.dmg` / `.app.tar.gz` |
| macOS | Intel / x64 | `Calendar_0.2.0_macOS_x64.dmg` / `.app.tar.gz` |
| Windows | Intel / AMD x64 | `Calendar_0.2.0_Windows_x64-setup.exe` / `.msi`（安装版）；`Calendar_0.2.0_Windows_x64.exe`（免安装） |
| Windows | ARM64 | `Calendar_0.2.0_Windows_arm64-setup.exe`（安装版）；`Calendar_0.2.0_Windows_arm64.exe`（免安装） |
| Linux | x64 | `Calendar_0.2.0_Linux_amd64.deb` / `.AppImage`，`Calendar_0.2.0_Linux_x86_64.rpm` |
| Linux | ARM64 | `Calendar_0.2.0_Linux_arm64.deb`，`Calendar_0.2.0_Linux_aarch64.rpm` / `.AppImage` |

`SHA256SUMS.txt` 提供所有安装包的 SHA-256 校验值。

## 使用说明

- 应用启动后驻留系统托盘，通过托盘图标或菜单显示日历。
- 农历无需联网；黄历宜忌需要在托盘设置中配置自己的 TianAPI Key。
- 内置 2026 年放假安排；联网更新来自 lanceliao/china-holiday-calender 的第三方整理数据，附政府通知链接。缓存和检查频率按当前应用、本机自然日保存。
- 当前安装包未配置 Apple 公证或 Windows 代码签名，首次运行可能出现系统安全提示。
- Linux 需要支持 AppIndicator 的桌面环境。x64 包基于 Ubuntu 22.04，ARM64 包基于 Ubuntu 24.04 构建，旧发行版可能不兼容。

Windows 免安装 EXE 下载后直接运行，无需安装本应用，但系统需已有 Microsoft Edge WebView2 Runtime。配置和缓存仍保存在系统应用数据目录，不是随 EXE 移动的数据便携模式。
