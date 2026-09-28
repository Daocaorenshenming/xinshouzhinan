/**
 * Cloudflare Workers 入口（Git 集成部署用）
 *
 * 背景：
 *   Cloudflare 2025 年把 Pages 的 Git 创建入口并入 Workers 流程。
 *   Workers 流程不会自动识别 Pages 约定的 functions/ 目录，
 *   因此需要这个入口脚本手动路由：
 *
 *     POST /api/ask  → 复用 functions/api/ask.js 的 AI 问答逻辑
 *     其余请求       → 由静态资产（public/）直接服务
 *
 * 配套配置见 wrangler.jsonc：
 *   - assets.run_worker_first: ["/api/*"]  让 API 路径先进本 Worker
 *   - assets.directory: "./public"         构建产物目录
 *   - assets.not_found_handling: "404-page" 用 public/404.html 兜底
 *
 * 环境变量（Cloudflare 控制台 → 设置 → 变量和机密）：
 *   ZHIPU_API_KEY / ZHIPU_MODEL  与 Pages 版本一致
 */

import { onRequestPost, onRequestOptions } from "./functions/api/ask.js"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === "/api/ask") {
      if (request.method === "POST") {
        // Pages Functions 的 onRequestPost(context) 约定：
        // context = { request, env, ctx } —— 与 Worker 运行时签名天然一致
        return onRequestPost({ request, env, ctx })
      }
      if (request.method === "OPTIONS") {
        return onRequestOptions()
      }
      return new Response(JSON.stringify({ error: "仅支持 POST 请求" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    // 非 API 路径：交给静态资产服务（正常情况下 run_worker_first
    // 已让静态请求绕过本 Worker，这里是兜底）
    return env.ASSETS.fetch(request)
  },
}
