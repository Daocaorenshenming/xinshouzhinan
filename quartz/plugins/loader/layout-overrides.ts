/**
 * 自定义布局注入点
 *
 * 在 quartz.ts 中导入本模块并调用 registerLayoutOverrides，
 * loadQuartzConfig 内部构造 PageTypeDispatcher 时会读取这些 overrides，
 * 使自定义组件进入真实的页面渲染布局。
 */
import type { FullPageLayout } from "../cfg"

type LayoutOverrides = {
  defaults?: Partial<FullPageLayout>
  byPageType?: Record<string, Partial<FullPageLayout>>
}

let overrides: LayoutOverrides = {}

export function registerLayoutOverrides(o: LayoutOverrides) {
  overrides = o
}

export function getLayoutOverrides(): LayoutOverrides {
  return overrides
}
