# 测试与验证

当前版本：0.4.1。2026-10-22 已通过 21 项核心回归、电脑 / 手机 / 平板浏览器布局与聊天交互测试。

实际 Android 测试在 Windows 本机 Android Emulator 37.2.12、Android 16 / API 36、AOSP WebView 133 上完成。覆盖原生存储、图片选择、文件导出、离线重开、系统日历、循环通知、AI 草稿确认、格式补全与旧回复恢复、周计划滚动保持和主题重启保留。正式 APK 覆盖安装后，导出记录与升级前完整数据逐项比较相同，未开启调试标记。OPPO ColorOS / Google WebView 155 环境未直接复测。

## 核心测试

需要 Node.js 22+：

```sh
npm test
```

核心测试使用临时数据和本地模拟模型，不消费真实 API 额度。API 测试使用 24173 / 24175 端口，请先确保未被占用。

## 浏览器 UI

测试脚本使用 Playwright 与 Edge，可在本机安装开发依赖：

```sh
npm install --no-save playwright
npm run test:ui
npm run test:chat-ui
```

默认使用 msedge；如果使用其他浏览器，请设置 `BROWSER_CHANNEL`，并安装对应浏览器。测试使用独立临时数据，不应指向自己的真实记录。

## Android 模拟器

使用 `android/download-emulator.ps1` 和 `android/prepare-emulator.ps1` 之前，请检查文件中的 Google 工具版本和下载信息，准备 platform-tools；也可以自行安装 Android Studio 官方模拟器。

模拟器脚本使用项目内 `.android-tools/sdk` 和 `.android-tools/avd`，默认设备为 Android 16 的 NongPlanner_API36。

```powershell
pwsh -File android/build.ps1 -EmulatorTest
pwsh -File android/start-emulator.ps1
```

安装生成的 emulator-test APK 后运行：

```sh
node tests/android-emulator-041.mjs
```

脚本只允许 emulator-* 设备，使用真实 Java 原生 API 与 Windows 本机模拟模型服务。历史验收脚本保留了对应版本 / 测试日期的假设，不保证在任意日期、已重复填充数据的模拟器上无改动通过。正式版 APK 不开启 WebView 调试；emulator-test 包只供本地测试，不作为公共安装包发布。
