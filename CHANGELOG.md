# Changelog

本文件记录 LUMEN ATLAS 的主要功能、修复和兼容性变化。

## 2026-10-19 — 自定义轨迹

### Added

- 新增顶层 `tracks` 数据集合；旧数据库启动时自动补为空数组。
- 新增受登录保护的轨迹 API：
  - `GET /api/tracks`
  - `POST /api/tracks`
  - `PATCH /api/tracks/:id`
  - `DELETE /api/tracks/:id`
- 轨迹只保存地点锚点：名称、经纬度、时间。弧线在渲染时计算，不写入数据库。
- 新增手写大圆算法：
  - 单位向量球面插值
  - 重合点与对跖点退化处理
  - 跨 180° 经线展开
  - Haversine 总里程
- 新增 `TrackPreview` 编辑器地图，实时显示轨迹弧线和地点圆点。
- 主地图新增轨迹图层：
  - `track-line-glow`
  - `track-line`
- 新增轨迹页面：
  - 列表、创建、重命名、删除二次确认
  - 地点搜索与手动经纬度兜底
  - 日期时间编辑、拖拽排序、实时预览
  - 总里程、天数、颜色和标题
  - 未保存离开提示
- 导航新增「轨迹」入口，桌面端和移动端共用同一套 tabs。
- Android 原生客户端新增第 5 个「轨迹」tab，通过 `?embed=tracks` 加载轨迹页。
- 轨迹 WebView 模式隐藏站点 Header 和移动导航，适配原生底部栏。
- Android 原生 APK 更新至 `versionCode 7 / versionName 1.5.0`。
- 管理员删除用户时同步清理该用户的轨迹。

### Changed

- `publicDb()` 增加当前用户的 `tracks` 字段，bootstrap 可直接读取。
- 主地图轨迹只负责展示，不参与编辑器状态。

### Compatibility

- `photos`、`people`、`invites` 既有逻辑和响应字段不变。
- 没有 `tracks` 字段的旧 `db.json` 可以正常加载。
- 不新增依赖。

## 2026-10-19 — 照片自动轨迹

### Added

- 上传照片后按拍摄时间自动生成 `auto: true` 轨迹。
- 相邻照片时间间隔超过 24 小时时拆分新轨迹。
- 自动轨迹使用照片地点和拍摄时间作为锚点，每组至少 2 个地点。
- 单组超过 50 个地点时均匀采样到 50 个。
- 轨迹列表显示 `AUTO` 标记；编辑自动轨迹后转为手动轨迹，但继续吸收同时间段的新照片。
- 已编辑轨迹按时间区间认领照片分组，不再生成重叠的自动轨迹。
- 手动新建轨迹通过 `syncPhotos: false` 认领区间但不吸收照片。
- 删除的点通过 `excludedPhotoIds` 永久排除，后续重算不会加回。
- 自动 stop 带 `photoId`；轨迹上限提升到 100 个点，采样时优先保留手动点。
- 照片删除、时间/坐标修改、示例数据变化后自动重算照片轨迹。

### Compatibility

- 自动轨迹与手动轨迹共用 `tracks` 数据和渲染层。
- 手动轨迹不会被自动重算删除。
- 真实照片数据不增加新字段。

## 2026-10-19 — 上传、时间与元数据修复

### Added

- 上传临时文件目录 `data/tmp/`。
- 上传 metadata 数量校验。
- 四字段时间约定：`capturedAt`、`capturedLocal`、`tzOffset`、`dateSource`。
- README「上传接口的时间字段」与「定期备份」。
- `scripts/backup.sh`，支持保留份数、完整性校验和安全权限。

### Fixed

- 无 EXIF 的文件时间按浏览器本地墙上时间保存，不再被 UTC 服务器时区覆盖。
- 历史 `file` 照片在浏览器时区下正确重新展示。
- 多文件 metadata 数量不足返回 400，并清理临时文件。
- 单文件不带 metadata 的兼容路径不再伪造当前时间。
- 竖拍照片尺寸使用旋转后的输出宽高。
- 邀请码改为 32 字符集、10 位随机码，并消除取模偏差。
- 上传改为磁盘落盘、并发上限 2、单张失败返回 `failures`。

## 2026-10-19 — 安全与请求边界

### Fixed

- 反向代理后的真实 IP 限流。
- 登录接口增加 IP 总限流。
- 管理员媒体访问权限与主人私有媒体隔离。
- 生产环境强制 `ATLAS_SESSION_SECRET`。
- 补充 `X-Frame-Options`、CSP `Report-Only`、HSTS 和 `X-Robots-Tag`。
