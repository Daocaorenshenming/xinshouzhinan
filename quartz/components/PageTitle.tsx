import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { pathToRoot } from "../util/path"
import { classNames } from "../util/lang"

/**
 * 自定义站点标题组件（替代 @quartz-community/page-title）。
 *
 * 与官方实现的区别：支持通过 options.title 覆盖显示文本。
 * 传入 title 时显示自定义文案（如「导航」），不传则沿用 configuration.pageTitle
 * 作为默认值，因此替换后行为与官方组件保持一致。
 */
const PageTitle: QuartzComponent = ({
  fileData,
  cfg,
  displayClass,
  opts,
}: QuartzComponentProps & { opts?: { title?: string } }) => {
  const baseDir = pathToRoot(fileData.slug!)
  const title = opts?.title ?? cfg.pageTitle
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>{title}</a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
`

export default ((opts?: { title?: string }) => {
  const cmp: QuartzComponent = (props: QuartzComponentProps) => PageTitle({ ...props, opts })
  cmp.css = PageTitle.css
  return cmp
}) satisfies QuartzComponentConstructor<{ title?: string }>
