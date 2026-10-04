import { TIERS, rankOf, BADGES, CH_METRICS, QUICK_ROASTS, PALIERS, createApi, memoryStore, dayKey, addDays } from './core.js';

// ---------------- utils ----------------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const fmtH = min => { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
const fmtMoney = (v, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v || 0);
const ago = e => {
  const t = e.at || Date.parse(e.d + 'T23:00:00Z');
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'hier' : `il y a ${d} j`;
};
const tzOffset = () => -new Date().getTimezoneOffset();

// ---------------- sound ----------------
const Sound = {
  ctx: null, on: ls.get('rk_sound', true),
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.on = false; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  tone(f, d = .08, type = 'triangle', vol = .12, when = 0, slide = 0) {
    if (!this.on) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
  },
  click() { this.tone(880, .05, 'triangle', .09, 0, 1.5); },
  tab() { this.tone(520, .06, 'sine', .1, 0, 1.25); this.tone(1040, .05, 'sine', .04, .03); },
  pick() { this.tone(1200, .04, 'square', .035); },
  ok() { [660, 880, 1320].forEach((f, i) => this.tone(f, .14, 'triangle', .1, i * .07)); },
  bad() { this.tone(180, .22, 'sawtooth', .07, 0, .6); },
  roast() { this.tone(700, .12, 'square', .05, 0, .55); this.tone(500, .18, 'square', .05, .12, .5); },
  lp() { [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, .09, 'sine', .07, i * .045)); },
  promo() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, .35, 'triangle', .1, i * .09));
    [2093, 2637, 3136].forEach((f, i) => this.tone(f, .5, 'sine', .04, .6 + i * .05));
  },
  demo() { [440, 392, 330].forEach((f, i) => this.tone(f, .25, 'sine', .08, i * .12)); },
};

// ---------------- crests ----------------
let crestN = 0;
const GLYPHS = [
  '<path d="M44 66l16-11 16 11" class="g"/>',
  '<path d="M44 58l16-11 16 11M44 71l16-11 16 11" class="g"/>',
  '<path d="M44 52l16-11 16 11M44 64l16-11 16 11M44 76l16-11 16 11" class="g"/>',
  '<path d="M64 40 50 63h11l-5 20 15-25H60z" class="f"/>',
  '<path d="M60 38l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" class="f"/>',
  '<ellipse cx="60" cy="60" rx="20" ry="8" class="g"/><ellipse cx="60" cy="60" rx="20" ry="8" class="g" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="20" ry="8" class="g" transform="rotate(-60 60 60)"/><circle cx="60" cy="60" r="4" class="f"/>',
  '<circle cx="60" cy="60" r="19" fill="none" stroke="url(#IDR)" stroke-width="5" class="pulse"/><circle cx="60" cy="60" r="11" fill="#05000f"/>',
  '<path d="M41 72l-3-24 12 10 10-16 10 16 12-10-3 24z" class="f"/><path d="M41 77h38" class="g"/>',
];
export function crest(tier, div = '', opts = {}) {
  const T = TIERS[tier] || TIERS[0];
  const id = 'c' + (++crestN);
  const pips = div ? { III: 1, II: 2, I: 3 }[div] : 0;
  const wings = tier >= 3 ? `<g opacity=".95">
      <path d="M16 44 2 34l6 26 10 8z" fill="url(#${id}W)"/><path d="M104 44l14-10-6 26-10 8z" fill="url(#${id}W)"/>
      ${tier >= 5 ? `<path d="M16 62 4 66l12 14 6-4z" fill="url(#${id}W)"/><path d="M104 62l12 4-12 14-6-4z" fill="url(#${id}W)"/>` : ''}</g>` : '';
  const orbit = tier >= 5 ? `<g class="orbit"><circle cx="60" cy="6" r="2.6" fill="${T.glow}"/><circle cx="60" cy="114" r="1.8" fill="${T.c2}"/><circle cx="6" cy="60" r="1.6" fill="${T.glow}"/></g>` : '';
  const crown = tier === 7 ? `<path d="M44 12l6 7 10-11 10 11 6-7v10H44z" fill="url(#${id}S)" stroke="#fff6" stroke-width="1"/>` : '';
  return `<svg class="crest" viewBox="0 0 120 120" role="img" aria-label="${esc(T.name + (div ? ' ' + div : ''))}" style="--glow:${T.glow}">
  <defs>
    <linearGradient id="${id}S" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.c2}"/><stop offset=".55" stop-color="${T.c1}"/><stop offset="1" stop-color="${T.c1}"/></linearGradient>
    <linearGradient id="${id}W" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.c2}"/><stop offset="1" stop-color="${T.c1}" stop-opacity=".7"/></linearGradient>
    <linearGradient id="${id}H" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}G"><stop offset="0" stop-color="${T.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${T.glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}R"><stop offset="0" stop-color="${T.c2}"/><stop offset="1" stop-color="#ff58db"/></linearGradient>
    <clipPath id="${id}C"><path d="M60 10 102 33v50L60 108 18 83V33z"/></clipPath>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#${id}G)" class="${tier >= 4 ? 'pulse' : ''}"/>
  ${wings}${orbit}
  <path d="M60 10 102 33v50L60 108 18 83V33z" fill="url(#${id}S)" stroke="${T.c2}" stroke-opacity=".9" stroke-width="2"/>
  <path d="M60 21 92 39v38L60 96 28 77V39z" fill="${tier === 6 ? '#0a0018' : T.c1}" fill-opacity="${tier === 6 ? 1 : .55}" stroke="#fff" stroke-opacity=".18"/>
  <g clip-path="url(#${id}C)"><rect class="sheen" x="20" y="-10" width="34" height="140" fill="url(#${id}H)"/></g>
  <g style="--c:${T.c2}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <style>#${id}x .g{stroke:#fff;stroke-width:5}#${id}x .f{fill:#fff}</style>
    <g id="${id}x">${GLYPHS[tier].split('IDR').join(id + 'R')}</g>
  </g>
  ${[0, 1, 2].map(i => `<path d="M${48 + i * 12} 88l4 4-4 4-4-4z" fill="${i < pips ? '#fff' : '#fff'}" fill-opacity="${i < pips ? 1 : .2}"/>`).join('')}
  ${crown}
</svg>`;
}

// ---------------- API (real or demo) ----------------
const qs = new URLSearchParams(location.search);
const DEMO = !!window.RANKED_DEMO || qs.has('demo');
let demo = null;
async function buildDemo() {
  let t = Date.now() - 34 * 86400000;
  const store = memoryStore();
  const api = createApi(store, { now: () => t });
  const tz = 420;
  const s = await api('POST', '/setup', { league: 'Les Requins de Bangkok', name: 'Awen', emoji: '🦈', tz });
  const crew = [['Rafael', '🐺'], ['Yanis', '🦁'], ['Mehdi', '🐉'], ['Lucas', '🦅']];
  const toks = [s.json.token];
  for (const [name, emoji] of crew) toks.push((await api('POST', '/join', { invite: s.json.invite, name, emoji, tz })).json.token);
  const pid = k => toks[k].split('.')[1];
  await api('POST', '/settings', { token: toks[0], moneyLabel: 'CA agence', goalHours: 8 });
  await api('POST', '/settings', { token: toks[1], moneyLabel: 'PnL trading', showPalier: true });
  const rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  for (let day = 0; day <= 34; day++) {
    const key = dayKey(t, tz), last = day === 34;
    const f = last ? .45 : 1;
    const prof = [
      { claude: 150 + rnd() * 90, crm: 220 + rnd() * 120, work: 60, scroll: 25 + rnd() * 30, other: 30 },
      { trading: 260 + rnd() * 120, claude: 30, scroll: 80 + rnd() * 60, other: 40 },
      { work: day % 6 === 5 ? 40 : 300 + rnd() * 140, claude: 70, scroll: 60 + rnd() * 90, other: 50 },
      { work: day > 20 ? 120 + rnd() * 60 : 360, scroll: 140 + rnd() * 60, other: 60 },
      { work: day % 4 ? 280 : 20, claude: 40, scroll: 200, other: 70 },
    ];
    for (let k = 0; k < 5; k++) {
      const m = {}; for (const [c, v] of Object.entries(prof[k])) m[c] = Math.round(v * f);
      await api('POST', '/ingest', { token: toks[k], date: key, tz, minutes: m, late: k === 0 && day % 3 === 0 ? 50 : 0 });
    }
    if (!last) {
      await api('POST', '/money', { token: toks[0], date: key, value: Math.round(900 + day * 22 + rnd() * 300) });
      await api('POST', '/money', { token: toks[1], date: key, value: Math.round(rnd() < .35 ? -150 - rnd() * 200 : 120 + rnd() * 260) });
      await api('POST', '/money', { token: toks[2], date: key, value: Math.round(300 + rnd() * 200) });
      if (day < 22) await api('POST', '/money', { token: toks[3], date: key, value: Math.round(400 + rnd() * 100) });
    }
    if (day === 26) {
      await api('POST', '/challenge', { token: toks[1], action: 'create', to: pid(0), metric: 'hours', days: 3, stake: 'un resto à Thonglor' });
      const st = await api('POST', '/state', { token: toks[0] });
      await api('POST', '/challenge', { token: toks[0], action: 'accept', id: st.json.challenges[0].id });
    }
    if (day === 31) {
      await api('POST', '/challenge', { token: toks[2], action: 'create', to: pid(0), metric: 'antiscroll', days: 7, stake: 'l\'apéro' });
      const st = await api('POST', '/state', { token: toks[0] });
      await api('POST', '/challenge', { token: toks[0], action: 'accept', id: st.json.challenges.find(c => c.status === 'pending').id });
    }
    if (day === 33) {
      await api('POST', '/post', { token: toks[1], to: pid(0), text: 'Profite de ta place, elle est à moi la semaine pro.' });
      await api('POST', '/challenge', { token: toks[3], action: 'create', to: pid(0), metric: 'points', days: 1, stake: 'un mango sticky rice' });
    }
    if (!last) t += 86400000;
  }
  t = Date.now();
  return { api, token: toks[0], tick: () => {} };
}
async function call(path, body = {}) {
  if (DEMO) {
    demo ||= await buildDemo();
    const r = await demo.api('POST', path, body);
    if (r.status >= 400) throw new Error(r.json.error);
    return r.text != null ? r : r.json;
  }
  const res = await fetch('/api' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (path === '/agent' && res.ok) return { text: await res.text() };
  let j = {}; try { j = await res.json(); } catch {}
  if (!res.ok) throw Object.assign(new Error(j.error || `Erreur ${res.status}`), { status: res.status });
  return j;
}

// ---------------- state ----------------
const S = { token: DEMO ? null : ls.get('rk_token'), data: null, tab: ls.get('rk_tab', 'ligue'), duel: { metric: 'hours', days: 3 }, feedTo: null, loading: false };

function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : ''); el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
}

async function refresh(silent = false) {
  if (!S.token) return render();
  try {
    const prev = S.data;
    S.data = await call('/state', { token: S.token });
    checkRankChange(prev);
    render();
  } catch (e) {
    if (e.status === 401) { S.token = null; ls.del('rk_token'); render(); toast(e.message, true); }
    else if (!silent) toast(e.message, true);
  }
}

function meStanding() { return S.data && S.data.standings.find(s => s.id === S.data.me.id); }
function checkRankChange(prev) {
  const me = meStanding(); if (!me) return;
  const key = 'rk_lastrank_' + S.data.league.id;
  const last = ls.get(key);
  const nowR = { lp: me.lp, tier: me.rank.tier, label: me.rank.label };
  ls.set(key, nowR);
  if (!last) return;
  const lastIdx = rankIndex(last.lp), nowIdx = rankIndex(me.lp);
  if (nowIdx > lastIdx) promoOverlay(me, true);
  else if (nowIdx < lastIdx) promoOverlay(me, false);
  else if (prev && me.lp > last.lp) Sound.lp();
}
const rankIndex = lp => { const r = rankOf(lp); return r.tier * 3 + ({ III: 0, II: 1, I: 2, '': 0 }[r.div]); };

// ---------------- render ----------------
const ICONS = {
  ligue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="m8 13 4-3 4 3"/></svg>',
  duels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5 21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/></svg>',
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  moi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
};
const CAT_COLORS = { claude: '#ff9a5a', crm: '#ff58db', trading: '#55f2ff', work: '#8dff6a', scroll: '#ffd25a', other: '#6d73b0' };
const EV_ICON = { promo: '⬆️', demo: '⬇️', overtake: '🏎️', streakBreak: '💔', streak: '🔥', record: '🎯', inactive: '💤', chWin: '🏆', joker: '🧘', post: '💬' };
const EMOJIS = ['🦊', '🐺', '🦁', '🐉', '🦅', '🐯', '🦈', '🐍'];

function render() {
  const app = $('#app'), nav = $('#nav');
  if (!S.token && !DEMO) { nav.hidden = true; app.innerHTML = onboarding(); return; }
  if (!S.data) { nav.hidden = true; app.innerHTML = `<div class="onb"><div class="title">RANKED</div><p class="muted">Chargement de la ligue…</p></div>`; return; }
  nav.hidden = false;
  const pending = S.data.challenges.filter(c => c.status === 'pending' && c.to === S.data.me.id).length;
  nav.innerHTML = [['ligue', 'Ligue'], ['duels', 'Duels'], ['feed', 'Feed'], ['moi', 'Moi']].map(([k, l]) =>
    `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span>${k === 'duels' && pending ? `<span class="badge">${pending}</span>` : ''}</button>`).join('');
  const d = S.data;
  app.innerHTML = `
    <header class="top">
      <span class="brand">RANKED</span>
      <span class="league">${esc(d.league.name)}</span>
      <span class="season num">Saison ${d.season.n}, jour ${d.season.day}/28</span>
      <button class="iconbtn" data-act="sound" aria-label="${Sound.on ? 'Couper le son' : 'Activer le son'}">${Sound.on ? ICONS.sound : ICONS.mute}</button>
    </header>
    ${DEMO ? '<div class="demo-banner">Mode démo : ligue fictive pour voir le rendu. Rien n\'est enregistré.</div>' : ''}
    ${S.tab === 'ligue' ? viewLigue() : S.tab === 'duels' ? viewDuels() : S.tab === 'feed' ? viewFeed() : viewMoi()}`;
}

function onboarding() {
  const inv = qs.get('invite');
  const parade = TIERS.map((t, i) => crest(i, i < 7 ? 'I' : '')).join('');
  if (inv) {
    return `<div class="onb">
      <div class="title">RANKED</div>
      <div class="parade">${parade}</div>
      <h2 id="invTitle">On t'invite dans une ligue.</h2>
      <p class="muted" id="invSub">Choisis ton pseudo et ton totem. Tout le monde commence en Rouille.</p>
      <div class="card stack">
        <label class="f">Ton pseudo<input type="text" id="jName" maxlength="18" autocomplete="nickname" placeholder="Rafael"></label>
        <div class="f"><span class="small muted">Ton totem</span><div class="chips" id="jEmoji">${EMOJIS.map((e, i) => `<button class="pick" data-emoji="${e}" aria-pressed="${i === 1}">${e}</button>`).join('')}</div></div>
        <label class="f">Ce que tu suis comme argent<input type="text" id="jMoney" maxlength="18" placeholder="PnL trading, CA agence…"></label>
        <button class="btn primary" data-act="join">Entrer dans la ligue</button>
      </div></div>`;
  }
  return `<div class="onb">
    <div class="title">RANKED</div>
    <div class="parade">${parade}</div>
    <h2>Ton business. Ta ligue. Tes potes en face.</h2>
    <p class="muted">Tes heures de boulot comptées toutes seules. Ta progression en argent, jamais tes montants. Des rangs, des duels, et de quoi chambrer.</p>
    <div class="card stack">
      <h3>Créer une ligue</h3>
      <div class="grid2">
        <label class="f">Nom de la ligue<input type="text" id="sLeague" maxlength="32" placeholder="Les Requins"></label>
        <label class="f">Ton pseudo<input type="text" id="sName" maxlength="18" placeholder="Awen"></label>
      </div>
      <div class="f"><span class="small muted">Ton totem</span><div class="chips" id="sEmoji">${EMOJIS.map((e, i) => `<button class="pick" data-emoji="${e}" aria-pressed="${i === 6}">${e}</button>`).join('')}</div></div>
      <button class="btn primary" data-act="setup">Créer la ligue</button>
    </div>
    <div class="card stack">
      <h3>J'ai déjà un code perso</h3>
      <label class="f">Code perso<input type="password" id="lToken" autocomplete="off" placeholder="colle ton code ici"></label>
      <button class="btn" data-act="login">Me reconnecter</button>
    </div>
    <a class="small muted" href="?demo">Voir une ligue de démo</a>
  </div>`;
}

function viewLigue() {
  const d = S.data, me = meStanding();
  const T = TIERS[me.rank.tier];
  const nextLabel = me.rank.tier === 7 ? 'Sommet atteint' : `${me.rank.toNext} LP avant ${rankOf(me.lp + me.rank.toNext).label}`;
  const provW = Math.min(100 - me.rank.progress, Math.max(0, me.provisional));
  const base = me.rank.progress - Math.min(me.rank.progress, provW);
  return `
  <section class="hero" style="--tier-glow:${T.glow};--tier-c1:${T.c1}">
    ${crest(me.rank.tier, me.rank.div)}
    <div class="barwrap">
      <div class="muted small">#${me.pos} sur ${d.standings.length}${me.palier ? `, palier du mois ${esc(me.palier)}` : ''}</div>
      <div class="tier">${esc(T.name)} <span>${esc(me.rank.div)}</span></div>
      <div class="meta">
        <span class="chip num">${me.lp} LP</span>
        ${me.provisional ? `<span class="chip up num">+${me.provisional} LP aujourd'hui</span>` : `<span class="chip">Aujourd'hui pas encore lancé</span>`}
        ${me.streak ? `<span class="chip hot num">🔥 ${me.streak} j</span>` : ''}
      </div>
      <div class="bar" aria-label="Progression dans la division"><i style="width:${base}%"></i>${provW ? `<b style="left:${base}%;width:${provW}%"></b>` : ''}</div>
      <div class="barlabel"><span>${me.rank.progress}/100</span><span>${esc(nextLabel)}</span></div>
    </div>
  </section>
  <section>
    <div class="ladder">${d.standings.map(rowHTML).join('')}</div>
  </section>
  <section class="section">
    <h2>Aujourd'hui en heures</h2>
    <div class="card stack">${todayBoard()}</div>
  </section>
  ${d.seasonsHistory.length ? `<section class="section"><h2>Palmarès des saisons</h2><div class="card">${d.seasonsHistory.slice().reverse().map(s => `<div class="kv"><span>Saison ${s.season}</span><span>${s.podium.map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(nameOf(p.id))}`).join('  ')}</span></div>`).join('')}</div></section>` : ''}
  <p class="small faint" style="margin-top:22px">Points du jour : 50 % progression argent vs tes 4 dernières semaines, 30 % heures de boulot (8 h max), 20 % régularité. Le rang récompense ton résultat, pas les risques pris.</p>`;
}
const nameOf = id => (S.data.standings.find(s => s.id === id) || {}).name || 'Ancien joueur';
function rowHTML(s) {
  const me = s.id === S.data.me.id;
  const money = s.moneyPct === null || s.moneyPct === undefined ? '' : `<span class="num" style="color:${s.moneyPct >= 0 ? 'var(--lime)' : 'var(--red)'}">${s.moneyPct >= 0 ? '▲' : '▼'} ${Math.abs(s.moneyPct)} %</span>`;
  return `<button class="row ${me ? 'me' : ''}" data-player="${s.id}">
    <span class="pos">${s.pos}</span>
    ${crest(s.rank.tier, s.rank.div)}
    <span class="who">
      <span class="name">${esc(s.emoji)} ${esc(s.name)}${me ? ' <span class="faint small">(toi)</span>' : ''}</span>
      <span class="sub"><span><span class="dot ${s.agentOnline ? 'on' : ''}"></span>${fmtH(s.today.work)}</span>${s.streak ? `<span>🔥 ${s.streak}</span>` : ''}${money}${s.palier ? `<span>💰 ${esc(s.palier)}</span>` : ''}</span>
    </span>
    <span class="lp"><span class="num">${s.lp}</span><br><span class="small muted">${esc(s.rank.label)}</span></span>
  </button>`;
}
function todayBoard() {
  const st = S.data.standings;
  const max = Math.max(60, ...st.map(s => s.today.work));
  const top = st.slice().sort((a, b) => b.today.work - a.today.work);
  return top.map(s => `<div class="cat"><span>${esc(s.emoji)} ${esc(s.name)}</span>
    <span class="track" style="display:flex">${['claude', 'crm', 'trading', 'work'].map(c => `<i style="width:${(s.today.cats[c] / max) * 100}%;background:${CAT_COLORS[c]}" title="${c}"></i>`).join('')}</span>
    <span class="num small" style="text-align:right">${fmtH(s.today.work)}</span></div>`).join('') +
    `<div class="chips small">${S.data.cats.filter(c => c.work).map(c => `<span class="chip"><span class="dot" style="background:${CAT_COLORS[c.id]}"></span>${esc(c.label)}</span>`).join('')}</div>`;
}

function playerSheet(id) {
  const s = S.data.standings.find(x => x.id === id); if (!s) return;
  const me = id === S.data.me.id;
  const cats = S.data.cats;
  const max = Math.max(60, ...cats.map(c => s.today.cats[c.id] || 0));
  openSheet(`
    <div style="display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center">
      ${crest(s.rank.tier, s.rank.div)}
      <div><h2>${esc(s.emoji)} ${esc(s.name)}</h2><div class="muted">${esc(s.rank.label)}, ${s.lp} LP, #${s.pos}</div>
      <div class="meta chips" style="margin-top:8px">${s.agentOnline ? '<span class="chip up">Agent en ligne</span>' : s.agentEver ? '<span class="chip">Agent hors ligne</span>' : '<span class="chip">Pas d\'agent : heures non mesurées</span>'}</div></div>
    </div>
    <div class="stack" style="margin-top:16px">
      ${cats.map(c => `<div class="cat"><span>${esc(c.label)}</span><span class="track"><i style="width:${((s.today.cats[c.id] || 0) / max) * 100}%;background:${CAT_COLORS[c.id]}"></i></span><span class="num small" style="text-align:right">${fmtH(s.today.cats[c.id])}</span></div>`).join('')}
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="card"><div class="small muted">Moyenne 7 jours</div><div class="num" style="font-size:1.4rem">${s.week.pts} pts</div></div>
      <div class="card"><div class="small muted">${esc(s.moneyLabel)}</div><div class="num" style="font-size:1.4rem">${s.moneyPct === null || s.moneyPct === undefined ? 'pas encore' : (s.moneyPct >= 0 ? '+' : '') + s.moneyPct + ' %'}</div></div>
    </div>
    <div style="margin-top:14px">${sparkHTML(s.spark)}</div>
    ${s.badges.length ? `<div class="chips" style="margin-top:14px">${s.badges.map(b => `<span class="chip" title="${esc(BADGES[b].desc)}">🏅 ${esc(BADGES[b].name)}</span>`).join('')}</div>` : ''}
    ${me ? '' : `<div class="grid2" style="margin-top:18px">
      <button class="btn primary" data-act="duelWith" data-id="${s.id}">Défier</button>
      <button class="btn" data-act="roastWith" data-id="${s.id}">Chambrer</button></div>`}
  `);
}
function sparkHTML(arr) {
  const m = Math.max(1, ...arr);
  return `<div class="spark" aria-label="Points des 14 derniers jours">${arr.map((v, i) => `<i class="${i === arr.length - 1 ? 'today' : ''}" style="height:${Math.max(4, (v / m) * 100)}%" title="${v} pts"></i>`).join('')}</div>`;
}

function viewDuels() {
  const d = S.data, meId = d.me.id;
  const others = d.standings.filter(s => s.id !== meId);
  const list = d.challenges.filter(c => !['declined', 'cancelled'].includes(c.status) || Date.now() - c.createdAt < 3 * 86400000);
  return `
  <section class="section" style="margin-top:10px">
    <h2>Lancer un duel</h2>
    <div class="card stack">
      <div class="f"><span class="small muted">Contre qui</span><div class="chips" id="dTo">${others.map((s, i) => `<button class="pick" data-to="${s.id}" aria-pressed="${S.duel.to ? S.duel.to === s.id : i === 0}">${esc(s.emoji)} ${esc(s.name)}</button>`).join('') || '<span class="muted small">Invite des potes d\'abord.</span>'}</div></div>
      <div class="f"><span class="small muted">Sur quoi</span><div class="chips" id="dMetric">${Object.entries(CH_METRICS).map(([k, m]) => `<button class="pick" data-metric="${k}" aria-pressed="${S.duel.metric === k}">${esc(m.label)}</button>`).join('')}</div></div>
      <div class="f"><span class="small muted">Durée</span><div class="chips" id="dDays">${[1, 3, 7].map(n => `<button class="pick" data-days="${n}" aria-pressed="${S.duel.days === n}">${n} jour${n > 1 ? 's' : ''}</button>`).join('')}</div></div>
      <label class="f">La mise<input type="text" id="dStake" maxlength="40" placeholder="l'apéro, un resto…"></label>
      <button class="btn primary" data-act="duel" ${others.length ? '' : 'disabled'}>Envoyer le défi</button>
      <p class="small faint" style="margin:0">Anti-scroll : le moins de scroll gagne, mais un jour à moins de 2 h de boulot compte comme 10 h de scroll. PC éteint, pas de victoire.</p>
    </div>
  </section>
  <section class="section">
    <h2>Tes duels</h2>
    <div class="stack">${list.length ? list.map(duelHTML).join('') : '<div class="empty">Aucun duel. Le premier qui défie a déjà un avantage psychologique.</div>'}</div>
  </section>`;
}
function duelHTML(c) {
  const meId = S.data.me.id, A = S.data.standings.find(s => s.id === c.from) || { name: '?', emoji: '' }, B = S.data.standings.find(s => s.id === c.to) || { name: '?', emoji: '' };
  const m = CH_METRICS[c.metric];
  const fmt = v => c.metric === 'hours' ? fmtH(v) : c.metric === 'antiscroll' ? fmtH(v) + ' scroll' : `${v} pts`;
  const status = c.status === 'pending' ? (c.to === meId ? 'Il t\'attend' : 'En attente de réponse') : c.status === 'active' ? `Jusqu'au ${c.endDay.slice(8)}/${c.endDay.slice(5, 7)} inclus` : c.status === 'done' ? (c.winner ? `Victoire de ${esc(nameOf(c.winner))}` : 'Égalité') : c.status === 'declined' ? 'Refusé' : 'Annulé';
  const tot = (c.va || 0) + (c.vb || 0);
  const pa = tot ? (c.metric === 'antiscroll' ? (c.vb / tot) : (c.va / tot)) * 100 : 50;
  return `<div class="duel">
    <div class="small muted" style="display:flex;justify-content:space-between;gap:8px"><span>${esc(m.label)}, ${c.days} j, mise : ${esc(c.stake)}</span><span>${status}</span></div>
    <div class="vs" style="margin-top:10px">
      <div class="side">${esc(A.emoji)} ${esc(A.name)}${c.va !== undefined ? `<span class="num">${fmt(c.va)}</span>` : ''}</div>
      <div class="x">VS</div>
      <div class="side">${esc(B.emoji)} ${esc(B.name)}${c.vb !== undefined ? `<span class="num">${fmt(c.vb)}</span>` : ''}</div>
    </div>
    ${c.status === 'active' || c.status === 'done' ? `<div class="duelbar"><i style="width:${pa}%"></i><i style="width:${100 - pa}%"></i></div>` : ''}
    ${c.status === 'pending' && c.to === meId ? `<div class="grid2" style="margin-top:12px"><button class="btn primary sm" data-act="accept" data-id="${c.id}">Accepter</button><button class="btn sm" data-act="decline" data-id="${c.id}">Refuser</button></div>` : ''}
    ${c.status === 'pending' && c.from === meId ? `<div style="margin-top:10px"><button class="btn ghost sm" data-act="cancelDuel" data-id="${c.id}">Annuler</button></div>` : ''}
  </div>`;
}

function viewFeed() {
  const d = S.data;
  const others = d.standings.filter(s => s.id !== d.me.id);
  return `
  <section class="section" style="margin-top:10px">
    <h2>Chambrer</h2>
    <div class="card stack">
      <div class="chips" id="fTo"><button class="pick" data-fto="" aria-pressed="${!S.feedTo}">Toute la ligue</button>${others.map(s => `<button class="pick" data-fto="${s.id}" aria-pressed="${S.feedTo === s.id}">${esc(s.emoji)} ${esc(s.name)}</button>`).join('')}</div>
      <textarea id="fText" maxlength="200" placeholder="Ta vanne…"></textarea>
      <div class="chips">${QUICK_ROASTS.map(r => `<button class="pick" data-quick="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <button class="btn primary" data-act="post">Envoyer</button>
    </div>
  </section>
  <section class="section">
    <h2>Ce qui se passe</h2>
    <div class="feed">${d.feed.length ? d.feed.map(e => {
      const from = e.from ? d.standings.find(s => s.id === e.from) : null;
      const to = e.to ? d.standings.find(s => s.id === e.to) : null;
      const head = e.type === 'post' && from ? `<b>${esc(from.emoji)} ${esc(from.name)}</b>${to ? ` <span class="muted">à ${esc(to.name)}</span>` : ''}<br>` : '';
      return `<div class="ev ${e.type}"><span class="ico" aria-hidden="true">${e.type === 'post' && !from ? '📣' : EV_ICON[e.type] || '•'}</span><div>${head}${esc(e.text)}<div class="when">${ago(e)}</div></div></div>`;
    }).join('') : '<div class="empty">Rien encore. Lance un duel ou une vanne.</div>'}</div>
  </section>`;
}

function viewMoi() {
  const d = S.data, me = d.me, st = meStanding();
  const today = me.history[me.history.length - 1] || { cats: {}, wm: 0 };
  const max = Math.max(60, ...d.cats.map(c => today.cats[c.id] || 0));
  const isAdmin = me.role === 'admin';
  const inviteUrl = d.league.invite ? `${location.origin}${location.pathname}?invite=${d.league.invite}` : '';
  const pal = me.palier;
  const kwText = id => (me.kw[id] || []).join(', ');
  return `
  <section class="section" style="margin-top:10px">
    <h2>Ta journée</h2>
    <div class="card stack">
      ${d.cats.map(c => `<div class="cat"><span>${esc(c.label)}</span><span class="track"><i style="width:${((today.cats[c.id] || 0) / max) * 100}%;background:${CAT_COLORS[c.id]}"></i></span><span class="num small" style="text-align:right">${fmtH(today.cats[c.id])}</span></div>`).join('')}
      <div class="kv"><span>Boulot compté</span><span class="num">${fmtH(Math.min(today.wm, 480))} / objectif ${me.goalHours} h</span></div>
      <div class="small muted">14 derniers jours</div>
      ${sparkHTML(st.spark)}
    </div>
  </section>

  <section class="section">
    <h2>${esc(me.moneyLabel)}</h2>
    <div class="card stack">
      <div class="grid2">
        <label class="f">Montant du jour (${me.currency})<input type="text" inputmode="decimal" id="mVal" placeholder="1250"></label>
        <label class="f">Jour<select id="mDay">${[0, 1, 2, 3].map(i => { const k = addDays(me.today, -i); return `<option value="${k}">${i === 0 ? 'Aujourd\'hui' : i === 1 ? 'Hier' : k.slice(8) + '/' + k.slice(5, 7)}</option>`; }).join('')}</select></label>
      </div>
      <button class="btn primary" data-act="money">Enregistrer</button>
      <p class="small muted" style="margin:0">Toi seul vois tes montants. La ligue voit ta progression en % contre tes 4 dernières semaines. Un PnL négatif se saisit avec un moins.</p>
      ${pal ? `<div class="kv"><span>Palier du mois</span><span class="num">${esc(pal.name || 'Pas encore classé')}${pal.total !== undefined ? ` (${fmtMoney(pal.total, me.currency)})` : ''}</span></div>
      ${pal.next ? `<div class="kv"><span>Prochain palier</span><span class="num">${fmtMoney(pal.next, me.currency)} / mois</span></div>` : ''}
      <div class="kv"><span>Meilleur palier</span><span>${esc(pal.best)}</span></div>
      <label class="kv" style="cursor:pointer"><span>Montrer mon palier à la ligue</span><input type="checkbox" id="showPal" ${me.showPalier ? 'checked' : ''}></label>` : ''}
    </div>
  </section>

  <section class="section">
    <h2>Agent PC (heures automatiques)</h2>
    <div class="card stack">
      <div class="kv"><span>Statut</span><span>${st.agentOnline ? '<span class="dot on"></span>En ligne' : st.agentEver ? '<span class="dot"></span>Hors ligne' : 'Pas encore installé'}</span></div>
      <ol class="steps small">
        <li>Télécharge le fichier sur ton PC Windows.</li>
        <li>Double-clique dessus. Si Windows prévient, clique « Informations complémentaires » puis « Exécuter quand même ».</li>
        <li>C'est tout. Il tourne en fond et redémarre avec le PC.</li>
      </ol>
      <div class="grid2"><button class="btn primary" data-act="agent">Télécharger l'agent Windows</button><button class="btn ghost" data-act="agentUninstall">Désinstaller</button></div>
      <p class="small muted" style="margin:0">Il lit la fenêtre active toutes les 5 s pour classer ton temps (Claude, CRM, trading, boulot, scroll). Les titres restent sur ton PC, seules les minutes partent. Clavier et souris immobiles 5 min = pause. Téléphone : Apple et Google ne laissent pas lire le temps d'écran automatiquement, donc il n'est pas compté.</p>
    </div>
  </section>

  <section class="section">
    <h2>Réglages</h2>
    <div class="card stack">
      <div class="grid2">
        <label class="f">Pseudo<input type="text" id="setName" maxlength="18" value="${esc(me.name)}"></label>
        <label class="f">Nom de ton argent<input type="text" id="setMoney" maxlength="18" value="${esc(me.moneyLabel)}"></label>
      </div>
      <div class="f"><span class="small muted">Totem</span><div class="chips" id="setEmoji">${EMOJIS.map(e => `<button class="pick" data-emoji="${e}" aria-pressed="${me.emoji === e}">${e}</button>`).join('')}</div></div>
      <div class="grid2">
        <label class="f">Objectif boulot / jour : <b class="num" id="goalV">${me.goalHours} h</b><input type="range" id="setGoal" min="2" max="12" value="${me.goalHours}"></label>
        <label class="f">Devise<select id="setCur"><option ${me.currency === 'EUR' ? 'selected' : ''}>EUR</option><option ${me.currency === 'USD' ? 'selected' : ''}>USD</option></select></label>
      </div>
      <details><summary class="small muted" style="cursor:pointer">Mots-clés perso (ex. « instagram » pour compter Insta comme boulot)</summary>
        <div class="stack" style="margin-top:10px">${d.cats.filter(c => c.id !== 'other').map(c => `<label class="f">${esc(c.label)}<input type="text" data-kw="${c.id}" value="${esc(kwText(c.id))}" placeholder="mots séparés par des virgules"></label>`).join('')}</div>
      </details>
      <button class="btn" data-act="saveSettings">Enregistrer les réglages</button>
    </div>
  </section>

  ${d.moneyLog.some(p => p.days.length) ? `<section class="section"><h2>Montants à vérifier</h2><div class="card">
    <p class="small muted" style="margin-top:0">Tu doutes d'un montant ? Conteste. Si la moitié de la ligue conteste, ce jour ne compte plus.</p>
    ${d.moneyLog.filter(p => p.days.length).map(p => p.days.slice(0, 3).map(x => `<div class="kv"><span>${esc(nameOf(p.id))}, ${x.d.slice(8)}/${x.d.slice(5, 7)}</span>${x.void ? '<span class="faint">Annulé</span>' : x.contested.includes(me.id) ? '<span class="faint">Contesté</span>' : `<button class="btn ghost sm" data-act="contest" data-id="${p.id}" data-d="${x.d}">Contester</button>`}</div>`).join('')).join('')}
  </div></section>` : ''}

  ${isAdmin ? `<section class="section"><h2>Admin de la ligue</h2><div class="card stack">
    <label class="f">Lien d'invitation<input type="text" readonly value="${esc(inviteUrl)}" id="invUrl"></label>
    <div class="grid2"><button class="btn primary" data-act="copyInvite">Copier le lien</button><button class="btn ghost" data-act="newInvite">Nouveau lien (l'ancien meurt)</button></div>
    ${d.standings.filter(s => s.id !== me.id).map(s => `<div class="kv"><span>${esc(s.emoji)} ${esc(s.name)}</span><button class="btn danger sm" data-act="remove" data-id="${s.id}">Retirer</button></div>`).join('')}
  </div></section>` : ''}

  <section class="section"><h2>Ton code perso</h2><div class="card stack">
    <p class="small muted" style="margin:0">Il sert à te reconnecter sur ton téléphone. Ne le donne à personne : il permet d'écrire à ta place.</p>
    <div class="grid2"><button class="btn" data-act="copyToken">Copier mon code</button><button class="btn danger" data-act="logout">Me déconnecter</button></div>
  </div></section>`;
}

// ---------------- overlays ----------------
function openSheet(html) {
  closeSheet();
  const s = document.createElement('div');
  s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
  document.body.appendChild(s);
  const f = s.querySelector('button, input'); if (f) f.focus({ preventScroll: true });
}
function closeSheet() { const s = $('#scrim'); if (s) s.remove(); }
function promoOverlay(me, up) {
  up ? Sound.promo() : Sound.demo();
  const o = document.createElement('div');
  o.className = 'levelup'; o.setAttribute('role', 'dialog');
  o.innerHTML = `<div>${crest(me.rank.tier, me.rank.div)}<h1 style="color:${TIERS[me.rank.tier].glow}">${up ? 'PROMOTION' : 'Rétrogradé'}</h1><p>${esc(me.rank.label)}, ${me.lp} LP</p><button class="btn ${up ? 'gold' : ''}" data-act="closePromo">${up ? 'Je le savais' : 'Je remonte demain'}</button></div>`;
  document.body.appendChild(o);
  if (up) confetti(TIERS[me.rank.tier]);
}
function confetti(T) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = [T.c2, T.glow, '#fff', '#ffd25a', '#55f2ff', '#ff58db'];
  const P = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * .42, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 3, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  let f = 0;
  (function loop() {
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); }
    if (++f < 170) requestAnimationFrame(loop); else c.remove();
  })();
}

// ---------------- actions ----------------
const pressedIn = sel => { const b = document.querySelector(`${sel} [aria-pressed=true]`); return b ? b.dataset : {}; };
async function act(name, el) {
  const T = S.token || (demo && demo.token);
  try {
    switch (name) {
      case 'sound': Sound.on = !Sound.on; ls.set('rk_sound', Sound.on); if (Sound.on) Sound.ok(); render(); return;
      case 'setup': {
        const r = await call('/setup', { league: $('#sLeague').value, name: $('#sName').value, emoji: pressedIn('#sEmoji').emoji, tz: tzOffset() });
        S.token = r.token; ls.set('rk_token', r.token); Sound.promo(); S.tab = 'moi'; await refresh(); toast('Ligue créée. Envoie le lien d\'invitation à tes potes.'); return;
      }
      case 'join': {
        const r = await call('/join', { invite: qs.get('invite'), name: $('#jName').value, emoji: pressedIn('#jEmoji').emoji, moneyLabel: $('#jMoney').value, tz: tzOffset() });
        S.token = r.token; ls.set('rk_token', r.token); history.replaceState(null, '', location.pathname); Sound.promo(); S.tab = 'moi'; await refresh(); toast('Bienvenue. Installe l\'agent pour que tes heures comptent.'); return;
      }
      case 'login': {
        const t = $('#lToken').value.trim(); S.token = t; await refresh(); if (S.data) { ls.set('rk_token', t); Sound.ok(); } return;
      }
      case 'duel': {
        await call('/challenge', { token: T, action: 'create', to: pressedIn('#dTo').to, metric: pressedIn('#dMetric').metric, days: Number(pressedIn('#dDays').days), stake: $('#dStake').value });
        Sound.ok(); toast('Défi envoyé. La pression monte.'); break;
      }
      case 'accept': await call('/challenge', { token: T, action: 'accept', id: el.dataset.id }); Sound.promo(); toast('Duel accepté.'); break;
      case 'decline': await call('/challenge', { token: T, action: 'decline', id: el.dataset.id }); Sound.demo(); break;
      case 'cancelDuel': await call('/challenge', { token: T, action: 'cancel', id: el.dataset.id }); break;
      case 'post': {
        const text = $('#fText').value.trim(); if (!text) { Sound.bad(); toast('Écris ta vanne d\'abord.', true); return; }
        await call('/post', { token: T, text, to: S.feedTo }); Sound.roast(); toast('Envoyé.'); break;
      }
      case 'duelWith': S.duel.to = el.dataset.id; closeSheet(); S.tab = 'duels'; ls.set('rk_tab', S.tab); render(); return;
      case 'roastWith': S.feedTo = el.dataset.id; closeSheet(); S.tab = 'feed'; ls.set('rk_tab', S.tab); render(); $('#fText').focus(); return;
      case 'money': {
        const v = $('#mVal').value.trim(); if (!v) { Sound.bad(); toast('Mets un montant.', true); return; }
        await call('/money', { token: T, value: v, date: $('#mDay').value }); Sound.ok(); toast('Enregistré.'); break;
      }
      case 'agent': case 'agentUninstall': {
        if (DEMO) { toast('En démo, pas d\'agent. Sur ta vraie ligue, ça télécharge un fichier .cmd.'); return; }
        const r = await call('/agent', { token: T, server: location.origin, mode: name === 'agentUninstall' ? 'uninstall' : 'install' });
        const blob = new Blob([r.text], { type: 'application/octet-stream' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name === 'agent' ? 'RANKED-agent.cmd' : 'RANKED-desinstaller.cmd';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        Sound.ok(); toast('Fichier téléchargé. Double-clique dessus.'); return;
      }
      case 'saveSettings': {
        const kw = {}; document.querySelectorAll('[data-kw]').forEach(i => { kw[i.dataset.kw] = i.value.split(',').map(s => s.trim()).filter(Boolean); });
        await call('/settings', { token: T, name: $('#setName').value, moneyLabel: $('#setMoney').value, emoji: pressedIn('#setEmoji').emoji, goalHours: Number($('#setGoal').value), currency: $('#setCur').value, kw, tz: tzOffset() });
        Sound.ok(); toast('Réglages enregistrés. L\'agent les prend sous 30 min.'); break;
      }
      case 'contest': await call('/contest', { token: T, pid: el.dataset.id, date: el.dataset.d }); Sound.roast(); toast('Contesté.'); break;
      case 'copyInvite': await copy($('#invUrl').value); toast('Lien copié. Balance-le dans le groupe.'); Sound.ok(); return;
      case 'newInvite': await call('/admin', { token: T, action: 'newInvite' }); Sound.ok(); break;
      case 'remove': await call('/admin', { token: T, action: 'remove', pid: el.dataset.id }); Sound.demo(); break;
      case 'copyToken': await copy(T); toast('Code copié. Colle-le sur ton téléphone pour te connecter.'); Sound.ok(); return;
      case 'logout': S.token = null; S.data = null; ls.del('rk_token'); render(); return;
      case 'closePromo': document.querySelector('.levelup')?.remove(); return;
      default: return;
    }
    await refresh();
  } catch (e) { Sound.bad(); toast(e.message || 'Erreur', true); }
}
async function copy(t) { try { await navigator.clipboard.writeText(t); } catch { const i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } }

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { S.tab = tab.dataset.tab; ls.set('rk_tab', S.tab); Sound.tab(); render(); scrollTo({ top: 0 }); return; }
  const pick = e.target.closest('.pick');
  if (pick) {
    Sound.pick();
    if (pick.dataset.quick) { const t = $('#fText'); t.value = pick.dataset.quick; t.focus(); return; }
    if (pick.dataset.fto !== undefined) S.feedTo = pick.dataset.fto || null;
    if (pick.dataset.metric) S.duel.metric = pick.dataset.metric;
    if (pick.dataset.days) S.duel.days = Number(pick.dataset.days);
    if (pick.dataset.to) S.duel.to = pick.dataset.to;
    pick.parentElement.querySelectorAll('.pick').forEach(b => b.setAttribute('aria-pressed', b === pick));
    return;
  }
  const row = e.target.closest('[data-player]');
  if (row) { Sound.click(); playerSheet(row.dataset.player); return; }
  const a = e.target.closest('[data-act]');
  if (a) { if (!['sound'].includes(a.dataset.act)) Sound.click(); act(a.dataset.act, a); }
});
document.addEventListener('input', e => { if (e.target.id === 'setGoal') $('#goalV').textContent = e.target.value + ' h'; });
document.addEventListener('change', async e => {
  if (e.target.id === 'showPal') { try { await call('/settings', { token: S.token || demo.token, showPalier: e.target.checked }); Sound.pick(); await refresh(); } catch (er) { toast(er.message, true); } }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); document.querySelector('.levelup')?.remove(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });

// invite preview
async function invitePreview() {
  const inv = qs.get('invite'); if (!inv || S.token) return;
  try {
    const r = await call('/invite', { invite: inv });
    const t = $('#invTitle'), s = $('#invSub');
    if (t) t.textContent = `${r.name} t'attend.`;
    if (s) s.textContent = `${r.players.map(p => p.emoji + ' ' + p.name).join(', ')} ${r.players.length > 1 ? 'sont' : 'est'} déjà dedans. Tout le monde commence en Rouille.`;
  } catch (e) { const t = $('#invTitle'); if (t) t.textContent = e.message; }
}

// boot
(async function boot() {
  if (DEMO) { demo = await buildDemo(); S.token = demo.token; }
  render();
  invitePreview();
  await refresh();
  setInterval(() => { if (!document.hidden) refresh(true); }, 30000);
})();
