import { loadQuartzConfig } from "./quartz/plugins/loader/config-loader"
import { registerLayoutOverrides } from "./quartz/plugins/loader/layout-overrides"
import { registerSiteTreeTransforms } from "./quartz/plugins/loader/tree-transforms"
import AiChat from "./quartz/components/AiChat"
import Banner from "./quartz/components/Banner"
import { bannerTransform } from "./quartz/components/bannerTransform"
// 【2026-09-29】按需求隐藏「最近的笔记」模块，代码保留，取消下面三处注释即可恢复
// import CollapsibleRecentNotes from "./quartz/components/CollapsibleRecentNotes"
import HeadingFold from "./quartz/components/HeadingFold"
import ImageLightbox from "./quartz/components/ImageLightbox"
import MusicPlayer from "./quartz/components/MusicPlayer"
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
//   left   探索 + 搜索/工具条（「最近的笔记」已停用，代码保留）
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
// const RecentNotesPanel = CollapsibleRecentNotes({
//   title: "最近的笔记",
//   collapsed: true,
//   recentNotesOptions: {
//     limit: 5,
//     showTags: false,
//     linkToMore: false,
//   },
// })

// 背景音乐播放器（左下角悬浮按钮 + 展开卡）
// 音频文件放 quartz/static/music/ 下，在此登记曲目即可（title 显示名 / src 站点路径）
const BgmPlayer = MusicPlayer({
  tracks: [{ title: "英雄序章", src: "/static/music/hero-prologue.mp3" }],
})

registerLayoutOverrides({
  defaults: {
    // afterBody 追加组件（与 YAML 合并，非替换）
    //   - AiChat：右下角浮动问答
    //   - ReaderModeDefault：无 DOM，仅注入「阅读模式默认值」脚本
    //     【2026-09-30】默认改为关闭（enabled: false）：两侧边栏默认可见；
    //     用户手动切换阅读模式仍会记录到 localStorage，尊重个人偏好
    //   - BgmPlayer：左下角背景音乐播放器
    //   - ImageLightbox：正文图片点击全屏放大（自研轻量灯箱，支持多图左右切换、
    //     点击遮罩/ESC/滚动/下滑关闭；灯箱外壳挂 body 直属，SPA 换页不销毁）
    afterBody: [
      AiChat({ apiEndpoint: "/api/ask" }),
      ReaderModeDefault({ enabled: false }),
      // 实验分支：正文标题折叠（前端侧方案），验证后再决定是否合入 v5
      HeadingFold(),
      ImageLightbox(),
      BgmPlayer,
    ],
  },
  // header 插槽追加 Banner
  appendHeader: [TopBanner],
  // left 插槽：「最近的笔记」置底（2026-09-29 起停用，代码保留）
  // appendLeft: [RecentNotesPanel],
})

// 站点级 TreeTransform：在 Obsidian 嵌入展开后提取文章头图，供 Banner 使用
registerSiteTreeTransforms([bannerTransform])

const config = await loadQuartzConfig()
export default config
