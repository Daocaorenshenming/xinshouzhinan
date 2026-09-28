import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { readFileSync } from "node:fs"
import path from "node:path"

// 编译好的组件样式（由 aiChat.scss 编译而来）
// 注意：构建时 cwd 为项目根目录
const aiChatStyle = readFileSync(
  path.join(process.cwd(), "quartz", "components", "styles", "aiChat.compiled.css"),
  "utf-8",
)

/**
 * AI 问答组件
 *
 * 工作方式：
 *   1. 首次打开时加载静态检索索引（search-index.json）
 *   2. 用户提问 → 浏览器端 BM25 检索出最相关的文章片段
 *   3. 将片段作为上下文发送给后端 API（/api/ask）→ 由后端调用 LLM
 *   4. 展示回答 + 可点击的原文引用链接
 *
 * 安全设计：LLM API Key 只存在于服务端环境变量，前端不接触密钥。
 */
const AiChat: QuartzComponentConstructor = (opts: { apiEndpoint?: string } = {}) => {
  const apiEndpoint = opts.apiEndpoint ?? "/api/ask"

  const AiChatComponent: QuartzComponent = (props: QuartzComponentProps) => {
    return (
      <div class="ai-chat" id="ai-chat">
        <button class="ai-chat-toggle" id="ai-chat-toggle" aria-label="打开 AI 问答">
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
          >
            <path d="M12 3l1.9 5.8a2 2 0 001.3 1.3L21 12l-5.8 1.9a2 2 0 00-1.3 1.3L12 21l-1.9-5.8a2 2 0 00-1.3-1.3L3 12l5.8-1.9a2 2 0 001.3-1.3L12 3z" />
          </svg>
          <span>AI 问答</span>
        </button>

        <div class="ai-chat-panel" id="ai-chat-panel" hidden>
          <div class="ai-chat-header">
            <div class="ai-chat-title">
              <span class="ai-dot"></span>
              英雄序章 · AI 助手
            </div>
            <button class="ai-chat-close" id="ai-chat-close" aria-label="关闭">
              ×
            </button>
          </div>

          <div class="ai-chat-body" id="ai-chat-body">
            <div class="ai-msg ai-msg-bot">
              <div class="ai-msg-content">
                你好，我是《英雄序章》的 AI 助手。你可以问我任何魔兽世界新手相关的问题，
                比如「大秘境是什么」「什么是团减」「怎么提升装备等级」。
              </div>
            </div>
          </div>

          <form class="ai-chat-form" id="ai-chat-form">
            <input
              type="text"
              id="ai-chat-input"
              placeholder="输入问题…"
              autocomplete="off"
              maxlength="200"
            />
            <button type="submit" id="ai-chat-submit" aria-label="发送">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
          <div class="ai-chat-hint">
            回答基于本站内容生成，可能有误，请以正文为准
          </div>
        </div>
      </div>
    )
  }

  AiChatComponent.css = aiChatStyle

  AiChatComponent.afterDOMLoaded = `
    (function() {
      const API_ENDPOINT = ${JSON.stringify(apiEndpoint)};
      const INDEX_URL = '/static/search-index.json';

      const toggle = document.getElementById('ai-chat-toggle');
      const panel = document.getElementById('ai-chat-panel');
      const closeBtn = document.getElementById('ai-chat-close');
      const form = document.getElementById('ai-chat-form');
      const input = document.getElementById('ai-chat-input');
      const body = document.getElementById('ai-chat-body');
      const submitBtn = document.getElementById('ai-chat-submit');

      if (!toggle || !panel) return;

      let indexData = null;
      let indexLoading = null;
      let isRequesting = false;

      // ---------- 索引懒加载 ----------
      function loadIndex() {
        if (indexData) return Promise.resolve(indexData);
        if (indexLoading) return indexLoading;
        indexLoading = fetch(INDEX_URL)
          .then(r => r.ok ? r.json() : null)
          .then(data => { indexData = data; return data; })
          .catch(() => null);
        return indexLoading;
      }

      // ---------- 中文 2-gram 分词 ----------
      function tokenize(text) {
        const t = text.toLowerCase();
        const grams = new Set();
        (t.match(/[a-z0-9]+/g) || []).forEach(w => grams.add(w));
        const cjk = t.replace(/[^\\u4e00-\\u9fa5]/g, '');
        for (let i = 0; i < cjk.length - 1; i++) grams.add(cjk.slice(i, i + 2));
        return grams;
      }

      // ---------- BM25 检索 ----------
      function search(query, topK) {
        if (!indexData) return [];
        const grams = tokenize(query);
        const scores = new Map();
        const N = indexData.totalChunks;
        const avgLen = indexData.avgLen || 1;
        const K1 = 1.5, B = 0.75;

        for (const g of grams) {
          const postings = indexData.index[g];
          if (!postings) continue;
          const df = postings.length;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          for (const [docId, tf] of postings) {
            const docLen = indexData.docLengths[docId] || 1;
            const score = idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / avgLen))));
            scores.set(docId, (scores.get(docId) || 0) + score);
          }
        }

        return [...scores.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, topK || 5)
          .map(([id, score]) => Object.assign({}, indexData.chunks[id], { score: score }));
      }

      // ---------- 编码路径（与 Quartz 的 slug 规则对齐）----------
      function encodePath(p) {
        return '/' + p.split('/').map(encodeURIComponent).join('/');
      }

      // ---------- 渲染 ----------
      function addMessage(role, html, sources) {
        const wrap = document.createElement('div');
        wrap.className = 'ai-msg ai-msg-' + (role === 'user' ? 'user' : 'bot');
        const content = document.createElement('div');
        content.className = 'ai-msg-content';
        content.innerHTML = html;

        if (sources && sources.length) {
          const srcBox = document.createElement('div');
          srcBox.className = 'ai-sources';
          srcBox.innerHTML = '<div class="ai-sources-title">参考来源</div>';
          sources.forEach(s => {
            const a = document.createElement('a');
            a.className = 'ai-source-item';
            a.href = encodePath(s.path);
            a.textContent = s.title;
            srcBox.appendChild(a);
          });
          wrap.appendChild(srcBox);
        }

        wrap.insertBefore(content, wrap.firstChild);
        body.appendChild(wrap);
        body.scrollTop = body.scrollHeight;
        return content;
      }

      function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
      }

      // 极简 Markdown 渲染（粗体、行内代码、换行）
      function renderMarkdown(text) {
        let h = escapeHtml(text);
        h = h.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        h = h.replace(/\`(.+?)\`/g, '<code>$1</code>');
        h = h.replace(/\\n/g, '<br>');
        return h;
      }

      function showLoading() {
        const el = document.createElement('div');
        el.className = 'ai-msg ai-msg-bot ai-loading';
        el.id = 'ai-loading';
        el.innerHTML = '<div class="ai-msg-content"><span class="ai-dots"><i></i><i></i><i></i></span></div>';
        body.appendChild(el);
        body.scrollTop = body.scrollHeight;
      }

      function hideLoading() {
        const el = document.getElementById('ai-loading');
        if (el) el.remove();
      }

      // ---------- 主流程 ----------
      async function ask(question) {
        if (isRequesting) return;
        isRequesting = true;
        submitBtn.disabled = true;
        input.disabled = true;

        addMessage('user', escapeHtml(question));
        showLoading();

        try {
          const data = await loadIndex();
          if (!data) throw new Error('检索索引加载失败');

          const hits = search(question, 6);
          const context = hits.map((h, i) =>
            '【' + (i + 1) + '】' + h.title + '\\n' + h.text
          ).join('\\n\\n');

          const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: question,
              context: context,
              sources: hits.map(h => ({ title: h.title, path: h.path }))
            })
          });

          hideLoading();

          if (!res.ok) {
            let msg = '服务暂时不可用（' + res.status + '）';
            try { const e = await res.json(); if (e.error) msg = e.error; } catch (_) {}
            addMessage('bot', escapeHtml(msg));
            return;
          }

          const json = await res.json();
          const answer = json.answer || '抱歉，我暂时无法回答这个问题。';
          const sources = json.sources || [];
          addMessage('bot', renderMarkdown(answer), sources);

        } catch (err) {
          hideLoading();
          addMessage('bot', '出错了：' + escapeHtml(String(err.message || err)));
        } finally {
          isRequesting = false;
          submitBtn.disabled = false;
          input.disabled = false;
          input.focus();
        }
      }

      // ---------- 事件绑定 ----------
      toggle.addEventListener('click', () => {
        const isHidden = panel.hasAttribute('hidden');
        if (isHidden) {
          panel.removeAttribute('hidden');
          toggle.setAttribute('hidden', '');
          loadIndex();
          setTimeout(() => input.focus(), 100);
        }
      });

      closeBtn.addEventListener('click', () => {
        panel.setAttribute('hidden', '');
        toggle.removeAttribute('hidden');
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        input.value = '';
        ask(q);
      });

      // 快捷键：Ctrl/Cmd + K 打开
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          if (panel.hasAttribute('hidden')) {
            panel.removeAttribute('hidden');
            toggle.setAttribute('hidden', '');
            loadIndex();
            setTimeout(() => input.focus(), 100);
          } else {
            panel.setAttribute('hidden', '');
            toggle.removeAttribute('hidden');
          }
        }
      });
    })();
  `

  return AiChatComponent
}

export default AiChat
