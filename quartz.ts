import { loadQuartzConfig } from "./quartz/plugins/loader/config-loader"
import { registerLayoutOverrides } from "./quartz/plugins/loader/layout-overrides"
import { registerSiteTreeTransforms } from "./quartz/plugins/loader/tree-transforms"
import AiChat from "./quartz/components/AiChat"
import Banner from "./quartz/components/Banner"
import { bannerTransform } from "./quartz/components/bannerTransform"
import CollapsibleRecentNotes from "./quartz/components/CollapsibleRecentNotes"
import HeadingFold from "./quartz/components/HeadingFold"
import ReaderModeDefault from "./quartz/components/ReaderModeDefault"

// ============================================================================
// 站点布局定制
// ----------------------------------------------------------------------------
// 说明：本文件的 `export default config` 其实不会被使用。esbuild 只把
// quartz.ts 当作副作用模块打包，作用就是在启动时调用
// registerLayoutOverrides()。真正的布局由 config-loader 读取
// quartz.config.yaml 后构造，所以所有定制都必须通过 overrides 注入 ——
// 这样升级 Quartz 默认配置时也不会覆盖我们的改动。
//
// 最终结构（桌面端三栏）：
//   left   探索 + 搜索/工具条 + 可折叠的「最近的笔记」
//   header 顶部全宽 Banner（高 300px，通栏，宽度自适应）
//   right  目录 + 知识图谱 + 反向链接
//   afterBody AI 问答浮动组件
// ============================================================================

// 顶部全宽 Banner（放在 header 插槽）
// 背景图来源：文章头图（自动提取）→ 无头图时回退到默认图
const TopBanner = Banner({
  height: "300px",
  fallbackImage: "/img/banner_1.jpg",
  hideInlineImage: true,
})

// 可折叠的「最近的笔记」：折叠外壳 + 官方组件渲染列表
// 标题样式与「探索」对齐（1rem / 700 / --dark），详见 custom.scss
const RecentNotesPanel = CollapsibleRecentNotes({
  title: "最近的笔记",
  collapsed: true,
  recentNotesOptions: {
    limit: 5,
    showTags: false,
    linkToMore: false,
  },
})

registerLayoutOverrides({
  defaults: {
    // afterBody 追加组件（与 YAML 合并，非替换）
    //   - AiChat：右下角浮动问答
    //   - ReaderModeDefault：无 DOM，仅注入「阅读模式默认开启」脚本
    afterBody: [
      AiChat({ apiEndpoint: "/api/ask" }),
      ReaderModeDefault({ enabled: true }),
      // 实验分支：正文标题折叠（前端侧方案），验证后再决定是否合入 v5
      HeadingFold(),
    ],
  },
  // header 插槽追加 Banner
  appendHeader: [TopBanner],
  // left 插槽：「最近的笔记」置底
  appendLeft: [RecentNotesPanel],
})

// 站点级 TreeTransform：在 Obsidian 嵌入展开后提取文章头图，供 Banner 使用
registerSiteTreeTransforms([bannerTransform])

const config = await loadQuartzConfig()
export default config
