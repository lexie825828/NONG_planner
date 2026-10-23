# Nong Planner Android 0.6.0

## 0.6.0 目标折叠与今日总览

20261023 更新。正式安装包从 [GitHub Releases](https://github.com/lexie825828/NONG_planner/releases/tag/v0.6.0) 下载；本地输出为 `output/android/Nong-Planner-0.6.0.apk`，versionCode 10，沿用原签名，可覆盖安装。

中长期项目与任务作为主要入口，短期行动折叠在它们下面。从具体目标拆出行动时自动关联上级，也可在编辑或 AI 确认卡中选择同项目下的上级中长期任务。原有仅关联项目的短期行动折叠在项目下，未关联行动保留独立折叠区，不删除或移动周计划中的记录。

每日计划默认出现在今日总览的第一张卡片。短按右上角六点手柄约 240ms 再拖动排序，也可点“调整布局”上下移动或恢复默认。排序作为计划本设置参与备份和同步，重开保留。

点击日期章或顶部日期打开应用内月历，查看日程与 DDL，切月并跳到某一天。每日金句按北京时间日期从本地句库轮换，无模型请求。

新增鹅黄和清新绿，支持分层混搭及原生保存；修正进度条显示比例。通过真实模拟器触摸、跨日、退出重开和正式包升级核对。见 [0.6.0 测试报告](../docs/TESTING.md)。

## 0.5.1 明确计划类型，项目行动进入周计划

正式安装包 `output/android/Nong-Planner-0.5.1.apk`，versionCode 9，沿用原签名，可覆盖安装。

项目和任务都可明确确认短期、中期或长期。项目归属与是否填写具体时间不会决定计划类型。比如红酒学习 31 号截止，确认为中期项目；学习一课时则是关联它的短期行动，在某天或本周待办中执行。中长期任务使用 DDL，拆解后的小行动使用日程日期或所属周。

项目页提供旧记录类型确认清单。0.5.0 曾将无时间项目任务的日期改为 DDL；现在停止该推断，保留原始日期追溯，确认短期行动时可恢复。没有依据的旧记录不自动归类。

AI 草稿需确认计划类型再写入。通过 Android 16 / API 36 虚拟手机专项测试，正式安装包覆盖升级后全部记录保持一致，详情见 [0.5.1 测试报告](../docs/TESTING.md)。

## 0.5.0 计划流程升级

正式安装包 `output/android/Nong-Planner-0.5.0.apk`，versionCode 8，沿用原签名，建议先导出备份再覆盖安装，不卸载旧版。

今日习惯只显示每日习惯与提前三天进入临期（含逾期）的循环事项。周计划首次进入定位今天，可切换全览 / 正常 / 放大；点击编辑，短按约 250 毫秒后上划完成，轻震与勾选动画将灰色条目放到当天末尾，再点撤销。未短按的普通滑动不会完成事项。

日程日期独立于 DDL。0.5.0 曾按项目关联转换旧日期，该推断已在 0.5.1 停止，改为明确确认类型。旧周待办保留 ID 并合并为本周无日期任务。次日首次打开的待安排池可逐条或批量顺延、改日、放回本周或取消，保留进度和安排历史。取消记录可在项目页查看并恢复。

设置中可调整主动复盘：默认每天 09:00、周日 20:30，7 天无进展的项目 / 中长期任务、3 天未打卡的每日习惯纳入关注。支持 22:00–08:00 免打扰、暂停和稍后一天。需要允许系统通知；后台使用本地规则，不调用 AI，点击通知进入复盘清单后可主动发送消息与模型梳理。

后台使用非精确闹钟与系统任务，受 Android / ColorOS 省电策略影响可能延迟；强制停止应用后需重新打开。测试通过实际终止缓存进程后运行系统 JobService 验证通知投递，并核对免打扰、暂停和稍后提醒，后台模型请求为 0。完整 [0.5.0 测试报告](../docs/TESTING.md)。

## 0.4.1 计划卡片与体验修复

正式包 `output/android/Nong-Planner-0.4.1.apk`，versionCode 7，同一签名可覆盖安装，不要卸载旧版。

- 模型明确说有草稿却未返回卡片时，最多自动补全一次；普通文字回复下有“生成计划卡片”，升级前的旧回复也可整理。生成后先检查和确认，才写入计划本。补全和手动整理会调用当前配置的模型。
- 周计划打卡和撤销打卡保留横向与纵向滚动位置。
- 设置页按钮缩小为紧凑样式，日历与提醒采用短按钮，较长说明可展开查看。
- 红蓝粉三套配色统一对比度，支持一键预设与分层调整；主题由 Android 原生持久化保存。

已通过 Android 16 模拟器、21 项回归、聊天 UI、电脑和移动尺寸测试；正式安装包覆盖升级前后全部记录深度比较一致。详细场景与截图见 [0.4.1 测试报告](../docs/TESTING.md)。实际 OPPO 手机和用户模型账户仍需安装后验证。

## 0.4.0 周待办、循环习惯、日历与主题

同一签名，versionCode 6，可直接覆盖安装。周计划新增不指定日期的本周待办，点击切换完成；习惯可填写循环周期，例如“更换床单 / 2 / 个月”，以最近一次打卡重新计时，无打卡时采用起算日期。项目任务显示具体截止日期。

设置 → 手机日历联动，开启自动日历并授予读写权限；带具体时间的任务会写入系统本地“Nong Planner”日历，修改更新原日程，清空时间或删除任务会移除日程，未完成任务提前 15 分钟提醒。关闭功能会移除本应用日历。请在手机日历中勾选显示该日历；不改动用户其他日历，也不会自动上传 OPPO / Google 云日历。

循环通知需单独开启并授权。系统约每 6 小时检查一次，应用打开或记录改变时也会检查。受系统省电策略影响可能延迟，不用于精确计时提醒。习惯页和首页一直显示到期状态。

设置可分别切换纸张、卡片、按钮的囍悦红 / 顺遂蓝 / 温柔粉主题，保存于本机，含颜色过渡和页面动效。

API 请求带 `User-Agent: NongPlanner/0.4.0` 和每个聊天窗口稳定的 `x-opencode-session`。仍使用 Chat Completions 协议；服务商用途与账户模型权限以其规则为准。测试使用本地模拟模型，没有调用用户付费额度。

已通过 Android 16 / API 36 模拟器实测、17 项回归测试以及正式包覆盖升级全数据比较，见 [0.4.0 测试报告](../docs/TESTING.md)。测试 WebView 为 AOSP 133，OPPO ColorOS / Google WebView 155 仍需真机复测。

## 0.3.2 Android 16 WebView 启动修复

OPPO PKT110 / Android 16 / WebView 155 的真机诊断显示，0.3.1 的内存首页 `data:text/html;charset=utf-8;base64,` 被应用资源拦截器返回了 HTTP 404。新版不再使用 `loadDataWithBaseURL` 启动，而是直接加载 APK 内的 `https://appassets.androidplatform.net/index.html`；资源路径已在 0.3.1 修正。

同时区分浏览器内部资源与 APK 资源：`data:` / `blob:` / `about:` 返回 null 交给 WebView 处理，不再合成 404；APK 的 HTTPS origin 才读取安装包资源，其他网络与文件 origin 仍被阻止。已为该路由添加生产代码级 Java 回归测试，并验证 APK 资源与原签名一致。versionCode 为 5，可以覆盖安装保留同源本地数据，尚未在用户真机复测。

## 0.3.1 首页修复

旧版 0.3.0 的 Windows 构建工具把 APK 内资源写成 `assets/www\index.html`，Android AssetManager 因而找不到 `www/index.html`，出现 `ERR_HTTP_RESPONSE_CODE_FAILURE`。已改为显式使用 ZIP 标准正斜杠路径，并在每次构建后用 Java ZipFile 检查真实路径及所有首页依赖，避免 Windows Python 自动转换路径掩盖问题。

0.3.1 曾改为从安装包直接读取后使用 `loadDataWithBaseURL` 显示（现已在 0.3.2 替换），保留原 HTTPS origin 和本地存储。增加两种 WebView 资源回调、启动完成信号和原生诊断提示。包名及签名证书不变，versionCode 从 3 升为 4；请直接覆盖安装，不必卸载或清除数据。已用同一测试复现旧包路径错误，并验证新包资源、签名和启动桥接通过；尚未在用户的 OPPO Find X8s 真机复测。

## 安装包

`output/android/Nong-Planner-0.6.0.apk` 是已签名的独立 Android 安装包，最低 Android 8.0（API 26），目标 Android 15（API 35），不依赖特定 CPU 架构。需要保持 Android System WebView / Chrome 更新，以支持现代 JavaScript 功能。签名为项目个人证书，供直接安装使用，尚未提交应用商店。

把 APK 传到手机，在文件管理器中点击安装；按系统提示允许该文件管理器“安装未知应用”。无需开启开发者模式。安装后桌面名称为 **Nong Planner**。

## 手机上独立使用

- 所有界面打包在 APK 里，打开时无需连接电脑。计划、日记、聊天和图片保存于应用私有目录与 WebView IndexedDB。
- 设置中直接填写兼容 Chat Completions 的模型 Base URL、模型名和 API Key，手机直接调用模型；不需要运行 Node.js。图片理解仍要求所选模型支持图片输入。
- 模型密钥和同步密钥由 Android Keystore 的 AES-GCM 密钥加密后保存，不放进聊天备份。
- 图片选择使用系统文件选择器；JSON、ICS 导出使用系统“另存为”。仅申请联网权限，不申请整个相册、联系人或文件管理权限。
- AI 建议仍需点击确认后才写入对应计划本。支持多个会话、姓名自定义、日记生成、记忆管理和上下文压缩。
- 本地模式可以导出 ICS，但手机本地应用不能提供可被外部日历订阅的公网地址。需要订阅时连接电脑/服务器，或者手动将 ICS 导入手机日历。
- 卸载或清除应用数据会删除本地记录。先导出备份，或先完成电脑同步。个人数据未启用 Android 云端自动备份。

## 与电脑同步

1. 在电脑停止原来的本机服务窗口，再运行项目根目录的 `start-lan.cmd`，或用 PowerShell 设置 `$env:HOST='0.0.0.0'` 后执行 `npm start`。电脑与手机连接同一局域网，需要放行电脑防火墙 TCP 4173。未自动更改防火墙。
2. 电脑浏览器打开 Nong Planner，在设置中查看配对密钥。
3. 手机应用 → 设置与同步 → **连接电脑 / 切回本地**，填写电脑实际局域网地址，例如 `http://192.168.1.5:4173`，并填写电脑配对密钥。手机不能把 `localhost` 当作电脑地址。
4. 切换后明确选择采用服务器记录，或用手机记录替换服务器。系统会在替换前导出原版本备份，不会直接自动覆盖。
5. 远程连接模式使用电脑的模型设置，修改模型设置也会修改电脑服务配置。电脑服务需要保持运行；网络不可用时仍可查看、编辑已缓存的记录，重新连上后同步。

公网服务使用 HTTPS。普通 HTTP 仅允许本机和私有局域网 IP。配对密钥具有个人空间读写权限；日历订阅地址含只读访问密钥。

切回手机独立空间时将服务地址留空，再选择保留哪份数据。应用不会自动把两套记录合并。

## 构建与签名

构建入口 `android/build.ps1`，没有 npm 构建依赖或 Gradle 下载步骤。需要 JDK 17+、Google Android Build Tools 35.0.0、SDK Platform 35。工具位于项目 `.android-tools` 下，可传入 `-JdkPath`、`-SdkTools`、`-SdkPlatform` 使用其他安装位置。

```powershell
./android/build.ps1
```

工具来源（Google 官方）与索引中的 SHA-1 校验值：

- `https://dl.google.com/android/repository/build-tools_r35_windows.zip`：`af059bb67cf7786f45ee0db85e2d24985df1b4b6`
- `https://dl.google.com/android/repository/platform-35_r02.zip`：`0bb560a90a7a2cbd0dd8348224d518b638fe7949`

脚本复制 `public/` 为 APK 静态资源，编译 Java → DEX → APK，执行 zipalign 与 apksigner 签名校验，最后输出 SHA-256 文件。**data 目录、PDF、API 配置和签名密钥均不打包到 APK**。

`android/keys/` 保存个人签名证书及构建密码，已从 Git 排除。请自行安全备份该目录，勿随 APK 分发；以后覆盖升级同一应用需要保留同一签名。换证书会导致系统拒绝覆盖安装。

## 验证范围

已通过 Java/DEX 编译、APK v2/v3 签名及 ZIP 对齐校验；已通过原有自动化回归与 Android 适配桥接/界面测试，涵盖本地保存、AI 草稿确认、备份调用与同步空间保护。界面测试使用 Edge 与模拟 Android 系统桥接，不等同于真实 Android WebView 测试；本轮新增了下述实际模拟器验收。

已在本机 Android 16 / API 36 模拟器（WebView 133）实际安装测试：复现 0.3.1 的 data 页面 404，确认正式 0.3.2 正常启动；原生保存与重开、Keystore、实际 HTTP 模型调用、草稿确认、日记、系统图片选择、系统文件导出、离线重开、横屏和覆盖安装数据保留均通过。详见 [模拟器实测报告](../docs/TESTING.md)。用户 OPPO 手机的 ColorOS / WebView 155 尚未直接复测。应用没有后台 AI 推送与系统日历双向回写。

技术依据：[Android 本地 WebView 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[Android APK 签名](https://developer.android.com/tools/apksigner)。

## 使用自己安装的 Android SDK

需要 Windows、PowerShell 7、JDK 17+、Google SDK Platform 35 和 Build Tools 35。示例：

```powershell
pwsh -File android/build.ps1 -JdkPath 'C:/Java/jdk-21' -SdkTools 'C:/Android/Sdk/build-tools/35.0.0' -SdkPlatform 'C:/Android/Sdk/platforms/android-35'
```

首次构建会在本机 android/keys/ 生成自己的签名证书，请自行保存，不提交到 Git。自建证书不能覆盖项目正式发布证书签名的 APK。
