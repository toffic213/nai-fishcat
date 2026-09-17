# novel · 创作工作台

一个可以直接部署到 Cloudflare Pages 的纯前端生图工作台原型。它包含提示词编辑、模型/画幅/采样参数、画师预设、批量队列、画廊收藏、浏览器本地持久化。

## 本地运行

直接用任意静态服务器打开项目即可，例如 `npx serve .`。不依赖构建步骤。

## Cloudflare Pages 部署

此项目使用 Pages Functions，`functions/api/generate.js` 会映射为同源的 `/api/generate`。请在 Cloudflare Pages 项目中连接此仓库，构建命令留空，输出目录填写 `.`；不要使用 `npx wrangler deploy`，那是 Workers 部署命令，可能只上传静态资源而不会启用 Pages Functions。

在 Pages 设置中添加 `NOVELAI_TOKEN`（Production 和 Preview 环境都需要）。前端也支持在设置窗口输入 Token；请求会先发到本站 `/api/generate`，由 Function 服务器端访问 NovelAI，因此不会触发浏览器 CORS。

## 接入真实生图 API

项目内已提供 `functions/api/generate.js`，可作为 Cloudflare Pages Function 代理。部署时配置 `IMAGE_API_URL` 和 `IMAGE_API_KEY` 两个环境变量，将前端 `generate()` 中的本地预览替换为 `fetch('/api/generate', { method: 'POST', body: JSON.stringify({ prompt, model, ... }) })`，即可接入 OpenAI-compatible 或自有推理接口。密钥只放在 Pages 的服务端环境变量中。

## 数据存储

当前画廊和队列写入浏览器 `localStorage`，适合个人工作台；多人或跨设备版本可以把 `save()` 替换为 D1/R2/KV 接口，不需要调整界面结构。
