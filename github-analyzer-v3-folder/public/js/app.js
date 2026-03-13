let repoData = null;

/**
 * GitHub Project Analyzer — Frontend
 * All API calls go to the LOCAL Express server (same origin).
 * NEVER redirects to any external website.
 */

'use strict';

// ── DOM SHORTCUTS ─────────────────────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── SCREEN MANAGEMENT ─────────────────────────────────────────────────────────
function showScreen(id) {
  $$('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const el = $(id);
  if (el) {
    el.style.display = 'flex';
    // tiny delay so CSS transition triggers
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('active')));
  }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  $('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 6000);
}

// ── LOADING STEPS ─────────────────────────────────────────────────────────────
const STEP_IDS = ['ls1','ls2','ls3','ls4'];
let stepInterval = null;

function startSteps() {
  let i = 0;
  STEP_IDS.forEach(id => { $(id).className = 'lstep'; });
  $(STEP_IDS[0]).classList.add('active');
  stepInterval = setInterval(() => {
    if (i < STEP_IDS.length - 1) {
      $(STEP_IDS[i]).classList.remove('active');
      $(STEP_IDS[i]).classList.add('done');
      i++;
      $(STEP_IDS[i]).classList.add('active');
    }
  }, 650);
}

function finishSteps() {
  clearInterval(stepInterval);
  STEP_IDS.forEach(id => {
    $(STEP_IDS[id]);
    const el = $(id);
    el.classList.remove('active');
    el.classList.add('done');
  });
}

// ── FORMAT HELPERS ────────────────────────────────────────────────────────────
const fmt = n => {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
};

const fmtDate = iso =>
  new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });

const timeAgo = iso => {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d} days ago`;
  if (d < 365) return `${Math.floor(d/30)} months ago`;
  return `${Math.floor(d/365)} years ago`;
};

const diffClass = s => s <= 3 ? 'easy' : s <= 6 ? 'medium' : 'hard';
const diffLabel = s => s <= 3 ? 'Beginner Friendly' : s <= 5 ? 'Moderate' : s <= 7 ? 'Advanced' : 'Expert Level';

const fileIcon = name => {
  const ext = name.split('.').pop().toLowerCase();
  const m = { js:'🟨',ts:'🔷',jsx:'🟨',tsx:'🔷',py:'🐍',rb:'💎',go:'🐹',rs:'🦀',java:'☕',
              cpp:'⚙️',c:'⚙️',cs:'💜',php:'🐘',swift:'🧡',kt:'🟣',vue:'💚',
              md:'📝',txt:'📄',json:'🔧',yaml:'🔧',yml:'🔧',toml:'🔧',env:'🔒',
              html:'🌐',css:'🎨',scss:'🎨',less:'🎨',
              dockerfile:'🐋',sh:'💻',bat:'💻',ps1:'💻',
              svg:'🖼',png:'🖼',jpg:'🖼',gif:'🖼',ico:'🖼',
              pdf:'📕',zip:'📦',tar:'📦',lock:'🔒',gitignore:'🚫' };
  return m[ext] || '📄';
};

// ── ANALYZE ───────────────────────────────────────────────────────────────────

async function runAnalysis() {
  const rawUrl = $('repo-url').value.trim();
  const token  = ($('token-input').value || '').trim() || null;

  if (!rawUrl) { showToast('Paste a GitHub repository URL first.'); return; }
  if (!rawUrl.includes('github.com')) {
    showToast('That doesn\'t look like a GitHub URL. Try: https://github.com/owner/repo');
    return;
  }

  $('analyze-btn').disabled = true;
  showScreen('loading-screen');
  startSteps();

  try {
    // ── POST to our OWN Express server — never an external URL ──
    const res  = await fetch('/analyze', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ url: rawUrl, token }),
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(json.error || `Server error ${res.status}`);
    }

    finishSteps();
    await new Promise(r => setTimeout(r, 350));

    currentRepo = json.data;
    chatHistory  = [];
    renderDashboard(json.data);
    showScreen('dash-screen');

  } catch (err) {
    finishSteps();
    showScreen('home-screen');
    showToast(err.message || 'Analysis failed. Check the URL and try again.');
  } finally {
    $('analyze-btn').disabled = false;
  }
}

// ── RENDER DASHBOARD ──────────────────────────────────────────────────────────

function renderDashboard(d) {
  const [owner, repoName] = d.name.split('/');
  const repoUrl = `https://github.com/${d.name}`;
  const dc      = diffClass(d.difficulty);
  const hi      = d.healthInfo || { label: 'Unknown', cls: 'fair' };
  const C       = 2 * Math.PI * 34;   // SVG ring circumference (r=34)
  const offset  = C - (d.healthScore / 100) * C;

  /* ── Repo Header ── */
  $('repo-header').innerHTML = `
    <div class="rh-path">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
      </svg>
      <a href="${repoUrl}" target="_blank" rel="noopener">${owner}</a>
      <span style="color:var(--text3)">/</span>
      <a href="${repoUrl}" target="_blank" rel="noopener">${repoName}</a>
    </div>
    <h1 class="rh-name">${repoName}</h1>
    <p class="rh-desc">${esc(d.description) }</p>
    ${ d.topics.length
       ? `<div class="rh-topics">${ d.topics.slice(0,10).map(t=>`<span class="topic-tag">${esc(t)}</span>`).join('') }</div>`
       : '' }
  `;

  /* ── Left column cards ── */
  $('dash-main').innerHTML = `

    <!-- ① Repository Overview -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Repository Overview</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-val ${ dc === 'easy' ? 'diff-easy-col' : dc === 'medium' ? 'diff-medium-col' : 'diff-hard-col' }">
            ${d.difficulty}<span style="font-size:14px;color:var(--text3);font-weight:500">/10</span>
          </div>
          <div class="stat-lbl">Difficulty</div>
        </div>
        <div class="stat">
          <div class="stat-val col-accent">★ ${fmt(d.stars)}</div>
          <div class="stat-lbl">Stars</div>
        </div>
        <div class="stat">
          <div class="stat-val">${fmt(d.forks)}</div>
          <div class="stat-lbl">Forks</div>
        </div>
        <div class="stat">
          <div class="stat-val">${d.openIssues}</div>
          <div class="stat-lbl">Open Issues</div>
        </div>
      </div>
      <div class="meta-strip">
        <div class="meta-item">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Updated ${timeAgo(d.updatedAt)}
        </div>
        <div class="meta-item">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${esc(d.license)}
        </div>
        <div class="meta-item">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          ${Math.round((d.size||0)/1024)} MB
        </div>
        <div class="meta-item">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          ${esc(d.defaultBranch)}
        </div>
      </div>
    </div>

    <!-- ② Tech Stack -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Tech Stack</div>
      <div class="lang-list" id="lang-list">
        ${ Object.keys(d.languages).length === 0
           ? '<p style="font-family:var(--mono);font-size:12px;color:var(--text3)">No language data available</p>'
           : Object.entries(d.languages).slice(0,8).map(([lang,pct],i) => `
               <div class="lang-row">
                 <div class="lang-head">
                   <span class="lang-name">${esc(lang)}</span>
                   <span class="lang-pct">${pct}%</span>
                 </div>
                 <div class="lang-bar">
                   <div class="lang-fill lc${i%8}" data-pct="${pct}"></div>
                 </div>
               </div>`).join('')
        }
      </div>
    </div>

    <!-- ③ Project Metrics -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Project Metrics</div>

      <div class="metrics-row">
        <div class="health-ring-wrap">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle class="ring-bg"   cx="40" cy="40" r="34"/>
            <circle class="ring-fill c-${hi.cls}-s"
              cx="40" cy="40" r="34"
              stroke-dasharray="${C}"
              stroke-dashoffset="${C}"
              data-offset="${offset}"
              id="health-ring"/>
          </svg>
          <div class="ring-num c-${hi.cls}">${d.healthScore}</div>
        </div>
        <div class="health-info">
          <div class="health-label c-${hi.cls}">${hi.label}</div>
          <div class="health-sub">Health Score / 100</div>
        </div>
      </div>

      <div class="diff-section">
        <div class="diff-header">
          <span class="diff-lbl">Difficulty</span>
          <span class="diff-val ${ dc==='easy'?'diff-easy-col':dc==='medium'?'diff-medium-col':'diff-hard-col' }">
            ${d.difficulty}/10 — ${diffLabel(d.difficulty)}
          </span>
        </div>
        <div class="diff-bar">
          <div class="diff-fill diff-${dc}-fill" data-pct="${(d.difficulty/10)*100}"></div>
        </div>
      </div>

      <div class="size-row">
        <span class="size-lbl">Project Size</span>
        <span class="size-badge">
          ${ d.projectSize==='Large'?'🔴':d.projectSize==='Medium'?'🟡':'🟢' }
          ${d.projectSize}
        </span>
      </div>
    </div>

    <!-- ④ Activity -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Activity</div>
      <div class="act-badge ${d.activityLevel}">
        <span class="act-dot"></span>${d.activityLevel.toUpperCase()} ACTIVITY
      </div>
      <div class="act-stats">
        <div class="astat">
          <div class="astat-val">${fmt(d.commits)}</div>
          <div class="astat-lbl">Commits</div>
        </div>
        <div class="astat">
          <div class="astat-val">${d.contributorsCount}</div>
          <div class="astat-lbl">Contributors</div>
        </div>
        <div class="astat">
          <div class="astat-val">${fmt(d.watchers)}</div>
          <div class="astat-lbl">Subscribers</div>
        </div>
        <div class="astat">
          <div class="astat-val">${fmtDate(d.createdAt).replace(',','')}</div>
          <div class="astat-lbl">Created</div>
        </div>
      </div>
    </div>

    <!-- ⑤ Top Contributors -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Top Contributors</div>
      ${ d.topContributors.length === 0
         ? '<p style="font-family:var(--mono);font-size:12px;color:var(--text3)">No contributor data</p>'
         : `<div class="contrib-list">
              ${ d.topContributors.map(c => {
                const maxC = d.topContributors[0].contributions;
                const bar  = Math.round((c.contributions / maxC) * 100);
                return `<div class="contrib-row">
                  <div class="contrib-av">
                    ${ c.avatar
                       ? `<img src="${c.avatar}" alt="${esc(c.login)}" loading="lazy"/>`
                       : esc(c.login.slice(0,2).toUpperCase()) }
                  </div>
                  <span class="contrib-name">${esc(c.login)}</span>
                  <div class="contrib-bar-wrap"><div class="contrib-bar" style="width:${bar}%"></div></div>
                  <span class="contrib-n">${fmt(c.contributions)}</span>
                </div>`;
              }).join('') }
            </div>` }
    </div>

    <!-- ⑥ File Tree -->
    <div class="card">
      <div class="card-title">
        <span class="ct-dot"></span>File Tree
        <span style="font-weight:400;color:var(--text3);margin-left:4px">(root)</span>
      </div>
      ${ d.fileTree.length === 0
         ? '<p style="font-family:var(--mono);font-size:12px;color:var(--text3)">File tree unavailable</p>'
         : `<div class="ftree-grid">
              ${ d.fileTree.map(f => `
                <div class="fitem ${f.type==='dir'?'is-dir':''}">
                  <span class="ficon">${ f.type==='dir' ? '📁' : fileIcon(f.name) }</span>
                  <span class="fname" title="${esc(f.name)}">${esc(f.name)}</span>
                </div>`).join('') }
            </div>` }
    </div>

    <!-- ⑦ Summary -->
    <div class="card">
      <div class="card-title"><span class="ct-dot"></span>Quick Summary</div>
      <p class="summary-body">${buildSummary(d)}</p>
    </div>
  `;

  // Animate bars after paint
  requestAnimationFrame(() => setTimeout(() => {
    $$('.lang-fill').forEach(el => { el.style.width = el.dataset.pct + '%'; });
    $$('.diff-fill').forEach(el => { el.style.width = el.dataset.pct + '%'; });
    const ring = $('health-ring');
    if (ring) ring.style.strokeDashoffset = ring.dataset.offset;
  }, 120));

  // Wire AI sidebar for this repo
  initAI(repoName);
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────

function buildSummary(d) {
  const [owner, repoName] = d.name.split('/');
  const topLang  = Object.keys(d.languages)[0] || 'various languages';
  const langCt   = Object.keys(d.languages).length;
  const age      = Math.floor((Date.now() - new Date(d.createdAt)) / (1000*60*60*24*365));
  const ageStr   = age < 1 ? 'less than a year' : age === 1 ? 'about 1 year' : `${age} years`;
  const dc       = diffClass(d.difficulty);

  let s = `<strong>${esc(repoName)}</strong> by <strong>${esc(owner)}</strong> is a `;
  s += `${diffLabel(d.difficulty).toLowerCase()} project `;
  s += `primarily written in <strong>${esc(topLang)}</strong>`;
  if (langCt > 1) s += ` across <strong>${langCt} languages</strong>`;
  s += `. Active for ${ageStr} with <strong>${fmt(d.commits)} commits</strong> from `;
  s += `<strong>${d.contributorsCount} contributor${d.contributorsCount!==1?'s':''}</strong>. `;
  s += `Health score: <strong>${d.healthScore}/100</strong> — `;
  s += d.healthScore >= 80 ? 'well-maintained and active.'
     : d.healthScore >= 60 ? 'generally in good shape.'
     : 'may benefit from more maintenance.';

  if (d.summary && d.summary !== d.description) {
    s += `<br><br>${esc(d.summary)}`;
  } else if (d.description) {
    s += `<br><br>${esc(d.description)}`;
  }
  return s;
}

// ── AI CHAT ───────────────────────────────────────────────────────────────────

let currentRepo  = null;
let chatHistory  = [];
let aiLoading    = false;

function initAI(repoName) {
  // Update welcome text with repo name
  const welcomeTxt = document.querySelector('.ai-welcome-txt');
  if (welcomeTxt) welcomeTxt.innerHTML = `Ask me anything about <strong>${esc(repoName)}</strong>`;

  // Suggestion buttons
  $$('.ai-sug').forEach(btn => {
    btn.addEventListener('click', () =>  sendAIMessage(btn.textContent.trim()));
  });

  // Input + send
  const input   = $('ai-input');
  const sendBtn = $('ai-send');

  // Remove old listeners by cloning
  const newInput   = input.cloneNode(true);
  const newSendBtn = sendBtn.cloneNode(true);
  input.replaceWith(newInput);
  sendBtn.replaceWith(newSendBtn);

  $('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIFromInput(); }
  });
  $('ai-send').addEventListener('click', sendAIFromInput);
}

function sendAIFromInput() {
  const input = $('ai-input');
  const q     = input.value.trim();
  if (!q) return;
  input.value = '';
 sendAIMessage(q);
}

function appendMsg(role, text) {
  const container = $('ai-messages');

  // Remove welcome panel on first message
  const welcome = $('ai-welcome');
  if (welcome) welcome.remove();

  const wrap   = document.createElement('div');
  wrap.className = `msg ${role}`;

  const av     = document.createElement('div');
  av.className = 'msg-av';
  av.textContent = role === 'user' ? 'U' : '⬡';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'ai') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  wrap.appendChild(av);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return wrap;
}

function showTyping() {
  const container = $('ai-messages');
  const welcome   = $('ai-welcome');
  if (welcome) welcome.remove();

  const wrap   = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.id        = 'typing-msg';

  const av   = document.createElement('div');
  av.className = 'msg-av';
  av.textContent = '⬡';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble typing-bubble';
  bubble.innerHTML = '<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>';

  wrap.appendChild(av);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const t = $('typing-msg');
  if (t) t.remove();
}

// Light markdown → HTML (safe — we control the source via Gemini)
function renderMarkdown(md) {
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) =>
      `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,   '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm,  '<strong>$1</strong>')
    .replace(/^[-•*] (.+)$/gm,   '• $1')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g,     '<br>');
}
async function sendAIMessage(message) {

const prompt = `
Repository: ${currentRepo.name}
Description: ${currentRepo.description}
Languages: ${Object.keys(currentRepo.languages).join(", ")}
Commits: ${currentRepo.commits}
Contributors: ${currentRepo.contributorsCount}

User question: ${message}
`;

appendMsg("user", message);
showTyping();

const response = await puter.ai.chat(prompt, {
  model: "gpt-5.3-chat"
});

hideTyping();

appendMsg("ai", response.message.content);

}


// ── SAFE HTML ESCAPE ──────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── WIRE HOME BUTTONS ─────────────────────────────────────────────────────────

// Prevent any form submission (just in case)
document.addEventListener('submit', e => e.preventDefault());

$('analyze-btn').addEventListener('click', runAnalysis);

$('repo-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') runAnalysis();
});

$('token-toggle').addEventListener('click', () => {
  const wrap = $('token-wrap');
  wrap.hidden = !wrap.hidden;
});

$$('.chip').forEach(c => {
  c.addEventListener('click', () => {
    $('repo-url').value = c.dataset.url;
    $('repo-url').focus();
  });
});

$('back-btn').addEventListener('click', () => {
  currentRepo = null;
  chatHistory = [];
  showScreen('home-screen');
});

// ── INIT ──────────────────────────────────────────────────────────────────────
showScreen('home-screen');
