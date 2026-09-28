/**
 * 自定义布局注入点
 *
 * 在 quartz.ts 中导入本模块并调用 registerLayoutOverrides，
 * loadQuartzConfig 内部构造 PageTypeDispatcher 时会读取这些 overrides，
 * 使自定义组件进入真实的页面渲染布局。
 *
 * 注意：quartz.ts 的 `export default config` 并不会被使用 —— 它只是作为
 * 副作用模块被打包（用于触发本模块的注册）。真正的布局由 config-loader
 * 读取 quartz.config.yaml 后构造，因此所有定制都必须走这里的 overrides。
 */
import type { FullPageLayout } from "../cfg"
import type { QuartzComponent } from "../../components/types"

/**
 * 布局覆写。
 *
 * - defaults：追加到所有页面类型的对应插槽（与 YAML 中已有组件合并，不替换）
 * - left/right/header 的「精确覆写」放在 byPageType 里
 * - prependLeft / appendLeft 等：只对指定插槽做前置 / 后置插入，
 *   绕过 config.yaml 生成空数组导致的遮蔽问题
 */
type LayoutOverrides = {
  defaults?: Partial<FullPageLayout>
  byPageType?: Record<string, Partial<FullPageLayout>>
  /** 追加到每个页面类型的 left 插槽（与 defaults 合并语义一致） */
  appendLeft?: QuartzComponent[]
  /** 追加到每个页面类型的 header 插槽 */
  appendHeader?: QuartzComponent[]
  /** 追加到每个页面类型的 right 插槽 */
  appendRight?: QuartzComponent[]
  /** 插入到每个页面类型的 left 插槽最前面（优先于探索、搜索） */
  prependLeft?: QuartzComponent[]
  /** 插入到每个页面类型的 header 插槽最前面 */
  prependHeader?: QuartzComponent[]
}

let overrides: LayoutOverrides = {}

export function registerLayoutOverrides(o: LayoutOverrides) {
  overrides = o
}

export function getLayoutOverrides(): LayoutOverrides {
  return overrides
}
