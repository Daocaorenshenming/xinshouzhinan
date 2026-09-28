/**
 * Worker 本地冒烟测试：模拟 Cloudflare Workers 运行时调用 worker.js
 * 用法: node --env-file=.env.local test-worker.mjs
 */
import worker from "./worker.js"

const env = {
  ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
  ZHIPU_MODEL: process.env.ZHIPU_MODEL,
  ASSETS: {
    // 模拟静态资产绑定（本测试只打 /api/ask，不会用到）
    async fetch() {
      return new Response("static asset placeholder", { status: 200 })
    },
  },
}

// ---- 用例 1: GET /api/ask 应 405 ----
const r1 = await worker.fetch(new Request("http://localhost/api/ask"), env, {})
console.log("GET /api/ask =>", r1.status, "(期望 405)")

// ---- 用例 2: POST 空 body 应 400 ----
const r2 = await worker.fetch(
  new Request("http://localhost/api/ask", { method: "POST", body: "not json" }),
  env,
  {},
)
console.log("POST 非法body =>", r2.status, (await r2.json()).error, "(期望 400)")

// ---- 用例 3: POST 正常问题应返回 answer + sources ----
const r3 = await worker.fetch(
  new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "大秘境是什么",
      context: "术语 史诗钥石地下城\n释义 昵称，名称来源于《暗黑破坏神》类似场景",
      sources: [{ title: "大秘境", path: "/数据库/术语库/大秘境" }],
    }),
  }),
  env,
  {},
)
const j3 = await r3.json()
console.log("POST 正常问题 =>", r3.status, "(期望 200)")
console.log("  answer 前 80 字:", (j3.answer || j3.error || "").slice(0, 80))
console.log("  sources 数:", (j3.sources || []).length, "(期望 1)")

// ---- 用例 4: 静态路径走 ASSETS ----
const r4 = await worker.fetch(new Request("http://localhost/some-page"), env, {})
console.log("静态路径 =>", r4.status, await r4.text(), "(期望走 ASSETS 占位)")

const ok = r1.status === 405 && r2.status === 400 && r3.status === 200 && (j3.sources || []).length === 1 && r4.status === 200
console.log(ok ? "\n✅ Worker 冒烟测试全部通过" : "\n❌ 存在失败用例")
process.exit(ok ? 0 : 1)
