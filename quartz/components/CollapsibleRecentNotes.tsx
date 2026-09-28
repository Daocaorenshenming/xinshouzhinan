import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { RecentNotes } from "@quartz-community/recent-notes"
import type { ComponentChildren } from "preact"

/**
 * 可折叠的「最近的笔记」
 * ----------------------------------------------------------------------------
 * 包一层「探索」同款折叠外壳（见 @quartz-community/explorer 的结构）：
 *
 *   <div class="recent-notes collapsible collapsed">
 *     <button class="recent-notes-toggle" aria-expanded="false">
 *       <h3>最近的笔记</h3>
 *       <svg class="fold">…</svg>      ← 与探索一致的 chevron
 *     </button>
 *     <div class="recent-notes-content">  ← 折叠区
 *       …由官方 RecentNotes 渲染的列表…
 *     </div>
 *   </div>
 *
 * 为什么不用官方 RecentNotes 直接加 CSS：
 *   官方组件把标题固定渲染成 <h3>，没有按钮 / 折叠容器，
 *   无法承载点击展开逻辑，故必须自建外壳，只复用它的列表数据渲染。
 *
 * 折叠状态持久化：与探索一样存 localStorage（key: recentNotesCollapsed），
 * 切页后保持用户上次的展开/收起选择。
 */

const STORAGE_KEY = "recentNotesCollapsed"

export type CollapsibleRecentNotesOptions = {
  /** 标题文案，默认「最近的笔记」 */
  title?: string
  /** 默认是否折叠，默认 true（与探索的 folderDefaultState: collapsed 一致） */
  collapsed?: boolean
  /** 透传给官方 RecentNotes 的选项（limit / showTags / linkToMore 等） */
  recentNotesOptions?: Record<string, unknown>
}

const defaultOptions: CollapsibleRecentNotesOptions = {
  title: "最近的笔记",
  collapsed: true,
}

const CollapsibleRecentNotes: QuartzComponent = (props: QuartzComponentProps) => {
  const { displayClass } = props
  const opts: CollapsibleRecentNotesOptions = {
    ...defaultOptions,
    ...((props as QuartzComponentProps & { opts?: CollapsibleRecentNotesOptions }).opts ?? {}),
  }

  // 官方组件实例：只负责渲染列表内容
  const Inner = RecentNotes(opts.recentNotesOptions ?? {})

  return (
    <div
      class={classNames(displayClass, "recent-notes", "collapsible", "collapsed")}
      data-default-collapsed={opts.collapsed ? "true" : "false"}
    >
      <button
        type="button"
        class="recent-notes-toggle"
        aria-expanded="false"
        aria-controls="recent-notes-content"
      >
        <h3>{opts.title ?? "最近的笔记"}</h3>
        {/* 与探索完全一致的 chevron（polyline 6 9 12 15 18 9） */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="fold"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="recent-notes-content" id="recent-notes-content">
        {/* 直接调用组件函数渲染；QuartzComponent 的返回类型被声明为 unknown，
            这里显式断言成可渲染节点（Quartz 自身用 esbuild 构建，不做类型检查） */}
        {Inner(props) as ComponentChildren}
      </div>
    </div>
  )
}

CollapsibleRecentNotes.css = `
/* 骨架样式；细化样式统一在 styles/custom.scss 维护 */
.recent-notes.collapsible {
  display: flex;
  flex-direction: column;
}
.recent-notes.collapsible > .recent-notes-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--dark);
}
.recent-notes.collapsible > .recent-notes-toggle > h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--dark);
}
.recent-notes.collapsible > .recent-notes-toggle > .fold {
  margin-left: 0.5rem;
  opacity: 0.8;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}
.recent-notes.collapsible.collapsed > .recent-notes-toggle > .fold {
  transform: rotateZ(-90deg);
}
.recent-notes.collapsible > .recent-notes-content {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease;
}
.recent-notes.collapsible.collapsed > .recent-notes-content {
  max-height: 0;
  opacity: 0;
}
`

CollapsibleRecentNotes.afterDOMLoaded = `
(function () {
  const STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};

  function readCollapsed() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      return raw === "true";
    } catch (e) {
      return null;
    }
  }

  function writeCollapsed(v) {
    try {
      localStorage.setItem(STORAGE_KEY, v ? "true" : "false");
    } catch (e) {}
  }

  function setup() {
    const nodes = document.querySelectorAll(".recent-notes.collapsible");
    const cleanupFns = [];

    for (const root of nodes) {
      // 幂等：避免 SPA 重复导航时重复绑定
      if (root.dataset.rnBound === "1") continue;
      root.dataset.rnBound = "1";

      const toggle = root.querySelector(".recent-notes-toggle");
      if (!toggle) continue;

      // 初始状态：优先用 localStorage，其次用 data-default-collapsed
      const stored = readCollapsed();
      const fallback = root.dataset.defaultCollapsed === "true";
      const initial = stored === null ? fallback : stored;

      const apply = (collapsed) => {
        root.classList.toggle("collapsed", collapsed);
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      };

      apply(initial);

      const onClick = (e) => {
        e.preventDefault();
        const next = !root.classList.contains("collapsed");
        apply(next);
        writeCollapsed(next);
      };

      toggle.addEventListener("click", onClick);
      cleanupFns.push(() => {
        toggle.removeEventListener("click", onClick);
        root.dataset.rnBound = "";
      });
    }

    if (cleanupFns.length > 0 && typeof window.addCleanup === "function") {
      window.addCleanup(() => cleanupFns.forEach((fn) => fn()));
    }
  }

  // 首屏 + SPA 导航后都要重新绑定（SPA 会替换 DOM）
  document.addEventListener("nav", setup);
  setup();
})();
`

export default ((opts?: CollapsibleRecentNotesOptions) => {
  const cmp: QuartzComponent = (props: QuartzComponentProps) =>
    CollapsibleRecentNotes({ ...props, opts } as QuartzComponentProps)
  cmp.css = CollapsibleRecentNotes.css
  cmp.afterDOMLoaded = CollapsibleRecentNotes.afterDOMLoaded
  return cmp
}) satisfies QuartzComponentConstructor<CollapsibleRecentNotesOptions>
