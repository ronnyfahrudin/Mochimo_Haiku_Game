/* The Haiku Keepers — app logic. Vanilla JS, no build step. */
(function () {
'use strict';

const $ = (id) => document.getElementById(id);
const API = '';

let state = null;                 // /api/state payload
let tag = localStorage.getItem('vk_tag') || null;
let verified = false;
let frames = { a: [], b: [] };    // Forge composition (dict indices)
let active = 'a';
let lastShownBlock = null;
const t = I18N.t;
I18N.setLocale(localStorage.getItem('vk_lang') || (navigator.language || 'en').slice(0, 2));

/* ================= boot ================= */

async function boot() {
  const grammar = await getJSON('/api/grammar');
  HaikuClient.init(grammar);
  buildLangPicker();
  applyStatic();
  buildRing();
  renderForge();
  wireNav();
  wireForge();
  wireLogin();
  refreshState();
  setInterval(refreshState, 15000);
  updateWho();
}

async function getJSON(p) { const r = await fetch(API + p); return r.json(); }
async function postJSON(p, body) {
  const r = await fetch(API + p, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}

/* ================= i18n ================= */

function buildLangPicker() {
  const sel = $('lang-sel');
  sel.innerHTML = I18N.LOCALES.map(l => `<option value="${l.code}">${l.label}</option>`).join('');
  sel.value = I18N.getLocale();
  sel.onchange = () => {
    I18N.setLocale(sel.value);
    localStorage.setItem('vk_lang', sel.value);
    applyStatic();
    renderForge();
    if (state) rerenderState();
    if (currentView === 'anthology') loadAnthology();
    updateWho();
  };
}

function applyStatic() {
  document.documentElement.lang = I18N.getLocale();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('tag-input').placeholder = t('tag_ph');
  $('foot-chain').innerHTML = t('foot_chain', '<a href="https://mochimo.org">mochimo</a>');
}

/* ================= NOW view ================= */

function buildRing() {
  const svg = $('aeon-ring');
  const cx = 104, cy = 104, r1 = 88, r2 = 100;
  let s = '';
  for (let i = 0; i < 256; i++) {
    const a = (i / 256) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r1 * Math.cos(a), y1 = cy + r1 * Math.sin(a);
    const x2 = cx + r2 * Math.cos(a), y2 = cy + r2 * Math.sin(a);
    s += `<line class="ring-tick" data-i="${i}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  svg.innerHTML = s;
}

async function refreshState() {
  try { state = await getJSON('/api/state'); } catch { return; }
  rerenderState();
  if (currentView === 'anthology') loadAnthology();
}

function rerenderState() {
  const c = state.clock;
  document.body.dataset.season = c.season;
  $('aeon-num').textContent = t('aeon') + ' ' + c.aeon;
  $('season-name').textContent = t('season_' + c.season);
  $('to-neo').textContent = t('to_neo', c.blocksToNeogenesis);
  document.querySelectorAll('.ring-tick').forEach(el =>
    el.classList.toggle('done', Number(el.dataset.i) < c.blockInAeon));

  const h = state.haikuOfTheBlock;
  if (h && h.block !== lastShownBlock) {
    lastShownBlock = h.block;
    $('block-label').innerHTML = `${t('haiku_of_block')} <b>#${h.block}</b>`;
    $('washi').classList.remove('silent');
    typewrite($('poem-text'), h.text);
    $('nonce-line').innerHTML = `${t('nonce')} <span>${h.nonce}</span>`;
  } else if (h) {
    $('block-label').innerHTML = `${t('haiku_of_block')} <b>#${h.block}</b>`;
  } else {
    $('block-label').textContent = t('waiting');
    $('washi').classList.add('silent');
    $('poem-text').textContent = c.isNeogenesis ? t('reborn') : t('silent');
  }
}

let twTimer = null;
function typewrite(el, text) {
  clearInterval(twTimer);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = text; return; }
  let i = 0;
  el.innerHTML = '<span class="caret">▌</span>';
  twTimer = setInterval(() => {
    i++;
    el.innerHTML = escapeHtml(text.slice(0, i)) + '<span class="caret">▌</span>';
    if (i >= text.length) { clearInterval(twTimer); }
  }, 34);
}
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/* ================= nav ================= */

let currentView = 'home';
function wireNav() {
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => showView(b.dataset.view));
}
function showView(v) {
  currentView = v;
  ['home', 'forge', 'anthology'].forEach(x => {
    $('view-' + x).hidden = x !== v;
    document.querySelector(`nav [data-view="${x}"]`).setAttribute('aria-current', x === v);
  });
  if (v === 'anthology') loadAnthology();
}

/* ================= FORGE ================= */

function wireForge() {
  $('tab-a').onclick = () => { active = 'a'; renderForge(); };
  $('tab-b').onclick = () => { active = 'b'; renderForge(); };
  $('clear-btn').onclick = () => { frames[active] = []; renderForge(); };
  $('submit-btn').onclick = submitPoem;
}

function renderForge() {
  const cur = frames[active];
  $('tab-a').setAttribute('aria-current', active === 'a');
  $('tab-b').setAttribute('aria-current', active === 'b');
  $('tab-a').classList.toggle('ok', HaikuClient.isValidFrame(frames.a) && frames.a.length > 0);
  $('tab-b').classList.toggle('ok', HaikuClient.isValidFrame(frames.b) && frames.b.length > 0);

  // composed strip
  const strip = $('compose-strip');
  strip.innerHTML = '';
  if (!cur.length) {
    strip.innerHTML = '<span class="hint"></span>';
    strip.querySelector('.hint').textContent = t('strip_hint');
  } else {
    cur.forEach((w, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (HaikuClient.displayWord(w) === '↵' ? ' nl' : '');
      b.textContent = HaikuClient.displayWord(w);
      b.onclick = () => { frames[active] = cur.slice(0, i); renderForge(); };
      strip.appendChild(b);
    });
  }

  // guided word bank
  const { next, canEnd } = HaikuClient.allowedNext(cur);
  const bank = $('bank');
  bank.innerHTML = '';
  const words = [...next].map(i => ({ i, w: HaikuClient.displayWord(i) }))
    .sort((x, y) => x.w.localeCompare(y.w));
  for (const { i, w } of words) {
    const b = document.createElement('button');
    b.className = w === '↵' ? 'nl' : '';
    b.textContent = w === '↵' ? '↵ line break' : w;
    b.onclick = () => { frames[active].push(i); renderForge(); };
    bank.appendChild(b);
  }
  $('bank-label').textContent = cur.length === 0
    ? t('bank_open')
    : (words.length ? t('bank_next') : (canEnd ? t('bank_done') : ''));

  // nonce badge + submit availability
  const okA = HaikuClient.isValidFrame(frames.a) && frames.a.length > 0;
  const okB = HaikuClient.isValidFrame(frames.b) && frames.b.length > 0;
  if (okA && okB) {
    const hex = HaikuClient.nonceHex(frames.a, frames.b);
    $('nonce-badge').innerHTML = `${t('badge_valid')}<br><b>${hex}</b>`;
    $('submit-btn').disabled = false;
  } else {
    $('nonce-badge').textContent = okA || okB ? t('badge_half') : '';
    $('submit-btn').disabled = true;
  }
}

async function submitPoem() {
  if (!tag) { openLogin(); return; }
  try {
    const r = await postJSON('/api/haiku', { tag, frames });
    toast(t('submitted', r.aeon));
    frames = { a: [], b: [] };
    renderForge();
    showView('anthology');
  } catch (e) {
    if (String(e.message).includes('unknown tag')) { openLogin(); return; }
    toast(e.message);
  }
}

/* ================= ANTHOLOGY ================= */

async function loadAnthology() {
  const j = await getJSON('/api/anthology');
  $('anth-sub').textContent = t('anth_sub', j.aeon);
  const el = $('anthology-list');
  if (!j.entries.length) {
    el.innerHTML = '<p class="note"></p>';
    el.querySelector('.note').textContent = t('anth_empty');
    return;
  }
  el.innerHTML = '';
  for (const e of j.entries) {
    const row = document.createElement('div');
    row.className = 'entry';
    row.innerHTML = `
      <div class="votes"><b>${e.votes}</b></div>
      <div>
        <p class="poem"></p>
        <p class="by">${t('by')} ${short(e.tag)} · ${t('nonce')} ${e.nonce_hex.slice(0, 12)}…</p>
      </div>`;
    row.querySelector('.poem').textContent = e.text;
    const vb = document.createElement('button');
    vb.textContent = t('vote');
    vb.onclick = () => vote(e.id);
    row.querySelector('.votes').appendChild(vb);
    el.appendChild(row);
  }
}

async function vote(id) {
  if (!tag) { openLogin(); return; }
  try {
    const r = await postJSON('/api/vote', { tag, submissionId: id });
    toast(t('voted', r.votesLeft));
    loadAnthology();
  } catch (e) { toast(e.message); }
}

/* ================= LOGIN ================= */

function wireLogin() {
  $('login-close').onclick = () => $('login-dlg').close();
  $('login-next').onclick = loginNext;
  $('who').onclick = openLogin;
}
function openLogin() {
  $('tag-input').value = tag || '';
  $('memo-step').hidden = true;
  $('login-next').textContent = t('continue');
  $('login-dlg').showModal();
}
async function loginNext() {
  const t = $('tag-input').value.trim().toLowerCase();
  if ($('memo-step').hidden) {
    try {
      const r = await postJSON('/api/auth/start', { tag: t });
      tag = t; localStorage.setItem('vk_tag', tag); updateWho();
      if (r.verified) { verified = true; toast(t('welcome_back')); $('login-dlg').close(); return; }
      $('memo-code').textContent = r.memo;
      $('memo-step').hidden = false;
      $('login-next').textContent = t('sent_check');
    } catch (e) { toast(e.message); }
  } else {
    try {
      const r = await postJSON('/api/auth/check', { tag });
      if (r.verified) { verified = true; toast(t('verified_ok')); $('login-dlg').close(); }
      else toast(t('not_seen'));
    } catch (e) { toast(e.message); }
  }
  updateWho();
}
function updateWho() {
  $('who').textContent = tag ? `${t('keeper')} ${short(tag)}` : t('sign_in');
  $('who').style.cursor = 'pointer';
}
function short(t) { return t.slice(0, 6) + '…' + t.slice(-4); }

/* ================= misc ================= */

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3500);
}

boot();
})();
