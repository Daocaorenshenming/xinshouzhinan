/**
 * Cloudflare Pages Function — AI 问答 API
 *
 * 路由: POST /api/ask
 * 入参: { question: string, context: string, sources: [{title, path}] }
 * 出参: { answer: string, sources: [{title, path}] }
 *
 * 环境变量（在 Cloudflare Pages 控制台配置）:
 *   ZHIPU_API_KEY   — 智谱开放平台密钥
 *   ZHIPU_MODEL     — 模型名，默认 glm-4-flash
 *
 * 安全设计:
 *   - API Key 只存在于服务端环境变量
 *   - 简单的内存级限流，防滥用
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 分钟
const RATE_LIMIT_MAX = 10 // 每 IP 每分钟最多 10 次

// 简单的内存限流表（Worker 实例级，冷启动后重置）
const rateLimitMap = new Map()

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown"
  )
}

function checkRateLimit(ip) {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }

  record.count++
  if (record.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.start + RATE_LIMIT_WINDOW_MS - now) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  })
}

const SYSTEM_PROMPT = `你是《英雄序章》的 AI 助手，一个魔兽世界（World of Warcraft）正式服新手指南站点的问答助手。

回答要求：
1. 只依据下面提供的【参考资料】回答，不要编造资料以外的内容
2. 如果资料不足以回答，明确说明"本站资料中暂未收录相关内容"，并建议用户提问相关方向
3. 使用简体中文，语气友好、简洁，面向新手
4. 魔兽黑话和英文缩写要解释清楚
5. 回答控制在 300 字以内，重点突出
6. 不要在回答中重复"根据参考资料"这类表述，直接给出答案`

export async function onRequestPost(context) {
  const { request, env } = context

  // ---- 限流 ----
  const ip = getClientIp(request)
  const limit = checkRateLimit(ip)
  if (!limit.allowed) {
    return json(
      { error: `请求过于频繁，请 ${limit.retryAfter} 秒后再试` },
      429,
      { "Retry-After": String(limit.retryAfter) },
    )
  }

  // ---- 解析入参 ----
  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: "请求格式错误" }, 400)
  }

  const question = (payload?.question || "").toString().trim().slice(0, 200)
  const contextText = (payload?.context || "").toString().slice(0, 8000)
  const sources = Array.isArray(payload?.sources) ? payload.sources.slice(0, 6) : []

  if (!question) {
    return json({ error: "问题不能为空" }, 400)
  }

  // ---- 检查密钥 ----
  const apiKey = env.ZHIPU_API_KEY
  if (!apiKey) {
    return json(
      { error: "服务未配置（缺少 ZHIPU_API_KEY 环境变量）" },
      500,
    )
  }

  const model = env.ZHIPU_MODEL || "glm-4-flash"

  // ---- 调用 LLM ----
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `【参考资料】\n${contextText}\n\n【用户问题】\n${question}`,
    },
  ]

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const upstream = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "")
      console.error("LLM upstream error:", upstream.status, errText.slice(0, 500))
      return json(
        { error: `AI 服务返回错误（${upstream.status}）` },
        502,
      )
    }

    const data = await upstream.json()
    const answer =
      data?.choices?.[0]?.message?.content?.trim() || "抱歉，我暂时无法回答这个问题。"

    return json({ answer, sources })
  } catch (err) {
    const isTimeout = err?.name === "AbortError"
    console.error("LLM request failed:", err)
    return json(
      { error: isTimeout ? "AI 服务响应超时，请重试" : "AI 服务暂时不可用" },
      504,
    )
  }
}

// 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

// 其他方法拒绝
export async function onRequest() {
  return json({ error: "仅支持 POST 请求" }, 405)
}
