import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * ImageLightbox —— 文章图片点击全屏放大（自研轻量灯箱）
 * ----------------------------------------------------------------------------
 * 需求（2026-09-30 定稿方案 A）：
 *   1. 点击正文图片 → 全屏放大查看
 *   2. 多图浏览：同一篇文章内的图片串成一个序列，可左右切换
 *   3. 关闭方式全保留：点击遮罩 / ESC / 滚动 / 移动端下滑
 *   4. 暂不做缩放（pinch/滚轮缩放）
 *
 * 设计要点：
 *   - 零依赖、零 CDN：不引任何第三方库，国内可达性无风险
 *   - DOM 挂在 document.body 直属（不在 #quartz-body 内）：SPA 换页时
 *     Quartz 只替换 #quartz-body 内容，灯箱外壳不会被销毁、状态不丢
 *   - 事件委托绑在 document（捕获阶段）：一次绑定长期有效，
 *     与 HeadingFold 的「每次 nav 重扫」不同 —— 灯箱天然与页面 DOM 解耦
 *   - 图片序列在「打开瞬间」按当前可见性实时收集：被折叠（h3/h5 收起）的
 *     图片宽高为 0 会被自动排除，展开后再点即正常入列
 *   - 全局单例守卫（window.__imgLightbox）：afterDOMLoaded 每次导航都会重跑，
 *     后续执行只做「外壳存在性兜底 + 光标标记」，不重复绑定
 *   - 图片若包在 <a> 里：仅当链接指向图片本身（扩展名/FlowUs）才接管，
 *     指向其它页面的链接保持原跳转行为，不抢语义
 *
 * 手势（移动端）：
 *   - 竖直下滑超过 90px → 关闭（拖动过程图片跟手、遮罩渐隐）
 *   - 水平滑动超过 60px → 上一张/下一张
 *   - touchmove 用非 passive 监听并 preventDefault，避免触发页面滚动
 */
const IconX =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
const IconLeft =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>'
const IconRight =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>'

const ImageLightbox: QuartzComponentConstructor = () => {
  const ImageLightboxComponent: QuartzComponent = () => {
    // 纯脚本组件：灯箱外壳由脚本在首次加载时创建并挂到 body
    return null
  }

  const ICONS = { x: IconX, left: IconLeft, right: IconRight }

  ImageLightboxComponent.css = `
/* ============ 图片灯箱（ImageLightbox）============ */
article img[data-lb="1"] {
  cursor: zoom-in;
}

.lb-root {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(22, 20, 18, 0.92);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0s linear 0.2s;
  font-family: var(--bodyFont);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.lb-root.lb-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 0.2s ease, visibility 0s linear 0s;
}

.lb-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100vw;
  max-height: 100vh;
  box-sizing: border-box;
  padding: 2.75rem;
  transition: transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.24s ease;
  will-change: transform;
}

.lb-img {
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100vw - 6rem);
  max-height: calc(100vh - 6rem);
  border-radius: 10px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
  background: var(--light);
  transition: opacity 0.18s ease;
}
.lb-img.lb-loading {
  opacity: 0.3;
}

.lb-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}
.lb-btn svg {
  width: 22px;
  height: 22px;
}
.lb-btn:hover {
  background: rgba(255, 255, 255, 0.26);
}
.lb-btn:focus-visible {
  outline: 2px solid var(--secondary);
  outline-offset: 2px;
}
.lb-btn[disabled] {
  opacity: 0.25;
  cursor: default;
}
.lb-btn[disabled]:hover {
  background: rgba(255, 255, 255, 0.14);
}
.lb-close {
  top: 1rem;
  right: 1rem;
}
.lb-prev {
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
}
.lb-next {
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
}
.lb-prev:not([disabled]):hover {
  transform: translateY(-50%) scale(1.06);
}
.lb-next:not([disabled]):hover {
  transform: translateY(-50%) scale(1.06);
}

.lb-counter {
  position: absolute;
  left: 50%;
  bottom: 1.05rem;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.lb-caption {
  position: absolute;
  left: 50%;
  bottom: 2.5rem;
  transform: translateX(-50%);
  max-width: min(80vw, 60ch);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
}
.lb-counter[hidden],
.lb-caption[hidden],
.lb-btn[hidden] {
  display: none !important;
}

@media all and (max-width: 800px) {
  .lb-stage {
    padding: 1rem;
  }
  .lb-img {
    max-width: calc(100vw - 1.5rem);
    max-height: calc(100vh - 8rem);
    border-radius: 8px;
  }
  .lb-btn {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.18);
  }
  .lb-close {
    top: 0.6rem;
    right: 0.6rem;
  }
  .lb-prev {
    left: 0.4rem;
  }
  .lb-next {
    right: 0.4rem;
  }
}
`

  ImageLightboxComponent.afterDOMLoaded = `
(function () {
  var KEY = "__imgLightbox";
  var prev = window[KEY];
  if (prev && prev.ensure) {
    prev.ensure();
    return;
  }

  var LB_ID = "img-lightbox";
  var ICON_X = '${ICONS.x}';
  var ICON_L = '${ICONS.left}';
  var ICON_R = '${ICONS.right}';
  var MIN_SIZE = 80;      // 小于此边长的图片视作图标，不参与放大
  var SCROLL_CLOSE = 60;  // 滚动超过该位移即关闭
  var SWIPE_CLOSE = 90;   // 下滑超过该位移即关闭
  var SWIPE_SWITCH = 60;  // 横滑超过该位移即翻页

  var root = null, stage = null, imgEl = null, counterEl = null, captionEl = null;
  var closeBtn = null, prevBtn = null, nextBtn = null;

  var items = [], idx = 0, isOpen = false, lastFocus = null, openY = 0;
  var tx = 0, ty = 0, dx = 0, dy = 0, dragging = false;

  function build() {
    root = document.createElement("div");
    root.id = LB_ID;
    root.className = "lb-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "图片查看器");
    root.innerHTML =
      '<div class="lb-stage"><img class="lb-img" alt=""></div>' +
      '<button type="button" class="lb-btn lb-close" aria-label="关闭">' + ICON_X + '</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="上一张">' + ICON_L + '</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="下一张">' + ICON_R + '</button>' +
      '<div class="lb-caption" hidden></div>' +
      '<div class="lb-counter" hidden></div>';
    document.body.appendChild(root);

    stage = root.querySelector(".lb-stage");
    imgEl = root.querySelector(".lb-img");
    counterEl = root.querySelector(".lb-counter");
    captionEl = root.querySelector(".lb-caption");
    closeBtn = root.querySelector(".lb-close");
    prevBtn = root.querySelector(".lb-prev");
    nextBtn = root.querySelector(".lb-next");

    imgEl.addEventListener("load", function () { imgEl.classList.remove("lb-loading") });
    imgEl.addEventListener("error", function () { imgEl.classList.remove("lb-loading") });

    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); close() });
    prevBtn.addEventListener("click", function (e) { e.stopPropagation(); go(-1) });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); go(1) });

    // 点击图片/按钮以外区域（遮罩、stage 空白）关闭
    root.addEventListener("click", function (e) {
      if (!isOpen) return;
      if (e.target.closest(".lb-img") || e.target.closest(".lb-btn")) return;
      close();
    });

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);
  }

  // ---------- 图片收集 ----------

  function eligible(im) {
    if (!im || im.tagName !== "IMG") return false;
    if (im.dataset.noLightbox === "1") return false;
    if (im.closest(".popover")) return false;
    if (im.closest("#" + LB_ID)) return false;
    var src = im.currentSrc || im.getAttribute("src");
    if (!src) return false;
    var r = im.getBoundingClientRect();
    // 宽高任一不足即排除：小图标（双向过小）与折叠区内的图
    // （hf-body 收起时高度塌陷为 0，如 306x0）都不进序列，
    // 保证「多图序列 = 点击瞬间实际可见的图」，展开折叠后点击会重新收集
    if (r.width < MIN_SIZE || r.height < MIN_SIZE) return false;
    return true;
  }

  function collect(article) {
    var out = [];
    var imgs = article.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      if (eligible(imgs[i])) out.push(imgs[i]);
    }
    return out;
  }

  // 给可放大图片打标记（仅为 cursor: zoom-in 提示；核心逻辑点击时实时判断）
  function mark() {
    var arts = document.querySelectorAll("article");
    for (var i = 0; i < arts.length; i++) {
      if (arts[i].closest(".popover")) continue;
      var imgs = arts[i].querySelectorAll("img");
      for (var j = 0; j < imgs.length; j++) {
        var im = imgs[j];
        if (im.dataset.lbMark === "1") continue;
        if (eligible(im)) {
          im.dataset.lbMark = "1";
          im.setAttribute("data-lb", "1");
        }
      }
    }
  }

  // ---------- 打开 / 渲染 / 切换 / 关闭 ----------

  function preload(i) {
    var im = items[i];
    if (!im) return;
    var src = im.currentSrc || im.getAttribute("src");
    if (!src) return;
    var p = new Image();
    p.src = src;
  }

  function render() {
    var im = items[idx];
    if (!im) return;
    var src = im.currentSrc || im.getAttribute("src");
    if (imgEl.getAttribute("src") !== src) {
      imgEl.classList.add("lb-loading");
      imgEl.setAttribute("src", src);
    }
    var cap = (im.getAttribute("alt") || "").trim();
    imgEl.setAttribute("alt", cap);
    captionEl.textContent = cap;
    captionEl.hidden = !cap;
    counterEl.textContent = idx + 1 + " / " + items.length;
    counterEl.hidden = items.length < 2;

    var multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === items.length - 1;

    stage.style.transform = "";
    stage.style.opacity = "";
    preload(idx - 1);
    preload(idx + 1);
  }

  function open(list, index) {
    items = list;
    idx = index;
    lastFocus = document.activeElement;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    openY = y;
    isOpen = true;
    root.classList.add("lb-open");
    render();
    try {
      closeBtn.focus({ preventScroll: true });
    } catch (err) {
      closeBtn.focus();
    }
  }

  function go(step) {
    var n = idx + step;
    if (n < 0 || n >= items.length) return;
    idx = n;
    render();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove("lb-open");
    stage.style.transform = "";
    stage.style.opacity = "";
    root.style.backgroundColor = "";
    dragging = false;
    dx = dy = 0;
    if (lastFocus && lastFocus.focus) {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (err) {
        /* 忽略 */
      }
    }
    lastFocus = null;
  }

  // ---------- 交互 ----------

  function onClick(e) {
    if (isOpen) return;
    var t = e.target;
    if (!t || t.tagName !== "IMG") return;
    var article = t.closest("article");
    if (!article) return;
    if (!eligible(t)) return;

    // 包在链接里的图片：只在链接指向图片本身时接管，其余保留跳转行为
    var a = t.closest("a");
    if (a) {
      var href = a.getAttribute("href") || "";
      var selfLink =
        href === "" ||
        href.charAt(0) === "#" ||
        /\\.(png|jpe?g|gif|webp|avif|svg|bmp)(\\?|#|$)/i.test(href) ||
        /flowus\\.cn/i.test(href);
      if (!selfLink) return;
      e.preventDefault();
      e.stopPropagation();
    }

    var list = collect(article);
    if (!list.length) return;
    var i = list.indexOf(t);
    if (i < 0) {
      list.push(t);
      i = list.length - 1;
    }
    open(list, i);
  }

  function onKey(e) {
    if (!isOpen) return;
    var k = e.key;
    if (k === "Escape" || k === "Esc") {
      e.preventDefault();
      close();
    } else if (k === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  }

  function onScroll() {
    if (!isOpen) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (Math.abs(y - openY) > SCROLL_CLOSE) close();
  }

  function onTouchStart(e) {
    if (!isOpen || e.touches.length !== 1) return;
    if (e.target.closest(".lb-btn")) return;
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    dx = dy = 0;
    dragging = true;
    stage.style.transition = "none";
  }

  function onTouchMove(e) {
    if (!dragging || e.touches.length !== 1) return;
    dx = e.touches[0].clientX - tx;
    dy = e.touches[0].clientY - ty;
    e.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) {
      stage.style.transform = "translateX(" + dx + "px)";
      stage.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 520));
      root.style.backgroundColor = "";
    } else {
      var vy = dy < 0 ? dy * 0.25 : dy; // 上滑阻尼
      stage.style.transform = "translateY(" + vy + "px)";
      stage.style.opacity = String(Math.max(0.3, 1 - Math.abs(vy) / 420));
      var alpha = Math.max(0.35, 0.92 - Math.abs(vy) / 700);
      root.style.backgroundColor = "rgba(22, 20, 18, " + alpha + ")";
    }
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    stage.style.transition = "";
    stage.style.transform = "";
    stage.style.opacity = "";
    root.style.backgroundColor = "";
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx <= -SWIPE_SWITCH) go(1);
      else if (dx >= SWIPE_SWITCH) go(-1);
    } else if (dy >= SWIPE_CLOSE) {
      close();
      return;
    }
    dx = dy = 0;
  }

  function onNav() {
    if (isOpen) close();
    // SPA 换页会替换 body 内容，灯箱外壳随之被清 ——
    // 但 document 上的监听器不会消失，nav 时用 ensure 重建外壳并重打光标标记
    setTimeout(ensure, 0);
  }

  function ensure() {
    if (!root || !document.body.contains(root)) {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      build();
    }
    mark();
  }

  // ---------- 初始化 ----------

  build();
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("nav", onNav);
  document.addEventListener("render", onNav);
  document.addEventListener("readermodechange", onNav);
  setTimeout(mark, 300);
  setTimeout(mark, 1500);

  window[KEY] = { ensure: ensure, close: close };
})();
`

  return ImageLightboxComponent
}

export default ImageLightbox
