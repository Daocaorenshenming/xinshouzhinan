import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { joinSegments, pathToRoot } from "../util/path"
import { Root } from "hast"

/**
 * 顶部 Banner 组件
 * ----------------------------------------------------------------------------
 * 背景图来源（按优先级）：
 *   1. 当前文章正文顶部的第一张图片（由 TreeTransform 提前写入 frontmatter）
 *   2. 找不到头图时回退到默认图 /img/banner_1.jpg（可用 options 覆盖）
 *
 * 尺寸：定高 300px，宽度自适应；图片用 cover 自动拉伸填满。
 *
 * 实现说明 —— 为什么背景图不在这里解析：
 *   正文图片要等 renderTranscludes() 处理完 Obsidian 嵌入（![[...]]）之后
 *   才会出现在 hast 树里，而组件渲染时机早于此，直接遍历 tree 拿不到图片。
 *   因此由 bannerTransform（见 bannerTransform.ts）在 transclude 之后扫描
 *   正文、把结果写进 fileData.frontmatter.__bannerImage，组件只负责读取。
 *
 * 定位：组件通过 header 插槽注入，但 header 位于中间内容列内部。若参与
 *   CSS Grid 布局会与左右侧栏抢空间（曾导致左侧栏被覆盖），故一律用
 *   position: absolute 脱离布局流，背景由 CSS 铺满视口宽度。
 */

const DEFAULT_BANNER = "/img/banner_1.jpg"

export type BannerOptions = {
  /** 高度，任意 CSS 长度，默认 300px */
  height?: string
  /** 默认背景图（相对站点根），默认 /img/banner_1.jpg */
  fallbackImage?: string
  /** 固定自定义背景图；设置后将忽略文章头图 */
  backgroundImage?: string
}

const defaultOptions: BannerOptions = {
  height: "300px",
  fallbackImage: DEFAULT_BANNER,
  backgroundImage: "",
}

const Banner: QuartzComponent = ({
  fileData,
  displayClass,
  cfg,
  opts,
}: QuartzComponentProps & { opts?: BannerOptions }) => {
  const o: BannerOptions = { ...defaultOptions, ...(opts ?? {}) }

  // 由 TreeTransform 注入（正文头图）；无头图时为 undefined
  const inlineSrc = fileData.frontmatter?.bannerImage as string | undefined

  const backgroundImage = o.backgroundImage || inlineSrc || o.fallbackImage || DEFAULT_BANNER
  const baseDir = pathToRoot(fileData.slug!)

  const isAbsolute = /^(https?:)?\/\//.test(backgroundImage) || backgroundImage.startsWith("data:")
  const resolvedSrc = isAbsolute
    ? backgroundImage
    : joinSegments(baseDir, backgroundImage.replace(/^\.?\//, ""))

  const classes = classNames(displayClass, "site-banner")

  return (
    <section
      class={classes}
      style={`--banner-height: ${o.height}; --banner-image: url("${resolvedSrc}")`}
      aria-label={cfg.pageTitle}
      data-banner-source={inlineSrc ? "inline" : "fallback"}
    >
      {/* 背景层：铺满整个视口宽度 */}
      <div class="banner-bg" />
      {/* 内容层：对齐中间内容列，便于日后放标题 */}
      <div class="banner-content" />
    </section>
  )
}

Banner.css = `
/* 仅保留必要骨架 —— 详细样式在 styles/custom.scss 统一维护 */
.site-banner {
  --banner-height: 300px;
  --banner-image: none;
  position: relative;
  width: 100%;
}
`

export default ((opts?: BannerOptions) => {
  const cmp: QuartzComponent = (props: QuartzComponentProps) => Banner({ ...props, opts })
  cmp.css = Banner.css
  return cmp
}) satisfies QuartzComponentConstructor<BannerOptions>
