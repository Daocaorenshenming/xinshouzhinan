import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * 阅读模式默认值控制（无 DOM 输出，仅注入脚本）
 *
 * 背景：
 *   社区插件 @quartz-community/reader-mode 给 <html> 设 `reader-mode="on"/"off"`。
 *   它的内部状态变量 t 初始为 false（自然状态 = off），且在 SPA 导航（nav/render）
 *   时会用「t?"on":"off"」重写属性 —— 也就是说**属性永远由插件内部状态决定**。
 *
 * ⚠️ 为什么不能直接 setAttribute("reader-mode","on")：
 *   那会让属性与插件内部 t 脱节 —— 用户第一次点击时插件把 t 翻成 true、
 *   属性设回 "on"，看起来「点了没反应」，第二次点击才真正变化（实测踩坑）。
 *
 * 正确做法：**模拟点击按钮**让插件自己翻转到 on。
 *   - 插件内部 t:false→true、属性 off→on、发布 readermodechange —— 三者同步；
 *   - SPA 导航时插件重写属性仍得到 "on"，状态永不脱节；
 *   - 用户之后的每次点击都是正常的「当前值取反」。
 *
 * 用户偏好优先级：localStorage("readerMode") > 默认开启。
 * 模拟点击派发的 readermodechange 会被 syncing 标志拦下，不会把默认值
 * 伪造成用户选择写进 localStorage。
 */
const STORAGE_KEY = "readerMode"

const ReaderModeDefault: QuartzComponentConstructor = (opts: { enabled?: boolean } = {}) => {
  const defaultEnabled = opts.enabled ?? true

  const ReaderModeDefaultComponent: QuartzComponent = () => {
    // 纯脚本组件，无 DOM
    return null
  }

  ReaderModeDefaultComponent.afterDOMLoaded = `
    (function() {
      var DEFAULT_ON = ${defaultEnabled ? "true" : "false"};
      var KEY = ${JSON.stringify(STORAGE_KEY)};
      var syncing = false;   // 正在用模拟点击同步默认值（拦住持久化）

      function desiredOn() {
        try {
          var s = localStorage.getItem(KEY);
          return s === null ? DEFAULT_ON : s === "on";
        } catch (e) { return DEFAULT_ON; }
      }

      // 让「属性 + 插件内部状态」与期望值一致。
      // 插件自然状态是 off，因此只在「期望 on 且当前不是 on」时模拟一次点击。
      // 通过检查属性而非盲目点击，重复调用（nav/render/load 多次触发）天然幂等。
      function sync() {
        if (desiredOn() && document.documentElement.getAttribute("reader-mode") !== "on") {
          var btn = document.querySelector(".readermode");
          if (btn) {
            syncing = true;
            btn.click();
            // 微任务结束后解除拦截（事件监听是同步派发的）
            Promise.resolve().then(function() { syncing = false; });
          }
        }
      }

      // 插件的按钮监听器在 nav/render 事件里注册，可能晚于本脚本执行；
      // 在这几个时机各尝试一次，靠属性检查保证幂等。
      function syncSoon() { setTimeout(sync, 0); }
      syncSoon();
      document.addEventListener("nav", syncSoon);
      document.addEventListener("render", syncSoon);
      window.addEventListener("load", syncSoon);

      // 持久化用户手动切换（跳过我们自己模拟点击产生的事件）
      document.addEventListener("readermodechange", function(ev) {
        if (syncing) return;
        if (ev && ev.detail && ev.detail.mode) {
          try { localStorage.setItem(KEY, ev.detail.mode); } catch (e) {}
        }
      });
    })();
  `

  return ReaderModeDefaultComponent
}

export default ReaderModeDefault
