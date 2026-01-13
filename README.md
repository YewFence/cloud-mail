<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail</h1>
    <p align="center">基于 Cloudflare 的简约响应式邮箱服务，支持邮件发送、附件收发 🎉</p> 
</p>


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

- **📦 附件收发**：支持收发附件，使用R2对象存储保存和下载文件

- **🔔 邮件推送**：接收邮件后可以转发到TG机器人或其他服务商邮箱

- **📡 开放API**：支持使用API批量生成用户，多条件查询邮件 

- **📈 数据可视化**：使用ECharts对系统数据详情，用户邮件增长可视化显示

- **🎨 个性化设置**：可以自定义网站标题，登录背景，透明度

- **🤖 人机验证**：集成Turnstile人机验证，防止人机批量注册

- **⚡ 自动创建邮箱**：支持收到非存在账户邮件时自动创建邮箱（归属管理员）

- **🗄️ S3存储**：支持配置自定义 S3 兼容存储，不仅仅局限于 R2

- **📢 站点公告**：支持自定义站点公告弹窗，即时通知用户

- **👮 规则限制**：支持配置邮箱前缀长度限制及敏感词过滤

- **💾 EML 导出**：支持将邮件导出为标准 EML 格式，完整保留正文与附件

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
2) 进入 `Settings -> Secrets and variables -> Actions`，新增以下 Secrets：
   - 必填：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`D1_DATABASE_ID`、`KV_NAMESPACE_ID`
   - 可选：`R2_BUCKET_NAME`
   - 业务配置：`DOMAIN`、`ADMIN`、`JWT_SECRET`
   - LinuxDo 登录：`LINUXDO_CLIENT_ID`、`LINUXDO_CLIENT_SECRET`、`LINUXDO_CALLBACK_URL`、`LINUXDO_SWITCH`
3) 确认 `mail-worker/wrangler-action.toml` 存在（这是模板），Workflow 会用 `envsubst` 渲染成 `wrangler.generated.toml`。
4) 推送到 `main` 分支，或在 GitHub Actions 页面手动触发 `Deploy cloud-mail to Cloudflare Workers`。

关键点：
- 使用官方 `cloudflare/wrangler-action@v3`，不依赖 `npx wrangler`。
- 通过 `workingDirectory: ./mail-worker` 指定 Worker 目录。
- 若 `R2_BUCKET_NAME` 为空，会自动删除 `r2_buckets` 配置。
- 若 `D1_DATABASE_ID` 或 `KV_NAMESPACE_ID` 未配置，会跳过部署。
- 数据库迁移逻辑已调整为使用 `wrangler-action` 执行 `d1 migrations apply`，跟随部署步骤后运行，且同样受“是否跳过部署”的条件控制。

参考配置（位于 `.github/workflows/deploy-cloudflare.yml`，这里只展示核心片段）：

```yaml
- name: 🚀 部署 - Deploy
  id: deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    workingDirectory: ./mail-worker
    command: deploy -c wrangler.generated.toml

- name: 🗄️ 数据库迁移 - Apply D1 Migrations
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    workingDirectory: ./mail-worker
    command: d1 migrations apply cloud-mail --remote --config wrangler.generated.toml
```

部署后的 Workers 地址可以从 `deploy` 步骤的 `deployment-url` 输出中获取。

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
