import { loadQuartzConfig } from "./quartz/plugins/loader/config-loader"
import { registerLayoutOverrides } from "./quartz/plugins/loader/layout-overrides"
import AiChat from "./quartz/components/AiChat"

// 注册自定义布局（在 loadQuartzConfig 之前，overrides 会被传入 PageTypeDispatcher）
registerLayoutOverrides({
  defaults: {
    afterBody: [AiChat({ apiEndpoint: "/api/ask" })],
  },
})

const config = await loadQuartzConfig()
export default config
