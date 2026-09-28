import { Element, Root } from "hast"
import type { TreeTransform } from "../plugins/types"
import type { QuartzComponentProps } from "./types"

/**
 * bannerTransform —— 为每篇文章提取「正文顶部的第一张图片」作为 banner 背景
 * ----------------------------------------------------------------------------
 * 时机很重要：TreeTransform 由 renderPage 在 renderTranscludes() 之后调用，
 * 此时 Obsidian 的图片嵌入（![[image.png]]）已经展开成真实的 <img> 节点。
 * 若在组件里直接遍历 tree，会因为渲染时机更早而拿不到图片。
 *
 * 行为：
 *   1. 按文档顺序找到正文第一张 <img>，把 src 写入 frontmatter.bannerImage
 *   2. 给该图片加上 .banner-lifted-image 类（CSS 中隐藏，避免与 banner 重复）
 *
 * 图片位置的判定：只在「正文开头区域」取图 —— 即遇到第一个标题（h1~h6）
 * 之前的图片才视为头图，避免把正文中间的插图误当成 banner。
 */

/** 在 hast 树中按文档顺序找第一张图片，且必须位于首个标题之前 */
function findTopImage(root: Root): Element | undefined {
  let result: Element | undefined

  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false
    const n = node as Element

    if (n.type !== "element") return false

    // 遇到标题即停止 —— 之后的图片不属于「顶部头图」
    if (/^h[1-6]$/.test(n.tagName)) return true

    if (n.tagName === "img" && typeof n.properties?.src === "string") {
      result = n
      return true
    }

    for (const child of n.children ?? []) {
      if (walk(child)) return true
    }
    return false
  }

  // 逐个顶层节点推进；一旦某个节点返回 true（命中图片或标题）就停止
  for (const child of root.children ?? []) {
    if (walk(child)) break
  }

  return result
}

export const bannerTransform: TreeTransform = (
  root: Root,
  _slug: string,
  componentData: QuartzComponentProps,
) => {
  // 该 transform 会被挂到每个 pageType 上，由 dispatcher 聚合后可能多次执行
  // 同一棵树，因此用标记位保证幂等。
  const fm = componentData.fileData.frontmatter
  if (fm?.__bannerProcessed) return

  const img = findTopImage(root)

  if (img) {
    const src = img.properties?.src as string
    if (src) {
      // 写入 frontmatter，供 Banner 组件读取
      componentData.fileData.frontmatter = componentData.fileData.frontmatter ?? {}
      componentData.fileData.frontmatter.bannerImage = src

      // 标记该图片，CSS 中隐藏之（banner 已展示同一张图）
      const cls = (img.properties?.className as string[] | undefined) ?? []
      if (!cls.includes("banner-lifted-image")) {
        img.properties = {
          ...img.properties,
          className: [...cls, "banner-lifted-image"],
        }
      }
    }
  }

  componentData.fileData.frontmatter = componentData.fileData.frontmatter ?? {}
  componentData.fileData.frontmatter.__bannerProcessed = true
}
