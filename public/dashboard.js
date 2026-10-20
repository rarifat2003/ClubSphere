// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);

// escape text before putting it into innerHTML
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Request failed');
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// form -> object ('' becomes null)
function formData(form) {
  const obj = Object.fromEntries(new FormData(form));
  for (const k in obj) if (obj[k] === '') obj[k] = null;
  return obj;
}

// fill a form from an object and switch it to "edit mode"
function fillForm(form, row, label) {
  for (const el of form.elements) {
    if (el.name && row[el.name] !== undefined) el.value = row[el.name] ?? '';
  }
  form.querySelector('button[type=submit]').textContent = label;
  form.querySelector('.cancel-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetForm(form, label, defaults = {}) {
  form.reset();
  for (const el of form.elements) if (el.type === 'hidden') el.value = '';
  for (const name in defaults) form.elements[name].value = defaults[name];
  form.querySelector('button[type=submit]').textContent = label;
  form.querySelector('.cancel-btn').hidden = true;
}

const emptyRow = (cols, text) => `<tr><td class="empty" colspan="${cols}">${text}</td></tr>`;

// ---------- state ----------
let squad = [];
let players = [];
let matches = [];
let transactions = [];
let currentMatchId = null;

// ---------- top bar + tabs ----------
async function loadMe() {
  const me = await api('/auth/me');
  $('#club-name').textContent = me.club_name;
  $('#user-name').textContent = me.name;
}

$('#logout').addEventListener('click', async () => {
  await api('/auth/logout', 'POST');
  window.location.href = 'index.html';
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab').forEach((t) => (t.hidden = t.id !== 'tab-' + btn.dataset.tab));
  });
});

// ---------- summary ----------
async function loadSummary() {
  const d = await api('/dashboard-data');
  const balance = Number(d.money.income) - Number(d.money.expense);
  const cards = [
    ['Squad', d.squad.total, d.squad.avg_rating ? `Avg rating: ${d.squad.avg_rating}` : 'No players signed'],
    ['Record', `${d.record.wins}W ${d.record.draws}D ${d.record.losses}L`, `${d.record.played} played, ${d.record.scored}-${d.record.conceded} goals`],
    ['Balance', money(balance), `In ${money(d.money.income)} / Out ${money(d.money.expense)}`],
    ['Top scorer', d.topScorer ? esc(d.topScorer.name) : '-', d.topScorer ? `${d.topScorer.goals} goals` : 'No goals yet'],
    ['Next match', d.nextMatch ? 'vs ' + esc(d.nextMatch.opponent) : '-', d.nextMatch ? d.nextMatch.match_date : 'Nothing scheduled']
  ];
  $('#summary').innerHTML = cards
    .map(([label, value, sub]) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`)
    .join('');
}

// ---------- SQUAD ----------
async function loadSquad() {
  squad = await api('/squad');
  $('#squad-body').innerHTML = squad.length
    ? squad.map((p) => `
      <tr>
        <td>${esc(p.name)}</td><td>${p.position}</td><td>${p.rating}</td>
        <td>${Number(p.fee) ? money(p.fee) : '-'}</td><td>${p.signed_date}</td><td>${p.matches_played}</td><td><b>${p.total_goals}</b></td>
        <td class="actions"><button class="btn btn-danger btn-small" data-id="${p.player_id}">Release</button></td>
      </tr>`).join('')
    : emptyRow(8, 'Your squad is empty. Add a player above or sign one from the Player Pool tab.');

  // dropdown used when recording goals
  $('#goal-player').innerHTML = squad
    .map((p) => `<option value="${p.player_id}">${esc(p.name)} (${p.position})</option>`)
    .join('');
}

$('#squad-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (!confirm('Release this player from your squad?')) return;
  await api(`/squad/${btn.dataset.id}`, 'DELETE');
  refreshAll();
});

$('#new-player-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/squad/new', 'POST', formData(e.target));
  e.target.reset();
  refreshAll();   // squad, pool, summary and finance all change
});

// ---------- PLAYER POOL ----------
async function loadPlayers() {
  const params = new URLSearchParams();
  if ($('#player-search').value) params.set('search', $('#player-search').value);
  if ($('#player-position').value) params.set('position', $('#player-position').value);
  if ($('#player-status').value) params.set('status', $('#player-status').value);
  players = await api('/players?' + params);

  $('#players-body').innerHTML = players.length
    ? players.map((p) => {
      const label = p.status === 'Free' ? 'Free' : p.status === 'MySquad' ? 'My squad' : esc(p.club_name);
      const sign = p.status === 'Free'
        ? `<button class="btn btn-dark btn-small" data-act="sign" data-id="${p.player_id}">Sign</button>` : '';
      return `
        <tr>
          <td>${esc(p.name)}</td><td>${p.position}</td><td>${p.rating}</td><td>${esc(p.region)}</td>
          <td><span class="pill ${p.status}">${label}</span></td>
          <td class="actions">${sign}</td>
        </tr>`;
    }).join('')
    : emptyRow(6, 'No players found');
}

$('#player-search').addEventListener('input', loadPlayers);
$('#player-position').addEventListener('change', loadPlayers);
$('#player-status').addEventListener('change', loadPlayers);

$('#players-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'sign') {
    await api('/squad', 'POST', { player_id: id });
    refreshAll();
  }
});

// ---------- MATCHES ----------
async function loadMatches() {
  matches = await api('/matches');
  $('#matches-body').innerHTML = matches.length
    ? matches.map((m) => `
      <tr>
        <td>${m.match_date}</td><td>${esc(m.opponent)}</td><td>${esc(m.venue || '-')}</td>
        <td>${m.goals_for === null ? '-' : m.goals_for + ' : ' + m.goals_against}</td>
        <td><span class="pill ${m.result}">${m.result}</span></td>
        <td class="actions">
          <button class="btn btn-light btn-small" data-act="goals" data-id="${m.match_id}">Goals</button>
          <button class="btn btn-light btn-small" data-act="edit" data-id="${m.match_id}">Edit</button>
          <button class="btn btn-danger btn-small" data-act="delete" data-id="${m.match_id}">Delete</button>
        </td>
      </tr>`).join('')
    : emptyRow(6, 'No matches yet');
}

$('#match-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  const id = d.match_id;
  await api(id ? `/matches/${id}` : '/matches', id ? 'PUT' : 'POST', d);
  resetForm(e.target, 'Add Match');
  refreshAll();
});

$('#match-form .cancel-btn').addEventListener('click', () => resetForm($('#match-form'), 'Add Match'));

$('#matches-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'edit') {
    fillForm($('#match-form'), matches.find((m) => m.match_id == id), 'Update Match');
  } else if (btn.dataset.act === 'delete') {
    if (!confirm('Delete this match and its goal records?')) return;
    await api(`/matches/${id}`, 'DELETE');
    if (currentMatchId == id) {
      $('#goal-panel').hidden = true;
      currentMatchId = null;
    }
    refreshAll();
  } else if (btn.dataset.act === 'goals') {
    currentMatchId = id;
    const m = matches.find((x) => x.match_id == id);
    $('#goal-title').textContent = `Player goals: vs ${m.opponent} (${m.match_date})`;
    $('#goal-panel').hidden = false;
    loadGoals();
    $('#goal-panel').scrollIntoView({ behavior: 'smooth' });
  }
});

async function loadGoals() {
  const rows = await api(`/matches/${currentMatchId}/goals`);
  $('#goal-body').innerHTML = rows.length
    ? rows.map((r) => `
      <tr><td>${esc(r.name)}</td><td>${r.position}</td><td>${r.goals}</td>
      <td class="actions"><button class="btn btn-danger btn-small" data-player="${r.player_id}">Remove</button></td></tr>`).join('')
    : emptyRow(4, 'No goals recorded for this match');
}

$('#goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!$('#goal-player').value) return alert('Sign a player first');
  await api(`/matches/${currentMatchId}/goals`, 'POST', formData(e.target));
  loadGoals();
  loadSquad();
  loadSummary();
});

$('#goal-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  await api(`/matches/${currentMatchId}/goals/${btn.dataset.player}`, 'DELETE');
  loadGoals();
  loadSquad();
  loadSummary();
});

$('#goal-close').addEventListener('click', () => {
  $('#goal-panel').hidden = true;
  currentMatchId = null;
});

// ---------- FINANCE ----------
async function loadFinance() {
  const type = $('#fin-filter').value;
  transactions = await api('/finance' + (type ? '?type=' + type : ''));

  $('#fin-body').innerHTML = transactions.length
    ? transactions.map((t) => `
      <tr>
        <td>${t.txn_date}</td>
        <td><span class="pill ${t.type}">${t.type}</span></td>
        <td>${esc(t.category)}</td><td>${money(t.amount)}</td>
        <td>${esc(t.description || '')}</td>
        <td class="actions">
          <button class="btn btn-light btn-small" data-act="edit" data-id="${t.txn_id}">Edit</button>
          <button class="btn btn-danger btn-small" data-act="delete" data-id="${t.txn_id}">Delete</button>
        </td>
      </tr>`).join('')
    : emptyRow(6, 'No transactions found');
}

async function loadFinanceSummary() {
  const s = await api('/finance/summary');
  const balance = Number(s.income) - Number(s.expense);
  $('#fin-totals').innerHTML = `
    <div class="mini"><div class="label">Income</div><div class="value">${money(s.income)}</div></div>
    <div class="mini"><div class="label">Expense</div><div class="value">${money(s.expense)}</div></div>
    <div class="mini"><div class="label">Balance</div><div class="value">${money(balance)}</div></div>`;
  $('#fin-category-body').innerHTML = s.byCategory.length
    ? s.byCategory.map((c) => `
      <tr><td><span class="pill ${c.type}">${c.type}</span></td><td>${esc(c.category)}</td>
      <td>${c.count}</td><td>${money(c.total)}</td></tr>`).join('')
    : emptyRow(4, 'No transactions yet');
}

$('#finance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  const id = d.txn_id;
  await api(id ? `/finance/${id}` : '/finance', id ? 'PUT' : 'POST', d);
  resetForm(e.target, 'Add Transaction');
  refreshAll();
});

$('#finance-form .cancel-btn').addEventListener('click', () => resetForm($('#finance-form'), 'Add Transaction'));
$('#fin-filter').addEventListener('change', loadFinance);

$('#fin-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'edit') {
    fillForm($('#finance-form'), transactions.find((t) => t.txn_id == id), 'Update Transaction');
  } else if (btn.dataset.act === 'delete') {
    if (!confirm('Delete this transaction?')) return;
    await api(`/finance/${id}`, 'DELETE');
    refreshAll();
  }
});

// ---------- start ----------
function refreshAll() {
  loadSummary();
  loadSquad();
  loadPlayers();
  loadMatches();
  loadFinance();
  loadFinanceSummary();
  if (currentMatchId) loadGoals();
}

loadMe().then(refreshAll).catch(() => { });