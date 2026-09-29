import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export interface BgmTrack {
  title: string
  src: string
}

interface MusicPlayerOptions {
  tracks?: BgmTrack[]
}

// 背景音乐播放器（左下角悬浮按钮 + 展开卡片）
//
// 设计要点：
//   1. 位置与右下角的 AiChat 对称：锚定正文列左边缘内侧（>=1200px 双侧栏时），
//      平板/移动端贴视口左下角。与 aiChat.scss 的定位算式镜像。
//   2. SPA 不断播：audio 用 window.__bgm 全局单例（不插入 DOM，页面替换不影响播放）；
//      Quartz 导航后 afterDOMLoaded 重新执行，只重绑新 DOM 的 UI，并恢复播放状态。
//   3. 状态记忆：localStorage 存音量/循环/曲目/进度/是否开启；下次进站若上次开着
//      会尝试自动恢复（被浏览器自动播放策略拦截时静默降级为暂停态，点一下即续播）。
//   4. 样式全部使用站点主题变量（--light/--dark/--secondary/...），深浅色自动适配。
const css = `
.bgm-player{position:fixed;left:var(--bgm-left,1.5rem);bottom:var(--bgm-bottom,1.5rem);z-index:999;font-family:var(--bodyFont)}
@media all and (min-width:1200px){.bgm-player{--bgm-left:calc(320px + 0.5rem + 1.5rem)}}
@media all and (max-width:800px){.bgm-player{--bgm-left:1rem;--bgm-bottom:1rem}}
.bgm-player[hidden],.bgm-player [hidden]{display:none!important}
.bgm-toggle{width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--secondary),var(--tertiary));color:#fff;border:none;border-radius:50%;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:transform 0.18s ease,box-shadow 0.18s ease;padding:0}
.bgm-toggle:hover{transform:translateY(-2px);box-shadow:0 6px 22px rgba(0,0,0,0.24)}
.bgm-toggle:active{transform:translateY(0)}
.bgm-toggle .bgm-eq{display:none;align-items:flex-end;gap:3px;height:18px}
.bgm-player.is-playing .bgm-toggle .bgm-eq{display:flex}
.bgm-player.is-playing .bgm-toggle .bgm-icon-note{display:none}
.bgm-toggle .bgm-eq i{width:3px;border-radius:2px;background:#fff;transform-origin:bottom;animation:bgm-eq 1s infinite ease-in-out}
.bgm-toggle .bgm-eq i:nth-child(1){height:9px}
.bgm-toggle .bgm-eq i:nth-child(2){height:15px;animation-delay:0.18s}
.bgm-toggle .bgm-eq i:nth-child(3){height:11px;animation-delay:0.36s}
@keyframes bgm-eq{0%,100%{transform:scaleY(0.4);opacity:0.75}50%{transform:scaleY(1);opacity:1}}
.bgm-card{position:absolute;left:0;bottom:60px;width:272px;max-width:calc(100vw - 2rem);background:var(--light);border:1px solid var(--lightgray);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.22);padding:0.85rem 0.95rem 0.8rem;animation:bgm-fade-in 0.2s ease}
@keyframes bgm-fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bgm-head{display:flex;align-items:center;gap:0.5rem}
.bgm-title{flex:1;min-width:0;font-size:0.9rem;font-weight:600;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bgm-loop{background:none;border:none;color:var(--gray);cursor:pointer;padding:2px;display:flex;flex-shrink:0}
.bgm-loop:hover{color:var(--dark)}
.bgm-loop.is-on{color:var(--secondary)}
.bgm-seek{width:100%;margin:0.65rem 0 0;accent-color:var(--secondary)}
.bgm-time{display:flex;justify-content:space-between;font-size:0.72rem;color:var(--gray);margin-top:3px;font-variant-numeric:tabular-nums}
.bgm-controls{display:flex;align-items:center;gap:0.55rem;margin-top:0.55rem}
.bgm-play{width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--secondary),var(--tertiary));color:#fff;border:none;border-radius:50%;cursor:pointer;transition:opacity 0.15s ease;padding:0}
.bgm-play:hover{opacity:0.88}
.bgm-mute{background:none;border:none;color:var(--gray);cursor:pointer;padding:2px;display:flex;flex-shrink:0}
.bgm-mute:hover{color:var(--dark)}
.bgm-volume{flex:1;min-width:0;accent-color:var(--secondary);margin:0}
.bgm-list{margin:0.6rem -0.25rem 0;border-top:1px solid var(--lightgray);padding-top:0.4rem;max-height:150px;overflow-y:auto}
.bgm-list[hidden]{display:none}
.bgm-list-item{display:block;width:100%;background:none;border:none;text-align:left;font-size:0.8rem;color:var(--darkgray);padding:0.3rem 0.45rem;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit}
.bgm-list-item:hover{background:var(--lightgray)}
.bgm-list-item.is-current{color:var(--secondary);font-weight:600}
.bgm-error{display:none;margin-top:0.5rem;font-size:0.75rem;color:#dc2626}
.bgm-player.has-error .bgm-error{display:block}
`

const MusicPlayer: QuartzComponentConstructor = (opts: MusicPlayerOptions = {}) => {
  const tracks: BgmTrack[] = opts.tracks ?? []

  const MusicPlayerComponent: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    void fileData
    return (
      <div class="bgm-player" id="bgm-player" hidden={tracks.length === 0}>
        <div class="bgm-card" id="bgm-card" hidden>
          <div class="bgm-head">
            <div class="bgm-title" id="bgm-title">
              {tracks[0]?.title ?? ""}
            </div>
            <button class="bgm-loop" id="bgm-loop" aria-label="单曲循环开关" title="单曲循环：开">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 2l4 4-4 4" />
                <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="M7 22l-4-4 4-4" />
                <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                <line id="bgm-loop-off-line" x1="4" y1="20" x2="20" y2="4" hidden />
              </svg>
            </button>
          </div>

          <input
            class="bgm-seek"
            id="bgm-seek"
            type="range"
            min="0"
            max="100"
            step="0.1"
            defaultValue={0}
            aria-label="播放进度"
          />
          <div class="bgm-time">
            <span id="bgm-cur">0:00</span>
            <span id="bgm-dur">0:00</span>
          </div>

          <div class="bgm-controls">
            <button class="bgm-play" id="bgm-play" aria-label="播放或暂停">
              <svg
                id="bgm-icon-play"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg
                id="bgm-icon-pause"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                hidden
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
            <button class="bgm-mute" id="bgm-mute" aria-label="静音切换">
              <svg
                id="bgm-icon-vol"
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3z" />
                <path d="M16 8a4.5 4.5 0 0 1 0 8v-2a2.5 2.5 0 0 0 0-4V8z" />
              </svg>
              <svg
                id="bgm-icon-muted"
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="currentColor"
                hidden
              >
                <path d="M3 9v6h4l5 5V4L7 9H3z" />
                <path
                  d="M16 9l5 5m0-5l-5 5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <input
              class="bgm-volume"
              id="bgm-volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              defaultValue={0.55}
              aria-label="音量"
            />
          </div>

          <div class="bgm-list" id="bgm-list" hidden></div>
          <div class="bgm-error" id="bgm-error">音频加载失败，请检查文件路径</div>
        </div>

        <button class="bgm-toggle" id="bgm-toggle" aria-label="背景音乐" title="背景音乐" aria-expanded="false">
          <svg
            class="bgm-icon-note"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
          <span class="bgm-eq" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
        </button>
      </div>
    )
  }

  MusicPlayerComponent.css = css

  // 注意：本脚本是纯字符串（非模板插值），内部只使用单引号，禁止反引号与 ${}
  MusicPlayerComponent.afterDOMLoaded = `
    (function() {
      var TRACKS = ${JSON.stringify(tracks)};
      var root = document.getElementById('bgm-player');
      if (!root) return;
      if (!TRACKS.length) { root.setAttribute('hidden', ''); return; }

      var card = document.getElementById('bgm-card');
      var toggle = document.getElementById('bgm-toggle');
      var titleEl = document.getElementById('bgm-title');
      var loopBtn = document.getElementById('bgm-loop');
      var seekEl = document.getElementById('bgm-seek');
      var curEl = document.getElementById('bgm-cur');
      var durEl = document.getElementById('bgm-dur');
      var playBtn = document.getElementById('bgm-play');
      var iconPlay = document.getElementById('bgm-icon-play');
      var iconPause = document.getElementById('bgm-icon-pause');
      var muteBtn = document.getElementById('bgm-mute');
      var iconVol = document.getElementById('bgm-icon-vol');
      var iconMuted = document.getElementById('bgm-icon-muted');
      var volEl = document.getElementById('bgm-volume');
      var listEl = document.getElementById('bgm-list');

      // ---- 全局单例：audio 不插入 DOM，SPA 换页不影响播放 ----
      var W = window;
      var S = W.__bgm;
      if (!S) {
        var audio = new Audio();
        audio.preload = 'metadata';
        S = W.__bgm = { audio: audio, trackIndex: 0, loop: true, wantsPlay: false, seeking: false, initialized: false, bound: false, prefs: null, updateUI: null };
      }
      var audio = S.audio;

      // ---- 首次初始化：读取 localStorage 偏好 ----
      if (!S.initialized) {
        var prefs = {};
        try { prefs = JSON.parse(localStorage.getItem('bgm-prefs') || '{}'); } catch (e) {}
        S.prefs = prefs;
        if (typeof prefs.volume === 'number') {
          audio.volume = Math.min(1, Math.max(0, prefs.volume));
        } else {
          audio.volume = 0.55;
        }
        if (prefs.loop === false) S.loop = false;
        audio.loop = S.loop;
        S.trackIndex = (typeof prefs.trackIndex === 'number' && TRACKS[prefs.trackIndex]) ? prefs.trackIndex : 0;
        audio.src = TRACKS[S.trackIndex].src;
        var resumeTime = (typeof prefs.time === 'number' && isFinite(prefs.time) && prefs.time > 1) ? prefs.time : 0;
        if (resumeTime) {
          audio.addEventListener('loadedmetadata', function() {
            try { if (audio.duration && resumeTime < audio.duration - 2) audio.currentTime = resumeTime; } catch (e) {}
          }, { once: true });
        }
        S.initialized = true;
      }

      function fmt(s) {
        if (!isFinite(s) || s < 0) return '0:00';
        s = Math.floor(s);
        var m = Math.floor(s / 60);
        var sec = s % 60;
        return m + ':' + (sec < 10 ? '0' : '') + sec;
      }

      function setHidden(el, v) {
        if (v) el.setAttribute('hidden', '');
        else el.removeAttribute('hidden');
      }

      function renderList() {
        if (TRACKS.length < 2) { setHidden(listEl, true); return; }
        setHidden(listEl, false);
        listEl.innerHTML = '';
        TRACKS.forEach(function(t, i) {
          var b = document.createElement('button');
          b.className = 'bgm-list-item' + (i === S.trackIndex ? ' is-current' : '');
          b.setAttribute('data-index', String(i));
          b.type = 'button';
          b.textContent = (i + 1) + '. ' + t.title;
          listEl.appendChild(b);
        });
      }

      function updateUI() {
        var playing = !audio.paused && !audio.ended;
        root.classList.toggle('is-playing', playing);
        setHidden(iconPlay, playing);
        setHidden(iconPause, !playing);
        playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
        if (!S.seeking && isFinite(audio.duration) && audio.duration > 0) {
          seekEl.value = String((audio.currentTime / audio.duration) * 100);
        }
        curEl.textContent = fmt(audio.currentTime);
        durEl.textContent = fmt(audio.duration);
        var muted = audio.muted || audio.volume === 0;
        setHidden(iconVol, muted);
        setHidden(iconMuted, !muted);
        volEl.value = String(muted ? 0 : audio.volume);
        volEl.setAttribute('aria-label', '音量');
        loopBtn.classList.toggle('is-on', S.loop);
        loopBtn.title = S.loop ? '单曲循环：开（点击关闭）' : '单曲循环：关（点击开启）';
        setHidden(document.getElementById('bgm-loop-off-line'), S.loop);
        var items = listEl.querySelectorAll('.bgm-list-item');
        for (var k = 0; k < items.length; k++) {
          items[k].classList.toggle('is-current', k === S.trackIndex);
        }
      }
      S.updateUI = updateUI;

      function savePrefs() {
        try {
          localStorage.setItem('bgm-prefs', JSON.stringify({
            volume: audio.volume,
            loop: S.loop,
            trackIndex: S.trackIndex,
            time: audio.currentTime,
            enabled: S.wantsPlay
          }));
        } catch (e) {}
      }

      function tryPlay() {
        S.wantsPlay = true;
        var p = audio.play();
        if (p && p.catch) {
          p.catch(function() { S.wantsPlay = false; updateUI(); });
        }
        updateUI();
      }

      function doPause() {
        S.wantsPlay = false;
        audio.pause();
        savePrefs();
        updateUI();
      }

      function setTrack(i, autoplay) {
        S.trackIndex = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
        audio.src = TRACKS[S.trackIndex].src;
        titleEl.textContent = TRACKS[S.trackIndex].title;
        root.classList.remove('has-error');
        if (autoplay) tryPlay();
        renderList();
        savePrefs();
        updateUI();
      }

      // ---- UI 事件（每次导航重绑到新 DOM）----
      toggle.addEventListener('click', function() {
        var open = card.hasAttribute('hidden');
        setHidden(card, !open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { renderList(); updateUI(); }
      });
      playBtn.addEventListener('click', function() {
        if (audio.paused) tryPlay(); else doPause();
      });
      loopBtn.addEventListener('click', function() {
        S.loop = !S.loop;
        audio.loop = S.loop;
        updateUI(); savePrefs();
      });
      muteBtn.addEventListener('click', function() {
        audio.muted = !audio.muted;
        updateUI(); savePrefs();
      });
      volEl.addEventListener('input', function() {
        audio.muted = false;
        audio.volume = Math.min(1, Math.max(0, parseFloat(volEl.value)));
        updateUI(); savePrefs();
      });
      seekEl.addEventListener('input', function() {
        S.seeking = true;
        curEl.textContent = fmt((parseFloat(seekEl.value) / 100) * (audio.duration || 0));
      });
      seekEl.addEventListener('change', function() {
        if (isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = (parseFloat(seekEl.value) / 100) * audio.duration;
        }
        S.seeking = false;
      });
      listEl.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-index]') : null;
        if (!btn) return;
        var i = parseInt(btn.getAttribute('data-index'), 10);
        if (i === S.trackIndex) { if (audio.paused) tryPlay(); else doPause(); }
        else setTrack(i, true);
      });

      // ---- audio 全局事件只绑一次（通过单例上的 updateUI 联动当前 UI）----
      if (!S.bound) {
        audio.addEventListener('play', function() { if (S.updateUI) S.updateUI(); });
        audio.addEventListener('pause', function() { if (S.updateUI) S.updateUI(); savePrefs(); });
        audio.addEventListener('timeupdate', function() { if (S.updateUI) S.updateUI(); });
        audio.addEventListener('volumechange', function() { if (S.updateUI) S.updateUI(); });
        audio.addEventListener('ended', function() {
          // 单曲循环由原生 audio.loop 处理（不触发 ended）；走到这里说明循环已关，播完即停
          S.wantsPlay = false;
          savePrefs();
          if (S.updateUI) S.updateUI();
        });
        audio.addEventListener('error', function() {
          root.classList.add('has-error');
          if (S.updateUI) S.updateUI();
        });
        S.bound = true;
      }

      // ---- 进度定期记忆（导航重跑前先清掉旧定时器）----
      if (W.__bgmTimer) clearInterval(W.__bgmTimer);
      W.__bgmTimer = setInterval(savePrefs, 5000);

      titleEl.textContent = TRACKS[S.trackIndex].title;
      renderList();

      // 上次离开时在播放 → 尝试自动恢复；被浏览器拦截则保持暂停态，点击即续播
      if (S.prefs && S.prefs.enabled) tryPlay();

      updateUI();
    })();
  `

  return MusicPlayerComponent
}

export default MusicPlayer
