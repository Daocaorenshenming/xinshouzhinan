/**
 * 站点级 TreeTransform 注册点
 *
 * 与 layout-overrides.ts 同样的思路：quartz.ts 只作为副作用模块被打包，
 * 因此自定义的 treeTransforms 也在这里集中注册，由 config-loader 统一
 * 挂载到所有 pageType 上。
 *
 * 为什么需要它：
 *   TreeTransform 在 renderTranscludes() 之后运行，此时 Obsidian 的
 *   ![[image.png]] 嵌入已展开为真实 <img> 节点。Banner 组件渲染时机更早，
 *   拿不到这些图片，所以靠这里提前把「文章头图」写进 frontmatter。
 */
import type { TreeTransform } from "../types"

let siteTreeTransforms: TreeTransform[] = []

export function registerSiteTreeTransforms(transforms: TreeTransform[]) {
  siteTreeTransforms = transforms
}

export function getSiteTreeTransforms(): TreeTransform[] {
  return siteTreeTransforms
}
