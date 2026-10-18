# LUMEN ATLAS · 流光坐标

一个可自托管的私人旅行影像星图：把照片按 **地点（国家 / 省 / 市 / 区县）** 与 **人物** 归档，在 3D 地球上重新看见自己的旅程。

- 当前示例部署：<https://lumen.chemcraze.asia>
- 源码仓库：<https://github.com/zqy20081015/lumen-atlas>
- 开发记录：<https://cmtho.chemcraze.asia/posts/lumen-atlas-build-log>
- 技术栈：React 19 + Vite 7 + MapLibre GL JS 5 + 高德 JS API 2.0 + Express 4 + Sharp
- 多用户：账号登录、邀请码注册、主人 / 管理员 / 成员三级权限
- 初次部署：访问 `/setup` 完成站点与主人账号初始化
- 数据：本机 `data/` 目录；不经过第三方云存储，也不会发送给 AI

---

## 目录

1. [功能](#功能)
2. [架构](#架构)
3. [环境要求](#环境要求)
4. [本地开发](#本地开发)
5. [首次部署配置页](#首次部署配置页)
6. [生产部署完整流程](#生产部署完整流程)
7. [环境变量](#环境变量)
8. [账号、角色与邀请码](#账号角色与邀请码)
9. [数据、备份与升级](#数据备份与升级)
10. [高德地图配置](#高德地图配置)
11. [AI 辅助开发说明](#ai-辅助开发说明)
12. [源码包与演示包](#源码包与演示包)
13. [故障排查](#故障排查)
14. [安全清单](#安全清单)
15. [License](#license)

---

## 功能

### 地图与地理

- 全球 3D 地球投影，桌面滚轮缩放、移动端双指缩放
- 中国行政区三级下钻：省级边界、370 个城市面、2840 个区县面
- 城市 / 区县边界按需加载，进入新城市自动切换
- 海外地点使用 OpenStreetMap / Nominatim；中国地点优先高德
- 街道级 POI、门牌、道路、景点、博物馆等细节
- LUMEN 全球星图与高德中国街道底图双底图切换
- 照片坐标始终以 **WGS-84** 存储；高德显示时实时转换为 **GCJ-02**
- 点击省 → 市 → 区县逐级下钻，地点侧栏与照片聚合联动

### 照片与搜索

- 拖拽 / 多选上传，最多 30 张，单张 50MB
- 自动读取 EXIF：拍摄日期、GPS、相机、镜头、光圈、快门、ISO、焦距、尺寸
- GPS 自动逆地理编码到国家 / 省 / 市 / 区县 / 街道
- **地点搜索始终可见**：中文优先高德 POI，失败回退 Nominatim
- 搜索结果可以直接“在此添加影像”，打开上传并预填整组照片的地点
- 也可以在复核页“在地图上精确取点”，或在 LUMEN / 高德底图上点击取点
- HEIC / HEIF 自动转换为 JPEG，并生成 WebP 展示图与缩略图
- 照片可编辑标题、日期、地点、人物、标签、注记和拍摄参数
- 删除照片会同时清理原图、展示图与缩略图

### 界面

- 科幻液态玻璃视觉、星尘 / 网格 / 扫描线
- 星图、档案、旅人、个人档案四个主界面
- 主人 / 管理员额外拥有“管理”后台
- 档案支持人物、年份、地区、坐标、关键词筛选
- 全局搜索（地点 / 影像 / 旅人，⌘K / Ctrl+K）
- 深色 / 浅色主题，亮色模式采用冰蓝白背景与高对比玻璃
- 响应式：桌面三栏浮层；移动端底部抽屉、底部导航与全屏弹层
- 自定义头像：上传后自动裁切 640×640 WebP

### 账号与权限

- 账号密码登录，密码使用 `scrypt` 加盐哈希
- HMAC 签名的 HttpOnly 会话 Cookie；HTTPS 下自动 `Secure`
- 邀请码注册：每位已注册用户都可以生成一次性邀请码
- 邀请码 14 天有效、单次使用，可撤销
- 每个账号的照片、人物、邀请码完全隔离
- 媒体文件也按账号鉴权，不能凭 URL 读取别人照片
- 角色：`owner` 主人 / `admin` 管理员 / `member` 成员
- 主人和管理员可进入后台；管理员可管理普通成员并授予管理员
- 主人可设置或取消管理员，可管理其他管理员
- 后台上传头像、用户禁用、临时密码、删除用户、邀请码总览、存储分布、最近上传、节点状态
- 站点设置：站点名称、介绍、描述、高德 Key；保存即时生效

---

## 架构

```text
Browser
  ├─ React 19 + Vite 7
  ├─ MapLibre GL JS 5 + OpenFreeMap（全球 / 球体）
  └─ AMap JS API 2.0（中国街道底图）
        │
        ▼
Express 4 (Node 22)
  ├─ 账号 / 邀请码 / 角色 / 会话
  ├─ 照片上传、EXIF、Sharp、HEIC
  ├─ JSON 数据库 + 原子写入
  ├─ 高德 Web 服务 / Nominatim / DataV 行政区
  └─ 按 userId 鉴权的媒体路由
        │
        ▼
data/
  ├─ db.json
  ├─ uploads/      展示 WebP
  ├─ thumbs/       缩略图
  ├─ originals/    原图
  ├─ avatars/      用户头像
  └─ geocode-cache.json
```

前端构建产物在 `dist/`，由 Express 直接托管；生产环境建议 Nginx / Caddy 反代 HTTPS。

---

## 环境要求

- **Node.js 22 LTS**（当前部署为 Node 22.x）
- npm 10+
- Linux / macOS；Windows 建议 WSL
- 至少 2GB 内存、2GB 可用磁盘（照片多时按实际容量扩展）
- 可选：Nginx / Caddy、Certbot、Cloudflare

`sharp` 与 `heic-convert` 使用预编译二进制；大多数 x64 / arm64 Linux 可以直接 `npm install`。如果安装失败，先确认系统架构与 Node 版本匹配。

---

## 本地开发

```bash
git clone <your-repo-url> lumen-atlas
cd lumen-atlas
npm install

cp .env.example .env
# 生成会话密钥并填入 ATLAS_SESSION_SECRET
openssl rand -hex 32

npm run dev       # 前端 Vite，默认 5173
# 另开终端
npm start         # API + 生产静态托管，默认 8099
```

开发时 Vite 需要访问 API；当前代码的 API 路径为同源相对路径，生产构建后由 Express 提供。若要联调，建议直接使用：

```bash
npm run build
npm start
```

然后打开 `http://localhost:8099`。

---

## 首次部署配置页

空数据库（还没有任何用户）时，打开：

```text
https://你的域名/setup
```

会进入 **一次性初始化页**，配置：

- 站点名称
- 一句话介绍
- 站点描述
- 主人显示名称
- 登录用户名 / 密码
- 高德 Key（可留空，后台再填）

完成后：

- 自动创建 `owner` 主人账号并登录
- 写入站点设置
- `/setup` 自动关闭
- 后续注册必须邀请码
- 站点名称同步到登录页、顶部品牌和浏览器标题
- 高德 Key 立即生效，不需要重启

> **安全提醒**：首次部署时先在服务器本机或受控网络完成 `/setup`，再开放公网。否则第一个访问者可能抢先创建主人账号。完成后 `/api/setup` 会返回 409。

已有用户时访问 `/setup` 会回到登录页。

---

## 生产部署完整流程

以下示例假设：

- 域名：`example.com`
- 安装目录：`/opt/lumen-atlas`
- 运行用户：`lumen`
- 应用端口：`127.0.0.1:8099`
- Nginx 对外 80/443
- 使用 Let's Encrypt

### 1. 安装 Node 与系统依赖

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl rsync
```

安装 Node.js 22（可使用 NodeSource、nvm 或系统包管理器），确认：

```bash
node -v    # v22.x
npm -v
```

### 2. 创建运行用户与目录

```bash
sudo useradd --system --home /opt/lumen-atlas --shell /usr/sbin/nologin lumen
sudo mkdir -p /opt/lumen-atlas
sudo chown -R lumen:lumen /opt/lumen-atlas
```

把源码放到 `/opt/lumen-atlas`，或先解压源码包。

### 3. 安装依赖并构建

```bash
cd /opt/lumen-atlas
sudo -u lumen npm ci
sudo -u lumen npm run build
```

如果源码目录尚未包含 `package-lock.json`，使用 `npm install` 并提交 lockfile。

### 4. 配置环境变量

```bash
sudo cp .env.example .env
sudo -u lumen nano .env
```

至少设置：

```env
PORT=8099
HOST=127.0.0.1
NODE_ENV=production
ATLAS_SESSION_SECRET=<openssl rand -hex 32>
```

`AMAP_KEY` 可以在 `.env` 预置，也可以先留空，在 `/setup` 或后台填写。

### 5. 创建 systemd 服务

复制示例：

```bash
sudo cp deploy/lumen-atlas.service.example /etc/systemd/system/lumen-atlas.service
sudo nano /etc/systemd/system/lumen-atlas.service
```

确认 `WorkingDirectory`、`User`、`ExecStart` 与实际路径一致。`ExecStart` 中的 Node 路径用：

```bash
command -v node
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lumen-atlas
sudo systemctl status lumen-atlas
```

### 6. 首次初始化

先在服务器本机打开：

```text
http://127.0.0.1:8099/setup
```

如果是远程服务器，可以用 SSH 端口转发，避免在初始化完成前暴露公网：

```bash
ssh -L 8099:127.0.0.1:8099 user@server
# 本地浏览器打开 http://127.0.0.1:8099/setup
```

### 7. 配置 Nginx

复制示例：

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/lumen-atlas
sudo ln -s /etc/nginx/sites-available/lumen-atlas /etc/nginx/sites-enabled/lumen-atlas
sudo nano /etc/nginx/sites-available/lumen-atlas
```

把 `example.com` 替换成真实域名，检查证书路径。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果证书还不存在，先只保留 80 端口的 server 块，运行 Certbot 后再补 443。

### 8. 申请 HTTPS 证书

```bash
sudo certbot --nginx -d example.com --redirect
```

Certbot 会修改 Nginx 配置并开启 HTTP → HTTPS。验证自动续期：

```bash
sudo certbot renew --dry-run
```

续期后如需 reload Nginx，可添加：

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'SH'
#!/bin/sh
systemctl reload nginx 2>/dev/null || true
SH
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### 9. 防火墙

```bash
sudo ufw allow 'Nginx Full'
sudo ufw delete allow 8099/tcp 2>/dev/null || true
sudo ufw status
```

应用只监听 `127.0.0.1:8099`；公网只开放 80/443。

### 10. Cloudflare（可选）

如果使用 Cloudflare：

1. 添加 A 记录指向服务器 IP。
2. 首次签发证书时先使用 **DNS only**（灰色云）。
3. 证书签发后可以开启代理（橙色云）。
4. SSL/TLS 模式设为 **Full (strict)**，因为源站已有有效证书。
5. 开启 Always Use HTTPS 可选。
6. 在 Cloudflare 的 WAF / 速率限制中保护 `/api/auth/login`、`/api/auth/register`、`/api/setup`。

高德控制台需要把域名加入 Key 白名单，见[高德地图配置](#高德地图配置)。

---

## 环境变量

完整模板见 `.env.example`。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PORT` | 否 | 默认 8099 |
| `HOST` | 否 | 默认 0.0.0.0；生产建议 `127.0.0.1` |
| `NODE_ENV` | 否 | 生产设为 `production` |
| `ATLAS_SESSION_SECRET` | 推荐必填 | 会话 HMAC 密钥；`openssl rand -hex 32` |
| `AMAP_KEY` | 否 | 高德 Web 服务 / JS API Key；也可在 `/setup` 或后台填 |
| `NOMINATIM_USER_AGENT` | 否 | Nominatim 请求标识，建议填写联系信息 |
| `ATLAS_DATA_DIR` | 否 | 覆盖数据目录，默认 `./data` |
| `ATLAS_SECURE_COOKIE` | 否 | 设为 `1` 时强制 Secure Cookie；通常由反代的 X-Forwarded-Proto 自动判断 |
| `ATLAS_OWNER_USERNAME` | 仅迁移 | 旧版单用户数据库迁移时的主人用户名 |
| `ATLAS_OWNER_PASSWORD` | 仅迁移 | 旧版单用户数据库迁移时的初始密码 |

> `ATLAS_OWNER_*` 只用于旧版单用户数据迁移；新安装请使用 `/setup`。

---

## 账号、角色与邀请码

### 角色权限

| 操作 | 主人 owner | 管理员 admin | 成员 member |
| --- | --- | --- | --- |
| 进入后台 | ✓ | ✓ | — |
| 管理普通成员 | ✓ | ✓ | — |
| 把成员设为管理员 | ✓ | ✓ | — |
| 取消管理员 | ✓ | — | — |
| 管理其他管理员 | ✓ | — | — |
| 修改主人 | — | — | — |
| 生成邀请码 | ✓ | ✓ | ✓ |
| 修改站点设置 | ✓ | — | — |
| 示例档案 | ✓ | — | — |

### 邀请流程

1. 登录任意账号。
2. 进入 **我的 → 邀请新的旅人**。
3. 点击“生成邀请码”，自动复制链接：

```text
https://你的域名/?invite=LUMEN-XXXX-XXXX
```

4. 被邀请人打开链接，直接进入注册页。
5. 每个邀请码单次使用、14 天有效。
6. 未使用的邀请码可以撤销。

### 后台

主人 / 管理员顶部会显示 **管理 / ADMIN**：

- 用户列表、搜索、角色、状态
- 禁用 / 启用
- 重置临时密码（只显示一次）
- 删除用户及其照片、人物、邀请码、头像
- 全站邀请码总览
- 存储分布、最近上传、节点状态
- 主人专属：站点设置（名称、介绍、描述、高德 Key）

管理员只能管理普通成员；管理员不能修改主人或其他管理员。取消管理员权限会立即让该账号的旧会话失效。

---

## 数据、备份与升级

### 数据结构

`data/db.json` 当前为 `version: 2`：

- `users[]`：账号、密码哈希、角色、个人档案、头像、禁用状态
- `people[]`：人物，每条带 `userId`
- `photos[]`：照片，每条带 `userId`
- `invites[]`：邀请码、创建者、有效期、使用记录
- `settings`：站点名称、介绍、描述、高德 Key

照片原图、展示图、缩略图、头像分别在 `data/originals/`、`data/uploads/`、`data/thumbs/`、`data/avatars/`。

### 备份

```bash
cd /opt/lumen-atlas
sudo tar czf /backup/lumen-atlas-$(date +%F).tar.gz data .env
```

`.env` 含会话密钥与高德 Key，备份文件要妥善保管。

### 升级

```bash
cd /opt/lumen-atlas
sudo tar czf /backup/lumen-atlas-before-upgrade-$(date +%F).tar.gz data .env
sudo -u lumen npm ci
sudo -u lumen npm run build
sudo systemctl restart lumen-atlas
```

数据库结构会在启动时自动补齐；不会清空现有用户和照片。升级前仍建议备份 `data/`。

### 恢复

```bash
sudo systemctl stop lumen-atlas
sudo tar xzf /backup/lumen-atlas-YYYY-MM-DD.tar.gz -C /opt/lumen-atlas
sudo chown -R lumen:lumen /opt/lumen-atlas/data
sudo systemctl start lumen-atlas
```

---

## 高德地图配置

1. 在高德开放平台创建应用。
2. 同时开通 **Web 服务** 与 **Web 端（JS API）** 的 Key 能力。
3. 在控制台设置域名白名单：

```text
你的域名
```

4. 把 Key 填入以下任一位置：

- `.env` 的 `AMAP_KEY`
- 首次部署 `/setup`
- 管理 → 站点设置

高德 Key 会下发给已登录浏览器（JS API 固有限制），因此必须设置域名白名单和配额告警。

中国境内的逆地理编码、中文 POI 搜索、街道 POI 优先使用高德；失败时回退 Nominatim + DataV 行政区划索引。海外地点使用 LUMEN 全球底图。

---

## AI 辅助开发说明

这个项目在开发、重构、测试与文档整理过程中使用了 AI 编程助手。

### AI 参与的范围

- React / CSS 界面与交互
- Express API、多用户数据模型、邀请码与权限逻辑
- 数据迁移、构建脚本、部署文档
- 自动化浏览器测试与界面截图
- README、部署说明与问题排查文档

### 运行时没有 AI

- 应用运行时不会调用任何大语言模型
- 照片、密码、会话、邀请码、高德 Key **不会发送给 AI 服务**
- `data/` 中的用户数据只存在你自己的服务器
- 仓库不包含任何 API Key、账号密码或用户照片

### 给维护者的提醒

AI 生成的代码和文档仍可能包含错误。开源发布或生产使用前，请人工检查：

1. 认证、会话、邀请码和媒体鉴权逻辑
2. 文件上传大小、MIME / 图片解码和路径处理
3. 反向代理、HTTPS、Cookie Secure、安全头
4. 依赖漏洞与许可证
5. 备份、恢复与升级流程
6. 高德 Key 白名单、配额与费用
7. 站点初始化完成前是否暴露公网

请不要把 `.env`、`data/db.json`、`data/owner-login.txt`、用户照片或邀请码粘贴给 AI 工具。

---

## 源码包与演示包

仓库的 `releases/` 会提供两种发布包：

### 无数据源码包

GitHub 仓库：<https://github.com/zqy20081015/lumen-atlas>

```text
lumen-atlas-source-clean-YYYYMMDD.tar.gz
```

包含：

- `LICENSE`（MIT）
- `src/`、`server/`、`public/`、`scripts/`
- `package.json`、`package-lock.json`
- `README.md`、`.env.example`
- `deploy/` 下的 systemd / Nginx 示例

不包含：

- `data/`（包括 db、照片、头像、邀请码、owner-login）
- `.env`
- `node_modules/`、`dist/`、`preview/`
- `.git/`、缓存

使用方式：

```bash
tar xzf lumen-atlas-source-clean-YYYYMMDD.tar.gz
cd lumen-atlas-source
npm ci
cp .env.example .env
# 设置 ATLAS_SESSION_SECRET
npm run build
npm start
# 打开 /setup
```

### 演示数据包

```text
lumen-atlas-demo-YYYYMMDD.tar.gz
```

包含一个独立的演示数据库：

```text
data/db.json
data/owner-login.txt
```

演示账号：

```text
用户名：demo
密码：demo12345
```

包含 9 张示例旅行海报、3 位示例人物，**不包含任何真实用户数据**。演示包同样不包含 `node_modules`、`dist`、`.env`。

演示包适合做界面展示或快速体验；正式部署前请修改演示密码，或删除演示账号后重新初始化。

也可以用脚本自行生成演示数据库：

```bash
node scripts/create-demo-db.mjs /path/to/package/data
```

---

## 故障排查

### 登录后立刻 401 / 一直要求登录

- 确认 Nginx 传了 `X-Forwarded-Proto: https`
- 确认 `.env` 的 `ATLAS_SESSION_SECRET` 固定且未在重启时变化
- 确认浏览器接受了 `Secure` Cookie
- 检查系统时间是否正确

### `/setup` 不出现

- 系统已经有用户时这是正常的；访问 `/setup` 会回到登录页
- 只有 `users.length === 0` 时才显示初始化页
- 如果数据库损坏，先备份 `data/db.json` 再排查

### 高德底图空白 / 搜索失败

- 确认 Key 同时开通 Web 服务与 JS API
- 确认高德控制台域名白名单包含当前域名
- 确认 `.env` 或后台的 Key 没有空格
- 中国低缩放级别可能瓦片覆盖不足，切换到 LUMEN 或放大查看

### 上传 413 / 上传中断

- Nginx `client_max_body_size` 至少 60m
- Cloudflare 免费计划请求体限制约 100MB
- 单张限制 50MB、一次最多 30 张
- 检查服务器磁盘空间和 `proxy_read_timeout`

### HEIC 无法读取

- `heic-convert` 依赖运行环境；尝试在服务器上重新安装依赖
- 或在手机端导出为 JPEG 后上传

### 头像 / 媒体 404

- 头像和照片媒体都需要登录会话
- 确认文件存在于 `data/avatars/` 或 `data/uploads/` 等目录
- 确认 `data/` 权限属于运行用户

### 证书续期失败

```bash
sudo certbot renew --dry-run
sudo journalctl -u nginx -n 50 --no-pager
```

Cloudflare 代理开启时，确保 80 端口的 ACME challenge 仍可回源。

---

## 安全清单

- [ ] 设置随机 `ATLAS_SESSION_SECRET`
- [ ] 全站 HTTPS，Cookie `Secure`
- [ ] 完成 `/setup` 后再开放公网
- [ ] 高德 Key 设置域名白名单与配额告警
- [ ] `data/` 只允许运行用户读取
- [ ] 定期备份 `data/` 和 `.env`
- [ ] 不在公开仓库提交 `.env` / `data/`
- [ ] 管理员权限只授予可信账号
- [ ] 定期更新依赖并检查漏洞
- [x] 已采用 MIT License

---

## License

本项目采用 **MIT License**。完整文本见仓库根目录的 [`LICENSE`](LICENSE)。

```text
Copyright (c) 2026 cmtho
```

第三方依赖、地图数据、示例图片、字体和演示素材分别遵循其各自许可证；再分发时请保留相应声明并核对许可条款。
