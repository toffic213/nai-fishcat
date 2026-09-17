# novel · 创作工作台

一个可以直接部署到 Cloudflare Pages 的纯前端生图工作台原型。它包含提示词编辑、模型/画幅/采样参数、画师预设、批量队列、画廊收藏、浏览器本地持久化。

## 本地运行

直接用任意静态服务器打开项目即可，例如 `npx serve .`。不依赖构建步骤。

## 接入真实生图 API

项目内已提供 `functions/api/generate.js`，可作为 Cloudflare Pages Function 代理。部署时配置 `IMAGE_API_URL` 和 `IMAGE_API_KEY` 两个环境变量，将前端 `generate()` 中的本地预览替换为 `fetch('/api/generate', { method: 'POST', body: JSON.stringify({ prompt, model, ... }) })`，即可接入 OpenAI-compatible 或自有推理接口。密钥只放在 Pages 的服务端环境变量中。

## 数据存储

当前画廊和队列写入浏览器 `localStorage`，适合个人工作台；多人或跨设备版本可以把 `save()` 替换为 D1/R2/KV 接口，不需要调整界面结构。
