import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * HeadingFold —— 文章正文标题折叠（前端侧方案 · 实验分支）
 * ----------------------------------------------------------------------------
 * 需求背景：
 *   Obsidian 里习惯折叠长文段落，但 Quartz 原生不支持标题折叠，
 *   且 Obsidian 的折叠状态存于工作区文件、不随 markdown 同步。
 *   本组件在前端给全站文章标题注入折叠能力，写作侧零改动。
 *
 * 实现方式（前端侧，非构建期转换）：
 *   DOM 就绪后扫描文章内容根内的**全部标题**（h1~h6，含列表项内的嵌套标题，
 *   如 `- ##### 子标题` 渲染出的 li > h5），排除文章主标题，
 *   把「标题之后到下一个同级/更高级标题」的兄弟节点包进 grid 动画外壳，
 *   并在标题前注入与「探索」一致的 chevron 箭头；点击标题切换折叠。
 *
 * 默认折叠级别：h3（章节分隔）与 h5（列表项内的子标题，如资料片介绍）。
 *
 * 边界与保护：
 *   - 排除 .article-title（文章主标题，折叠整篇无意义）
 *   - 排除 .popover（hover 预览浮窗里的 article 副本）
 *   - 排除 details 内部的标题（details 自带折叠，避免双重交互）
 *   - 兼容阅读模式：reader-mode 开启时正文被包进 article > .markdown-preview-view，
 *     标题不再是 article 直接子级 —— 动态探测内容根容器（contentRootOf）
 *   - 阅读模式切换（readermodechange）：插件可能复用也可能重建 DOM ——
 *     统一「先解包清标记、再重跑包装」，两种情况都得到干净结果；
 *     旧点击监听用 AbortController 统一摘除
 *   - 点击排除链接/按钮等交互元素；拖选文字后松开不触发折叠
 *   - 空范围（标题后无内容）不加箭头
 *
 * 折叠状态不持久化：刷新后全部展开（与 Obsidian 默认行为一致，试验版从简）。
 *
 * 嵌套规则：h2 的折叠范围包含 h3，h3 有自己的折叠范围 —— 天然嵌套，
 * 按文档顺序逐个处理（后处理的标题在先处理的 wrapper 内部仍有效）。
 */
const HeadingFold: QuartzComponentConstructor = () => {
  const HeadingFoldComponent: QuartzComponent = () => {
    // 纯脚本组件，无 DOM
    return null
  }

  HeadingFoldComponent.css = `
/* ============ 标题折叠（HeadingFold）============ */
article .hf-heading {
  cursor: pointer;
}
article .hf-heading > .hf-fold {
  width: 1em;
  height: 1em;
  margin-right: 0.45em;
  flex-shrink: 0;
  opacity: 0.55;
  vertical-align: -0.12em;
  transition: transform 0.3s ease, opacity 0.2s ease;
}
article .hf-heading:hover > .hf-fold {
  opacity: 1;
  color: var(--secondary, var(--dark));
}
/* 收起：箭头向右（与探索的折叠方向语言一致） */
article .hf-heading[aria-expanded="false"] > .hf-fold {
  transform: rotateZ(-90deg);
}
/* 折叠区外壳：grid-template-rows 0fr/1fr 高度动画（内容高度自适应） */
article .hf-body {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 0.3s ease, opacity 0.3s ease;
}
article .hf-body.collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
article .hf-body > .hf-inner {
  overflow: hidden;
  min-height: 0;
  transition: visibility 0s 0s;
}
/* 收起后延迟隐藏，避免内容在动画过程中瞬间消失；同时移出 tab 序列 */
article .hf-body.collapsed > .hf-inner {
  visibility: hidden;
  transition: visibility 0s 0.3s;
}

/* ============ 层级缩进（标题下方内容按层级缩进，与标题首字对齐）============
   缩进量 = 箭头宽(1em×标题字号) + 箭头右边距(0.45em×标题字号)，
   按主题各标题字号折算 rem；嵌套包裹结构使缩进逐级自然累加 */
article h1.hf-heading + .hf-body > .hf-inner {
  padding-left: 2.54rem; /* 1.45 × 1.75rem */
}
article h2.hf-heading + .hf-body > .hf-inner {
  padding-left: 2.03rem; /* 1.45 × 1.4rem */
}
article h3.hf-heading + .hf-body > .hf-inner {
  padding-left: 1.62rem; /* 1.45 × 1.12rem */
}
article :is(h4, h5, h6).hf-heading + .hf-body > .hf-inner {
  padding-left: 1.45rem; /* 1.45 × 1rem */
}

/* ============ 收紧标题间距 ============
   已移至 custom.scss 的 article 排版块（层外样式才能压过层内 custom 规则，
   组件 CSS 在 @layer 内会被 custom.scss 的 margin-top: 2rem 无条件覆盖） */
`

  HeadingFoldComponent.afterDOMLoaded = `
(function () {
  var LEVEL_RE = /^H[1-6]$/;
  var controllers = new WeakMap(); // article -> AbortController（摘除旧点击监听）

  function levelOf(el) {
    return parseInt(el.tagName[1], 10);
  }

  // 与「探索」一致的 chevron（polyline 6 9 12 15 18 9）
  var CHEVRON_HTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'class="hf-fold" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function makeChevron() {
    return document.createRange().createContextualFragment(CHEVRON_HTML).firstChild;
  }

  // 内容根容器：阅读模式开启时正文包在 .markdown-preview-view 里，
  // 关闭时标题是 article 直接子级 —— 两种形态都从「根容器的直接子级」找标题
  function contentRootOf(article) {
    return article.querySelector(":scope > .markdown-preview-view") || article;
  }

  // 解包一个内容根容器里的全部折叠结构（从内层到外层），恢复原始 DOM
  function unwrapAll(root) {
    var bodies = root.querySelectorAll(".hf-body");
    for (var i = bodies.length - 1; i >= 0; i--) {
      var body = bodies[i];
      var inner = body.querySelector(":scope > .hf-inner");
      var heading = body.previousElementSibling;
      if (inner) {
        while (inner.firstChild) body.parentNode.insertBefore(inner.firstChild, body);
      }
      body.remove();
      if (heading && heading.classList.contains("hf-heading")) {
        var chev = heading.querySelector(":scope > .hf-fold");
        if (chev) chev.remove();
        heading.classList.remove("hf-heading");
        heading.removeAttribute("aria-expanded");
        heading.removeAttribute("data-hf-done");
      }
    }
    root.removeAttribute("data-hf-bound");
  }

  function setup() {
    var articles = document.querySelectorAll("article");
    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];

      // hover 预览浮窗里的 article 副本不处理
      if (article.closest(".popover")) continue;

      var root = contentRootOf(article);
      // 幂等：SPA 换页是新 DOM；同页重复触发靠标记拦截
      if (root.dataset.hfBound === "1") continue;
      root.dataset.hfBound = "1";

      var ctl = new AbortController();
      controllers.set(article, ctl);
      var signal = ctl.signal;

      // 文章内全部标题（含列表项内的嵌套标题，如 li 内的 h5）——
      // 折叠范围用 nextElementSibling 收集，嵌套标题自然只影响其所在容器内的兄弟节点
      var headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");

      for (var j = 0; j < headings.length; j++) {
        var h = headings[j];
        if (h.classList.contains("article-title")) continue;   // 文章主标题不折叠
        if (h.closest("details")) continue;                    // details 自带折叠
        if (h.dataset.hfDone === "1") continue;
        h.dataset.hfDone = "1";

        var lv = levelOf(h);

        // 收集折叠范围：标题之后，直到下一个同级或更高级标题
        var range = [];
        var sib = h.nextElementSibling;
        while (sib) {
          if (LEVEL_RE.test(sib.tagName) && levelOf(sib) <= lv) break;
          range.push(sib);
          sib = sib.nextElementSibling;
        }
        if (range.length === 0) continue; // 标题后没有内容，不加折叠

        // 包一层 grid 动画外壳（wrapper + inner 双层，见 CSS）
        var body = document.createElement("div");
        body.className = "hf-body";
        var inner = document.createElement("div");
        inner.className = "hf-inner";
        for (var k = 0; k < range.length; k++) inner.appendChild(range[k]);
        body.appendChild(inner);
        h.after(body); // range 节点已被移走，正好插在标题后面

        // 标题注入箭头 + 可访问性状态
        h.classList.add("hf-heading");
        var chev = makeChevron();
        if (chev) h.insertBefore(chev, h.firstChild);

        // 默认折叠：h3（主要章节分隔，折叠收益最大）与
        // h5（多出现在列表项内作子标题，如各资料片介绍，默认收起便于扫读）
        var collapsedByDefault = lv === 3 || lv === 5;
        h.setAttribute("aria-expanded", collapsedByDefault ? "false" : "true");
        if (collapsedByDefault) body.classList.add("collapsed");

        // 整行可点：排除链接等交互元素；拖选文字松开不触发
        h.addEventListener(
          "click",
          function (e) {
            var headingEl = e.currentTarget;
            var bodyEl = headingEl.nextElementSibling;
            if (!bodyEl || !bodyEl.classList.contains("hf-body")) return;
            if (e.target.closest("a, button, input, textarea, select, summary")) return;
            var sel = window.getSelection();
            if (sel && sel.toString().length > 0) return;

            var collapsed = bodyEl.classList.toggle("collapsed");
            headingEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
          },
          { signal: signal }
        );
      }
    }
  }

  function setupSoon() {
    setTimeout(setup, 0);
  }

  // 阅读模式开关：插件重组正文 DOM —— 先解包旧结构（若复用节点）再重包
  function onReaderModeChange() {
    var articles = document.querySelectorAll("article");
    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];
      if (article.closest(".popover")) continue;
      var ctl = controllers.get(article);
      if (ctl) ctl.abort(); // 摘掉旧监听（若节点被复用）
      var root = contentRootOf(article);
      if (root.dataset.hfBound === "1") unwrapAll(root);
    }
    setupSoon();
  }

  // reader-mode 插件的监听器可能晚于本脚本注册，统一延迟一拍更稳；
  // nav（SPA 换页）、render、readermodechange（阅读模式开关）都重跑。
  setupSoon();
  document.addEventListener("nav", setupSoon);
  document.addEventListener("render", setupSoon);
  document.addEventListener("readermodechange", function () {
    setTimeout(onReaderModeChange, 0);
  });
})();
`

  return HeadingFoldComponent
}

export default HeadingFold
