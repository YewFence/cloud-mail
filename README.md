<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail</h1>
    <p align="center">基于 Cloudflare 的简约响应式邮箱服务，支持邮件发送、附件收发 🎉</p>
</p>

## 快速部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YewFence/cloud-mail)

点击上方按钮即可一键部署到 Cloudflare Workers。部署过程会自动：
- Fork 本仓库到你的 GitHub 账户
- 创建 D1 数据库、KV 命名空间、R2 存储桶
- 配置 Workers Builds 实现 CI/CD 自动部署

**部署后配置步骤：**
1. 在 Cloudflare Dashboard 进入你的 Worker 设置
2. 配置以下 Secrets（Settings → Variables and Secrets）：
   - `admin` - 管理员邮箱地址
   - `jwt_secret` - JWT 密钥（不要包含 `?%#/\` 等特殊字符）
3. 配置环境变量：
   - `domain` - 邮件域名，JSON 数组格式，如 `["example.com"
4. 配置邮件域名的 MX 记录指向 Cloudflare Email Routing
5. 重新触发一次部署（数据库迁移会自动执行）


## 项目简介

**本项目基于 [Cloud Mail](https://github.com/maillab/cloud-mail) 二次开发，新增了一些小功能。**

只需要一个域名，就可以创建多个不同的邮箱，类似各大邮箱平台，本项目支持署到 Cloudflare Workers ，降低服务器成本，搭建自己的邮箱服务。

原项目拥有更详细的文档参考，请访问：[https://github.com/maillab/cloud-mail](https://github.com/maillab/cloud-mail)

## 项目展示

| ![](/doc/demo/demo1.png) | ![](/doc/demo/demo2.png) |
|-----------------------|-----------------------|
| ![](/doc/demo/demo3.png) | ![](/doc/demo/demo4.png) |




## 功能介绍

- **💰 低成本使用**： 可部署到 Cloudflare Workers 降低服务器成本

- **💻 响应式设计**：响应式布局自动适配PC和大部分手机端浏览器

- **📧 邮件发送**：集成Resend发送邮件，支持群发，内嵌图片和附件发送，发送状态查看

- **🛡️ 管理员功能**：可以对用户，邮件进行管理，RABC权限控制对功能及使用资源限制

- **📦 附件收发**：支持收发附件，保存和下载文件

- **🔔 邮件推送**：接收邮件后可以转发到TG机器人或其他服务商邮箱

- **📡 开放API**：支持使用API批量生成用户，多条件查询邮件 

- **📈 数据可视化**：使用ECharts对系统数据详情，用户邮件增长可视化显示

- **🎨 个性化设置**：可以自定义网站标题，登录背景，透明度

- **🤖 人机验证**：集成Turnstile人机验证，防止人机批量注册

- **📢 站点公告**：支持自定义站点公告弹窗，即时通知用户

- **👮 规则限制**：支持配置邮箱前缀长度限制及敏感词过滤

- **📌 邮箱置顶**：支持将常用邮箱置顶显示，方便快速切换

- **🔄 自动刷新**：邮件列表支持自动刷新，实时获取新邮件

- **🖱️ 右键菜单**：支持右键菜单快捷操作及用户批量删除

## 特色功能

> 以下是按照我自己的需求新增的一些功能

- **💾 EML 导出**：支持将邮件导出为标准 EML 格式，完整保留正文与附件
  
- **📅 网格模式**：使用网格模式展示邮箱列表，快速找到对应邮箱

- **⚡ 自动创建邮箱**：支持收到非存在账户邮件时自动创建邮箱，便捷归类邮件（归属管理员）

- **🗄️ S3存储**：支持配置自定义 S3 兼容存储，不仅仅局限于 R2

- **🌥️ 安全部署**：在部署时将 JWT Secret 等敏感信息存入 Cloudflare Workers Secret 加强安全性

- **📜 更多功能**：正在开发中...



## 技术栈

- **平台**：[Cloudflare Workers](https://developers.cloudflare.com/workers/)

- **Web框架**：[Hono](https://hono.dev/)

- **ORM：**[Drizzle](https://orm.drizzle.team/)

- **前端框架**：[Vue3](https://vuejs.org/) 

- **UI框架**：[Element Plus](https://element-plus.org/) 

- **邮件推送：** [Resend](https://resend.com/)

- **缓存**：[Cloudflare KV](https://developers.cloudflare.com/kv/)

- **数据库**：[Cloudflare D1](https://developers.cloudflare.com/d1/)

- **文件存储**：[Cloudflare R2](https://developers.cloudflare.com/r2/)

## GitHub Actions 部署教程（wrangler-action）

这套 CI 会在你推送 `main` 分支（且改动包含 `mail-worker/**` 或 `mail-vue/**`）时自动部署，也支持手动触发。

步骤如下：

1) 在 GitHub 仓库中打开 Actions（默认是开启的）。

2) 进入 `Settings -> Secrets and variables -> Actions`，配置以下内容：

**Secrets 配置：**

| 名称 | 必填 | 说明 | 示例/备注 |
|------|----------|------|----------|
| `CLOUDFLARE_API_TOKEN` | ✅ | Cloudflare API 令牌 | - |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Cloudflare 账户 ID | - |
| `ADMIN` | ✅ | 管理员账户配置 | `hello@example.com` 你的任意一个域名邮箱 |
| `JWT_SECRET` | ✅ | JWT 密钥 | 一串随机的复杂的字符串 |
| `LINUXDO_CLIENT_SECRET` | ❌ | LinuxDo 登录密钥 | - |
**Variables 配置：**

| 名称 | 必填 | 说明 | 示例/备注 |
|------|----------|------|----------|
| `DOMAIN` | ✅ | 邮件域名列表（支持多个） | `["mail.example.com", "mail.example2.com"]` |
| `D1_DATABASE_ID` | ✅ | D1 数据库 ID | - |
| `KV_NAMESPACE_ID` | ✅ | KV 命名空间 ID | - |
| `R2_BUCKET_NAME` | 可选 | R2 存储桶名称 | 需在 Cloudflare 控制台手动创建 |
| `NAME` | 可选 | Worker/D1/KV 的名称 | 默认为 `cloud-mail` ⚠️ 自定义名称功能未经过测试，建议使用默认值 |
| `LINUXDO_CLIENT_ID` | 可选 | LinuxDo 客户端 ID | LinuxDo 登录功能相关 |
| `LINUXDO_CALLBACK_URL` | 可选 | LinuxDo 回调 URL | LinuxDo 登录功能相关 |
| `LINUXDO_SWITCH` | 可选 | LinuxDo 功能开关 | LinuxDo 登录功能相关 |
     
     > **⚠️ LinuxDo OAuth 安全提示**  
     > LinuxDo OAuth 功能目前存在已知安全限制：
     > - 用户可以绑定任意未被注册的邮箱地址（已注册的邮箱会被拒绝）
     > - 可能存在邮箱抢注风险
     > 
     > **建议：**
     > - 如非必要，建议不启用此功能（默认禁用）
     > - 如需启用，请确保限制可注册的邮箱域名，并定期审查绑定记录
     > - 我们已添加基本防护（防止绑定已存在邮箱），但仍建议谨慎使用

4) 确认 `mail-worker/wrangler-action.toml` 存在（这是模板），Workflow 会用 `envsubst` 渲染成 `wrangler.generated.toml`。
5) 推送到 `main` 分支，或在 GitHub Actions 页面手动触发 `Deploy cloud-mail to Cloudflare Workers`。

关键点：
- **D1 和 KV**：首次部署时，若未配置 `D1_DATABASE_ID` 或 `KV_NAMESPACE_ID`，会自动检测并创建对应资源。在之后的更新中也会自动检测是否存在对应资源，避免重复创建。但是建议首次部署后查看 Action 输出配置 ID 并保存到仓库 Variables 中以加快后续部署速度。
- **R2 需手动创建**：R2 存储桶需要绑定支付方式才能开通，因此不支持自动创建。如不配置 `R2_BUCKET_NAME`，附件将存储在 KV 中（有 25MB 大小限制）。

> R2 存储桶创建教程请参考官方文档：[R2 官方文档](https://developers.cloudflare.com/r2/)。
> > 虽然 R2 需要绑定支付方式而且是即用即付+后付费服务，但是免费额度较高，个人使用一般不会产生费用。
> 或者你也可以在部署完成后在设置内配置 S3 兼容存储。

- 使用官方 `cloudflare/wrangler-action@v3`，不依赖 `npx wrangler`。
- 数据库迁移会在部署后自动执行。

## S3 存储配置须知

本项目支持配置兼容 S3 的对象存储（如 AWS S3, MinIO, Cloudflare R2 自定义域名接入等）来存储附件。

**重要提示：**

如果您使用 S3 存储，必须在 S3 存储桶的配置中添加正确的 **CORS（跨域资源共享）** 策略，否则前端可能无法预览或下载附件（虽然附件下载功能现已通过 Worker 代理增强以规避此问题，但某些直接访问场景仍需 CORS）。

推荐的 CORS 配置如下（以 AWS S3 JSON 格式为例）：

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "HEAD",
            "POST",
            "DELETE"
        ],
        "AllowedOrigins": [
            "https://your-domain.com",
            "http://localhost:*"
        ],
        "ExposeHeaders": []
    }
]
```

> **注意：** 请将 `https://your-domain.com` 替换为您的 Cloud Mail 部署域名，`http://localhost:*` 用于本地开发调试。

## 目录结构

```
cloud-mail
├── mail-worker				    # worker后端项目
│   ├── src                  
│   │   ├── api	 			    # api接口层			
│   │   ├── const  			    # 项目常量
│   │   ├── dao                 # 数据访问层
│   │   ├── email			    # 邮件处理接收
│   │   ├── entity			    # 数据库实体
│   │   ├── error			    # 自定义异常
│   │   ├── hono			    # web框架配置、拦截器、全局异常等
│   │   ├── i18n			    # 语言国际化
│   │   ├── init			    # 数据库缓存初始化
│   │   ├── model			    # 响应体数据封装
│   │   ├── security			# 身份权限认证
│   │   ├── service			    # 业务服务层
│   │   ├── template			# 消息模板
│   │   ├── utils			    # 工具类
│   │   └── index.js			# 入口文件
│   ├── pageckge.json			# 项目依赖
│   └── wrangler.toml			# 项目配置
│
├── mail-vue				    # vue前端项目
│   ├── src
│   │   ├── axios 			    # axios配置
│   │   ├── components			# 自定义组件
│   │   ├── echarts			    # echarts组件导入
│   │   ├── i18n			    # 语言国际化
│   │   ├── init			    # 入站初始化
│   │   ├── layout			    # 主体布局组件
│   │   ├── perm			    # 权限认证
│   │   ├── request			    # api接口
│   │   ├── router			    # 路由配置
│   │   ├── store			    # 全局状态管理
│   │   ├── utils			    # 工具类
│   │   ├── views			    # 页面组件
│   │   ├── app.vue			    # 入口组件
│   │   ├── main.js			    # 入口js
│   │   └── style.css			# 全局css
│   ├── package.json			# 项目依赖
└── └── env.release				# 项目配置
```

## 许可证

本项目采用 [MIT](LICENSE) 许可证
