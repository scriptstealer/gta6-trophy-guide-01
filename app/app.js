// GTA VI trophy guide & tracker: a checklist of all 55 trophies that saves in the browser
// (localStorage), exports and imports progress as a file, filters by kind and grade, searches,
// and hides story trophy names until earned when spoiler-safe mode is on. It fetches only its
// own data file (data/trophies.json) and makes no network request at run time.
const KEY = 'gta6-trophy-guide-v1';
const listEl = document.getElementById('trophy-list');
const emptyEl = document.getElementById('empty-state');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade');
const spoilerEl = document.getElementById('spoiler');
const shownEl = document.getElementById('shown-count');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

const KIND_LABEL = { story: 'Story', collectibles: 'Collectibles', activities: 'Activities', online: 'Online' };
const STAGE_LABEL = { 1: 'Roadmap: Stage 1 — Story', 2: 'Roadmap: Stage 2 — 100% checklist', 3: 'Roadmap: Stage 3 — Cleanup' };

let state = { earned: [], spoiler: true, kind: 'all', grade: 'all', search: '' };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved && typeof saved === 'object') state = { ...state, ...saved, earned: Array.isArray(saved.earned) ? saved.earned : [] };
} catch { /* a corrupt save starts fresh */ }
const earned = new Set(state.earned);

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;

function save() {
  state.earned = [...earned];
  localStorage.setItem(KEY, JSON.stringify(state));
}

function gradeBadge(grade) {
  const span = document.createElement('span');
  span.className = 'grade-badge grade-' + grade;
  span.textContent = grade;
  return span;
}

function tag(text, cls) {
  const span = document.createElement('span');
  span.className = 'tag ' + cls;
  span.textContent = text;
  return span;
}

function render() {
  const q = state.search.trim().toLowerCase();
  listEl.replaceChildren();
  let shown = 0;
  for (const t of trophies) {
    const isEarned = earned.has(t.name);
    if (state.kind === 'missable' && !t.missable) continue;
    if (state.kind !== 'all' && state.kind !== 'missable' && t.kind !== state.kind) continue;
    if (state.grade !== 'all' && t.grade !== state.grade) continue;
    const hay = (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase();
    if (q && !hay.includes(q)) continue;
    shown += 1;

    const card = document.createElement('article');
    card.className = 'trophy-card' + (isEarned ? ' earned' : '') + (t.missable ? ' is-missable' : '');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'earn-box';
    check.checked = isEarned;
    check.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
    check.addEventListener('change', () => {
      if (check.checked) earned.add(t.name);
      else earned.delete(t.name);
      save();
      render();
    });
    card.append(check);

    const body = document.createElement('div');
    body.className = 'card-body';

    const head = document.createElement('div');
    head.className = 'card-head';
    head.append(gradeBadge(t.grade));
    const name = document.createElement('h3');
    const hiddenBySpoiler = state.spoiler && t.kind === 'story' && !isEarned;
    name.textContent = hiddenBySpoiler ? 'Hidden story trophy — earn it to reveal' : t.name;
    head.append(name);
    if (t.missable) head.append(tag('⚠ MISSABLE', 'tag-missable'));
    if (t.hidden && !hiddenBySpoiler) head.append(tag('Hidden on PSN', 'tag-hidden'));
    head.append(tag(KIND_LABEL[t.kind] ?? t.kind, 'tag-kind'));
    if (t.count) head.append(tag('× ' + t.count.toLocaleString('en-US'), 'tag-count'));
    body.append(head);

    const desc = document.createElement('p');
    desc.className = 'official-desc';
    desc.textContent = hiddenBySpoiler ? 'Its name and description stay hidden on PlayStation until you earn it.' : t.description;
    body.append(desc);

    if (!hiddenBySpoiler) {
      const guide = document.createElement('p');
      guide.className = 'guide';
      guide.textContent = t.guide;
      body.append(guide);
      const src = document.createElement('p');
      src.className = 'source';
      src.textContent = 'Source: ' + t.source;
      body.append(src);
      const stage = document.createElement('p');
      stage.className = 'stage';
      stage.textContent = STAGE_LABEL[t.roadmap] ?? '';
      body.append(stage);
    }
    card.append(body);
    listEl.append(card);
  }
  emptyEl.hidden = shown !== 0;
  const pct = Math.round((earned.size / trophies.length) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = earned.size + ' of ' + trophies.length + ' earned · ' + pct + '%';
  shownEl.textContent = shown + ' of ' + trophies.length + ' trophies shown';
}

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.kind = btn.dataset.kind;
    save();
    render();
  });
});
gradeEl.addEventListener('change', () => { state.grade = gradeEl.value; save(); render(); });
searchEl.addEventListener('input', () => { state.search = searchEl.value; save(); render(); });
spoilerEl.addEventListener('change', () => { state.spoiler = spoilerEl.checked; save(); render(); });

document.getElementById('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ earned: [...earned], exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(names)) throw new Error('bad file');
    earned.clear();
    for (const n of names) if (typeof n === 'string' && trophies.some((t) => t.name === n)) earned.add(n);
    save();
    render();
  } catch {
    shownEl.textContent = 'That file could not be imported — it is not a progress export from this guide.';
  }
  e.target.value = '';
});
document.getElementById('reset').addEventListener('click', () => {
  if (earned.size === 0) return;
  earned.clear();
  save();
  render();
});

// Restore the saved controls, then draw the list.
searchEl.value = state.search;
gradeEl.value = state.grade;
spoilerEl.checked = state.spoiler;
document.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.kind === state.kind));
render();
