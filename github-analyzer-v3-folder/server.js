'use strict';

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── GEMINI KEY ────────────────────────────────────────────────────────────────
// Replace the string below with your key, OR run:
//   GEMINI_API_KEY=AIza... node server.js

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── GITHUB HELPERS ────────────────────────────────────────────────────────────

function parseGitHubUrl(raw) {
  try {
    const clean = raw.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const m = clean.match(/github\.com\/([^/#?]+)\/([^/#?]+)/);
    return m ? { owner: m[1], repo: m[2] } : null;
  } catch { return null; }
}

async function ghFetch(url, token) {
  const headers = {
    'Accept'    : 'application/vnd.github.v3+json',
    'User-Agent': 'github-repo-analyzer',
  };
  if (token) headers['Authorization'] = `token ${token}`;

  const res = await fetch(url, { headers });
  if (res.status === 404) throw new Error('Repository not found — check the URL.');
  if (res.status === 403) throw new Error('GitHub rate limit hit. Add a personal token for more requests.');
  if (res.status === 401) throw new Error('Invalid GitHub token. Remove it or use a valid one.');
  if (!res.ok)            throw new Error(`GitHub API returned ${res.status}`);
  return res.json();
}

// ── SCORING ───────────────────────────────────────────────────────────────────

function calcDifficulty(d) {
  let s = 1;
  if      (d.commits >= 1000) s += 3;
  else if (d.commits >= 300)  s += 2;
  else if (d.commits >= 50)   s += 1;
  if      (d.contributorsCount >= 20) s += 2;
  else if (d.contributorsCount >= 5)  s += 1;
  const lc = Object.keys(d.languages).length;
  if      (lc >= 6) s += 2;
  else if (lc >= 3) s += 1;
  if      (d.size >= 50000) s += 2;
  else if (d.size >= 5000)  s += 1;
  if (d.stars >= 1000) s += 1;
  return Math.min(10, Math.max(1, s));
}

function calcHealth(d) {
  let s = 0;
  if      (d.commits >= 1000) s += 30;
  else if (d.commits >= 300)  s += 22;
  else if (d.commits >= 50)   s += 14;
  else                        s += 5;
  if      (d.contributorsCount >= 20) s += 25;
  else if (d.contributorsCount >= 10) s += 18;
  else if (d.contributorsCount >= 3)  s += 10;
  else                                s += 4;
  const age = (Date.now() - new Date(d.updatedAt)) / 86400000;
  if      (age <= 7)   s += 25;
  else if (age <= 30)  s += 18;
  else if (age <= 90)  s += 10;
  else if (age <= 365) s += 5;
  if      (d.stars >= 10000) s += 10;
  else if (d.stars >= 1000)  s += 7;
  else if (d.stars >= 100)   s += 4;
  else                       s += 1;
  if (d.description && d.description !== 'No description provided.') s += 5;
  if (d.license && d.license !== 'None') s += 5;
  return Math.min(100, Math.max(0, s));
}

function healthLabel(score) {
  if (score >= 80) return { label: 'Excellent', cls: 'excellent' };
  if (score >= 60) return { label: 'Good',      cls: 'good'      };
  if (score >= 40) return { label: 'Fair',      cls: 'fair'      };
  return               { label: 'Needs Work',   cls: 'poor'      };
}

function activityLevel(commits, updatedAt) {
  const days = (Date.now() - new Date(updatedAt)) / 86400000;
  if (commits > 500 && days < 30)  return 'high';
  if (commits > 100 || days < 90)  return 'medium';
  return 'low';
}

function projectSize(commits, contributors) {
  if (commits >= 1000 || contributors >= 20) return 'Large';
  if (commits >= 200  || contributors >= 5)  return 'Medium';
  return 'Small';
}

// ── /analyze ─────────────────────────────────────────────────────────────────

app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  const token   = (req.body.token || '').trim() || null;

  if (!url) return res.status(400).json({ error: 'No URL provided.' });

  const parsed = parseGitHubUrl(url);
  if (!parsed) return res.status(400).json({ error: 'Not a valid GitHub repo URL. Use: https://github.com/owner/repo' });

  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const [repoR, langsR, contribR, readmeR, treeR] = await Promise.allSettled([
      ghFetch(base, token),
      ghFetch(`${base}/languages`, token),
      ghFetch(`${base}/contributors?per_page=100&anon=true`, token),
      ghFetch(`${base}/readme`, token),
      ghFetch(`${base}/contents`, token),
    ]);

    if (repoR.status === 'rejected') throw new Error(repoR.reason.message);

    const info         = repoR.value;
    const languages    = langsR.status   === 'fulfilled' ? langsR.value   : {};
    const contributors = (contribR.status === 'fulfilled' && Array.isArray(contribR.value))
                         ? contribR.value : [];

    // Commit count — sum of all contributor contributions
    let commits = contributors.reduce((n, c) => n + (c.contributions || 0), 0);
    if (!commits) {
      // Fallback: pagination header
      try {
        const cr   = await fetch(`${base}/commits?per_page=1`, { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'github-repo-analyzer', ...(token ? { Authorization: `token ${token}` } : {}) } });
        const link = cr.headers.get('link') || '';
        const m    = link.match(/page=(\d+)>; rel="last"/);
        commits    = m ? parseInt(m[1]) : 1;
      } catch { commits = 0; }
    }

    // README
    let readmeText    = '';
    let readmeSummary = info.description || '';
    if (readmeR.status === 'fulfilled' && readmeR.value?.content) {
      try {
        const raw   = Buffer.from(readmeR.value.content, 'base64').toString('utf-8');
        readmeText  = raw.slice(0, 3000);
        const lines = raw.split('\n').filter(l => l.trim() && !/^[#!<]/.test(l.trim()));
        if (lines.length) {
          readmeSummary = lines[0].replace(/[*_`[\]]/g, '').trim().slice(0, 300);
        }
      } catch {}
    }

    // File tree
    let fileTree = [];
    if (treeR.status === 'fulfilled' && Array.isArray(treeR.value)) {
      fileTree = treeR.value
        .map(f => ({ name: f.name, type: f.type, size: f.size || 0 }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    }

    // Language percentages
    const totalBytes = Object.values(languages).reduce((n, b) => n + b, 0);
    const langPct    = Object.fromEntries(
      Object.entries(languages)
        .sort(([,a],[,b]) => b - a)
        .map(([l, b]) => [l, totalBytes ? Math.round((b / totalBytes) * 100) : 0])
    );

    const d = {
      name           : info.full_name,
      description    : info.description || 'No description provided.',
      stars          : info.stargazers_count  || 0,
      forks          : info.forks_count        || 0,
      watchers       : info.subscribers_count  || 0,
      openIssues     : info.open_issues_count  || 0,
      defaultBranch  : info.default_branch,
      size           : info.size               || 0,
      createdAt      : info.created_at,
      updatedAt      : info.updated_at,
      license        : info.license?.name || 'None',
      topics         : info.topics        || [],
      languages      : langPct,
      commits,
      contributorsCount : contributors.length,
      topContributors   : contributors.slice(0, 5).map(c => ({
        login        : c.login || 'anonymous',
        contributions: c.contributions,
        avatar       : c.avatar_url || '',
      })),
      summary    : readmeSummary || info.description || '',
      readmeText,
      fileTree,
    };

    d.difficulty   = calcDifficulty(d);
    d.activityLevel= activityLevel(d.commits, d.updatedAt);
    d.healthScore  = calcHealth(d);
    d.healthInfo   = healthLabel(d.healthScore);
    d.projectSize  = projectSize(d.commits, d.contributorsCount);

    return res.json({ ok: true, data: d });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});


// ── CATCH-ALL (must be last) ──────────────────────────────────────────────────

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`GitHub Analyzer running → http://localhost:${PORT}`);
});