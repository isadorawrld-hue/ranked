// RANKED core: scoring, ranks, challenges, feed, API handlers.
// Pure module: runs in Netlify Functions (Node) and in the browser (demo mode).

export const VERSION = '2.0.0';

// ---------- Ranks ----------
export const TIERS = [
  { id: 'rouille', name: 'Rouille', c1: '#6e3418', c2: '#d9834b', glow: '#ff8f4f' },
  { id: 'cuivre', name: 'Cuivre', c1: '#9c4c1c', c2: '#ffc293', glow: '#ffb070' },
  { id: 'chrome', name: 'Chrome', c1: '#7f8ba6', c2: '#ffffff', glow: '#d6e6ff' },
  { id: 'neon', name: 'Néon', c1: '#00b89c', c2: '#8dff6a', glow: '#5dffb0' },
  { id: 'plasma', name: 'Plasma', c1: '#6a25ff', c2: '#ff58db', glow: '#ff6ae6' },
  { id: 'quantum', name: 'Quantum', c1: '#1748ff', c2: '#55f2ff', glow: '#6af2ff' },
  { id: 'singularite', name: 'Singularité', c1: '#1a0036', c2: '#b54dff', glow: '#c27aff' },
  { id: 'apex', name: 'Apex', c1: '#ff7a00', c2: '#fff3a6', glow: '#ffd25a' },
];
export const TIER_LP = 300; // 3 divisions x 100 LP
export const APEX_LP = TIER_LP * 7; // 2100
const DIV_NAMES = ['I', 'II', 'III'];

export function rankOf(lp) {
  lp = Math.max(0, Math.floor(lp));
  if (lp >= APEX_LP) return { tier: 7, div: '', progress: Math.min(100, lp - APEX_LP), toNext: null, label: 'Apex' };
  const tier = Math.floor(lp / TIER_LP);
  const within = lp % TIER_LP;
  const divIdx = Math.floor(within / 100); // 0 => III, 2 => I
  const div = DIV_NAMES[2 - divIdx];
  return { tier, div, progress: within % 100, toNext: 100 - (within % 100), label: `${TIERS[tier].name} ${div}` };
}

// Monthly money tiers, taken from Rafael's v1 (personal, opt-in to show to the league)
export const PALIERS = [
  { name: 'Cuivre', min: -Infinity }, { name: 'Bronze', min: 1000 }, { name: 'Argent', min: 2000 },
  { name: 'Gold', min: 5000 }, { name: 'Platinum', min: 10000 }, { name: 'Ascendant', min: 25000 },
  { name: 'Diamant', min: 40000 }, { name: 'Champion', min: 100000 }, { name: 'Top mondial', min: 500000 },
  { name: 'Légende', min: 1000000 },
];
export function palierOf(total) {
  let i = 0;
  PALIERS.forEach((p, k) => { if (total >= p.min) i = k; });
  return { i, name: PALIERS[i].name, next: PALIERS[i + 1] ? PALIERS[i + 1].min : null };
}
export function monthTotals(days) {
  const out = {};
  for (const [d, v] of Object.entries(days || {})) {
    if (!v.money || v.money.void || !Number.isFinite(Number(v.money.v))) continue;
    const m = d.slice(0, 7);
    out[m] = (out[m] || 0) + Number(v.money.v);
  }
  return out;
}

// ---------- Categories (classified locally by the agent) ----------
export const DEFAULT_CATS = [
  { id: 'trading', label: 'Trading', work: true, idle: 900,
    kw: ['tradingview', 'metatrader', 'mt4', 'mt5', 'binance', 'bybit', 'ctrader', 'ninjatrader', 'thinkorswim', 'interactive brokers', 'okx', 'bitget', 'hyperliquid', 'dexscreener', 'coinglass', 'kraken', 'topstep', 'ftmo'],
    proc: ['terminal64', 'terminal', 'ctrader', 'ninjatrader', 'tws', 'tradingview'] },
  { id: 'crm', label: 'Infloww / CRM', work: true, idle: 300,
    kw: ['infloww', 'mypuls', 'myfeed', 'onlyfans', 'mym.fans', 'mym ', 'fansly', 'supercreator', 'creatorhero', 'qreators'],
    proc: ['infloww', 'infloww desktop'] },
  { id: 'claude', label: 'Claude', work: true, idle: 300, kw: ['claude'], proc: ['claude'] },
  { id: 'work', label: 'Autre boulot', work: true, idle: 300,
    kw: ['chatgpt', 'notion', 'google docs', 'google sheets', 'google slides', 'gmail', 'canva', 'figma', 'capcut', 'netlify', 'github', 'supabase', 'whatsapp', 'telegram', 'meta business', 'ads manager', 'geelark'],
    proc: ['code', 'cursor', 'excel', 'winword', 'powerpnt', 'notion', 'figma', 'capcut', 'adobe premiere pro', 'afterfx', 'photoshop', 'telegram', 'whatsapp', 'slack', 'geelark'] },
  { id: 'scroll', label: 'Scroll perso', work: false, idle: 1800,
    kw: ['youtube', 'netflix', 'instagram', 'tiktok', 'facebook', 'twitch', 'reddit', ' / x ', 'disney+', 'prime video', '9gag', 'crunchyroll'],
    proc: ['steam', 'valorant', 'leagueclient', 'fortnitelauncher', 'epicgameslauncher', 'riotclientservices'] },
];
export const CAT_IDS = DEFAULT_CATS.map(c => c.id).concat('other');
export const WORK_CATS = DEFAULT_CATS.filter(c => c.work).map(c => c.id);

export function catsFor(player) {
  const extra = (player && player.kw) || {};
  return DEFAULT_CATS.map(c => ({
    ...c,
    kw: [...new Set([...(extra[c.id] || []), ...c.kw].map(s => String(s).toLowerCase().trim()).filter(Boolean))],
  }));
}

// ---------- Dates ----------
export function dayKey(ms, offsetMin = 0) {
  return new Date(ms + offsetMin * 60000).toISOString().slice(0, 10);
}
export function addDays(key, n) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
const isKey = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------- Scoring ----------
export const DEFAULT_WEIGHTS = { money: 0.5, hours: 0.3, reg: 0.2 };
export const SEASON_DAYS = 28;
export const SEASON_KEEP = 0.6; // soft reset: 60% of LP carried to the next season
const HOURS_CAP_MIN = 480; // 8 h/day max counted
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function workMinutes(day) {
  if (!day || !day.m) return 0;
  return WORK_CATS.reduce((s, c) => s + (Number(day.m[c]) || 0), 0);
}
function moneyOf(day) {
  if (!day || !day.money || day.money.void) return null;
  const v = Number(day.money.v);
  return Number.isFinite(v) ? v : null;
}
function windowSum(days, endKey) {
  let s = 0, n = 0;
  for (let i = 0; i < 7; i++) {
    const v = moneyOf(days[addDays(endKey, -i)]);
    if (v !== null) { s += v; n++; }
  }
  return { s, n };
}
// Progression of the last 7 days vs the average of the 4 previous weeks.
export function moneyScore(days, d) {
  const cur = windowSum(days, d);
  const weeks = [];
  for (let k = 1; k <= 4; k++) {
    const w = windowSum(days, addDays(d, -7 * k));
    if (w.n > 0) weeks.push(w.s);
  }
  if (!weeks.length) return { score: cur.n ? 60 : 50, pct: null };
  const base = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const denom = Math.max(Math.abs(base), 1);
  const pct = ((cur.s - base) / denom) * 100;
  return { score: clamp(50 + pct / 2, 0, 100), pct: Math.round(clamp(pct, -100, 300)) };
}
export function hoursScore(min, goalH) {
  const h = Math.min(min, HOURS_CAP_MIN) / 60;
  return clamp(Math.min(h / Math.max(goalH, 1), 1.25) / 1.25 * 100, 0, 100);
}
export function lpFromPoints(p) {
  return clamp(Math.round((p - 40) * 0.9), -20, 54);
}

export const phoneMin = day => Math.round((day && Number(day.phoneSec)) / 60 || 0);

// Full timeline for one player. Returns per-day records.
export function playerTimeline(player, days, fromKey, toKey, weights = DEFAULT_WEIGHTS) {
  const goal = player.goalHours || 6;
  const streakMin = (player.streakHours || 4) * 60;
  const out = [];
  let streak = 0, lastMiss = null, jokerUsed = 0, inactiveRun = 0;
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) {
    const day = days[d];
    const wm = workMinutes(day);
    const ms = moneyScore(days, d);
    const hs = hoursScore(wm, goal);
    let joker = false;
    if (wm >= streakMin) streak++;
    else if (d !== toKey) {
      if (streak > 0 && (!lastMiss || daysBetween(lastMiss, d) >= 7)) { joker = true; jokerUsed++; lastMiss = d; }
      else { streak = 0; lastMiss = d; }
    }
    const rs = Math.min(streak, 10) * 10;
    const pts = Math.round(weights.money * ms.score + weights.hours * hs + weights.reg * rs);
    const active = wm > 0 || moneyOf(day) !== null;
    inactiveRun = active ? 0 : inactiveRun + 1;
    out.push({
      d, wm, pts, lp: lpFromPoints(pts), streak, joker, inactiveRun,
      ms: Math.round(ms.score), pct: ms.pct, hs: Math.round(hs),
      scroll: (day && day.m ? Number(day.m.scroll) || 0 : 0) + phoneMin(day),
      phone: phoneMin(day), phoneActive: !!(day && day.phoneEv),
      late: day ? Number(day.late) || 0 : 0,
      money: moneyOf(day), hasData: active, cats: day && day.m ? day.m : {},
    });
  }
  return out;
}

// ---------- Challenges ----------
export const CH_METRICS = {
  hours: { label: 'Heures de boulot', better: 'high' },
  points: { label: 'Points du jour', better: 'high' },
  money: { label: 'Progression argent', better: 'high' },
  antiscroll: { label: 'Anti-scroll', better: 'low' },
};
function chValue(metric, recs) {
  if (metric === 'hours') return recs.reduce((s, r) => s + Math.min(r.wm, HOURS_CAP_MIN), 0);
  if (metric === 'points') return recs.reduce((s, r) => s + r.pts, 0);
  if (metric === 'money') return recs.reduce((s, r) => s + r.ms, 0);
  // anti-scroll: least scroll, but a day under 2h of work counts as 600 scroll minutes (PC off is no win)
  return recs.reduce((s, r) => s + (r.wm < 120 ? 600 : r.scroll), 0);
}
export function resolveChallenge(ch, lines, todayOf) {
  if (ch.status !== 'active') return ch;
  const a = lines[ch.from], b = lines[ch.to];
  if (!a || !b) return ch;
  const ended = todayOf(ch.from) > ch.endDay && todayOf(ch.to) > ch.endDay;
  const pick = line => line.filter(r => r.d >= ch.startDay && r.d <= ch.endDay);
  const pa = pick(a), pb = pick(b);
  const va = chValue(ch.metric, pa), vb = chValue(ch.metric, pb);
  const low = CH_METRICS[ch.metric].better === 'low';
  let lead = va === vb ? null : ((va > vb) !== low ? ch.from : ch.to);
  let forfeit;
  if (ch.metric === 'antiscroll') {
    // phone tracker off on a past day of the duel = forfeit (if the other kept it on)
    const isPast = (r, pid) => r.d < todayOf(pid);
    const offA = pa.some(r => isPast(r, ch.from) && !r.phoneActive), offB = pb.some(r => isPast(r, ch.to) && !r.phoneActive);
    if (offA !== offB) { lead = offA ? ch.to : ch.from; forfeit = offA ? ch.from : ch.to; }
  }
  return { ...ch, va, vb, lead, forfeit, status: ended ? 'done' : 'active', winner: ended ? lead : undefined };
}
export const CH_WIN_LP = 15, CH_LOSE_LP = -5;
export const PHONE_OFF_MS = 26 * 3600000; // no phone signal for 26 h = tracker off
export const PHONE_SESSION_MAX_MS = 60 * 60000; // one app session counts 60 min max (screen locked inside the app)

// ---------- Vannes ----------
export const VANNES = {
  overtake: [
    '{a} vient de passer devant {b}. Il lui fait coucou depuis le rang du dessus.',
    '{b} s\'est fait doubler par {a}. Le podium a encore des places debout.',
    '{a} double {b} sans clignotant. Constat amiable demain.',
  ],
  promo: [
    '{a} passe {r}. Le groupe n\'a pas été prévenu, mais il va l\'entendre.',
    '{a} monte en {r}. Respect, ou jalousie, chacun choisit.',
  ],
  demo: [
    '{a} redescend en {r}. Ça arrive aux meilleurs, surtout aux autres.',
    '{a} tombe en {r}. On parlera de pause stratégique.',
  ],
  streakBreak: [
    'La série de {n} jours de {a} s\'arrête ici. Minute de silence, puis il repart.',
    '{a} casse sa série de {n} jours. Le canapé a gagné cette manche.',
  ],
  streak: [
    '{a} est à {n} jours d\'affilée. Quelqu\'un lui rappelle qu\'il peut aussi dormir ?',
    '{n} jours de suite pour {a}. Machine.',
  ],
  record: [
    'Record perso pour {a} : {n} points. Les autres, vous regardez ou vous jouez ?',
    '{a} pose {n} points sur la table. Nouveau record, la barre monte.',
  ],
  inactive: [
    '{a} n\'a rien fait depuis {n} jours. On le croyait en vacances, il est juste en pause longue.',
    'Signal perdu pour {a} depuis {n} jours. Si quelqu\'un le voit, rappelez-lui que la ligue existe.',
  ],
  chWin: [
    '{a} remporte le duel contre {b}. {b} offre {s}, c\'est dans le règlement.',
    '{b} perd son défi contre {a}. Il dit que c\'était un test. Il doit {s}.',
  ],
  joker: ['{a} prend un jour off sans casser sa série. Zen Master.'],
  join: ['{a} entre dans la ligue. Bienvenue en Rouille, tout le monde commence là.'],
  phoneOff: [
    '📵 {a} a coupé son tracker téléphone. On sait tous ce qu\'il fait sur Insta.',
    '📵 Plus de signal du téléphone de {a}. Tracker coupé, conscience pas tranquille.',
  ],
};
export const QUICK_ROASTS = [
  'T\'as fini ta sieste ?',
  'Ton PC est allumé ou c\'est décoratif ?',
  'Je te vois dans le rétro. Ah non, t\'es trop loin.',
  'Belle progression. Ah pardon, c\'était l\'autre sens.',
  'Rendez-vous en haut. Je t\'attendrai.',
  'Moins de scroll, plus de cash.',
];
function hashStr(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
export function vanne(type, id, vars) {
  const list = VANNES[type] || ['{a}'];
  let t = list[hashStr(id) % list.length];
  for (const [k, v] of Object.entries(vars)) t = t.split('{' + k + '}').join(v);
  return t;
}

// ---------- League computation ----------
export function todayFor(player, nowMs) { return dayKey(nowMs, player.tz ?? 420); }

export function computeLeague(league, daysByPlayer, nowMs) {
  const weights = league.weights || DEFAULT_WEIGHTS;
  const players = league.players.filter(p => !p.removed);
  const start = league.startDay;
  const leagueToday = dayKey(nowMs, league.tz ?? 420);
  const todayOf = id => { const p = players.find(x => x.id === id); return p ? todayFor(p, nowMs) : leagueToday; };
  const end = players.reduce((m, p) => (todayFor(p, nowMs) > m ? todayFor(p, nowMs) : m), leagueToday);
  const lines = {};
  for (const p of players) {
    const from = p.joinDay > start ? p.joinDay : start;
    lines[p.id] = playerTimeline(p, daysByPlayer[p.id] || {}, from, todayFor(p, nowMs), weights);
  }
  // challenges
  const challenges = (league.challenges || []).map(c => resolveChallenge(c, lines, todayOf));
  const chBonus = {}; // `${pid}|${day}` -> lp
  for (const c of challenges) {
    if (c.status !== 'done' || !c.winner) continue;
    const loser = c.winner === c.from ? c.to : c.from;
    chBonus[c.winner + '|' + c.endDay] = (chBonus[c.winner + '|' + c.endDay] || 0) + CH_WIN_LP;
    chBonus[loser + '|' + c.endDay] = (chBonus[loser + '|' + c.endDay] || 0) + CH_LOSE_LP;
  }
  // replay LP day by day with seasons + events
  const lp = {}, best = {}, tierPrev = {}, events = [];
  const seasonOf = d => Math.floor(daysBetween(start, d) / SEASON_DAYS);
  let prevOrder = null, prevSeason = 0;
  const name = id => (players.find(p => p.id === id) || {}).name || '?';
  for (const p of players) { lp[p.id] = 0; best[p.id] = 0; tierPrev[p.id] = 0; }
  const byDay = {};
  for (const p of players) for (const r of lines[p.id]) (byDay[r.d] ||= []).push([p.id, r]);
  const seasonsHistory = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const s = seasonOf(d);
    if (s !== prevSeason) {
      const podium = players.map(p => [p.id, lp[p.id]]).sort((a, b) => b[1] - a[1]);
      seasonsHistory.push({ season: prevSeason + 1, podium: podium.slice(0, 3).map(([id, v]) => ({ id, lp: v })) });
      for (const p of players) { lp[p.id] = Math.floor(lp[p.id] * SEASON_KEEP); tierPrev[p.id] = rankOf(lp[p.id]).tier; }
      prevSeason = s;
    }
    for (const [pid, r] of byDay[d] || []) {
      const isToday = r.d === todayOf(pid);
      let delta = isToday ? Math.max(0, r.lp) : r.lp;
      delta += chBonus[pid + '|' + d] || 0;
      if (isToday) r.provisional = delta;
      lp[pid] = Math.max(0, lp[pid] + delta);
      r.lpTotal = lp[pid];
      if (isToday) continue;
      const evId = pid + d;
      const n = name(pid);
      const t = rankOf(lp[pid]).tier;
      if (t > tierPrev[pid]) events.push({ id: 'p' + evId, d, type: 'promo', who: pid, text: vanne('promo', evId, { a: n, r: TIERS[t].name }) });
      if (t < tierPrev[pid]) events.push({ id: 'm' + evId, d, type: 'demo', who: pid, text: vanne('demo', evId, { a: n, r: TIERS[t].name }) });
      tierPrev[pid] = t;
      const line = lines[pid];
      const i = line.indexOf(r);
      const prev = i > 0 ? line[i - 1] : null;
      if (prev && prev.streak >= 3 && r.streak === 0) events.push({ id: 'b' + evId, d, type: 'streakBreak', who: pid, text: vanne('streakBreak', evId, { a: n, n: prev.streak }) });
      if ([7, 14, 30, 60, 100].includes(r.streak) && !r.joker) events.push({ id: 's' + evId, d, type: 'streak', who: pid, text: vanne('streak', evId, { a: n, n: r.streak }) });
      if (r.joker) events.push({ id: 'j' + evId, d, type: 'joker', who: pid, text: vanne('joker', evId, { a: n }) });
      if (i >= 4 && r.pts >= 70 && r.pts > best[pid]) events.push({ id: 'r' + evId, d, type: 'record', who: pid, text: vanne('record', evId, { a: n, n: r.pts }) });
      best[pid] = Math.max(best[pid], r.pts);
      if (r.inactiveRun === 3 || r.inactiveRun === 7) events.push({ id: 'i' + evId, d, type: 'inactive', who: pid, text: vanne('inactive', evId, { a: n, n: r.inactiveRun }) });
    }
    // overtakes on finalized days (adjacent swaps only)
    const order = players.filter(p => p.joinDay <= d).map(p => p.id).sort((a, b) => lp[b] - lp[a]);
    if (prevOrder && d < leagueToday) {
      for (let i = 0; i < order.length - 1; i++) {
        const a = order[i], b = order[i + 1];
        if (prevOrder.indexOf(a) > prevOrder.indexOf(b) && prevOrder.includes(a) && lp[a] > lp[b]) {
          const id = 'o' + a + b + d;
          events.push({ id, d, type: 'overtake', who: a, target: b, text: vanne('overtake', id, { a: name(a), b: name(b) }) });
        }
      }
    }
    if (d < leagueToday) prevOrder = order;
  }
  for (const c of challenges) {
    if (c.status === 'done' && c.winner) {
      const loser = c.winner === c.from ? c.to : c.from;
      events.push({ id: 'c' + c.id, d: c.endDay, type: 'chWin', who: c.winner, target: loser, text: vanne('chWin', c.id, { a: name(c.winner), b: name(loser), s: c.stake || 'l\'apéro' }) });
    }
  }
  // standings
  const standings = players.map(p => {
    const line = lines[p.id];
    const today = line[line.length - 1] || { wm: 0, pts: 0, streak: 0, cats: {}, scroll: 0 };
    const last7 = line.slice(-7);
    const r = rankOf(lp[p.id]);
    return {
      id: p.id, name: p.name, emoji: p.emoji, color: p.color, role: p.role,
      lp: lp[p.id], rank: r, provisional: today.provisional || 0,
      today: { work: today.wm, pts: today.pts, cats: pickCats(today.cats), scroll: today.scroll },
      week: { work: last7.reduce((s, x) => s + x.wm, 0), pts: Math.round(last7.reduce((s, x) => s + x.pts, 0) / Math.max(1, last7.length)) },
      streak: today.streak, moneyPct: today.pct, moneySrc: p.moneySrc || 'declared', moneyLabel: p.moneyLabel || 'Argent',
      agentOnline: !!(p.agentSeenAt && nowMs - p.agentSeenAt < 15 * 60000), agentEver: !!p.agentSeenAt,
      badges: badgesFor(line, events, p.id),
      spark: line.slice(-14).map(x => x.pts),
    };
  }).sort((a, b) => b.lp - a.lp || b.today.pts - a.today.pts);
  standings.forEach((s, i) => { s.pos = i + 1; });
  const curSeason = seasonOf(leagueToday);
  return {
    standings, lines, challenges, events, seasonsHistory,
    season: { n: curSeason + 1, day: daysBetween(start, leagueToday) % SEASON_DAYS + 1, left: SEASON_DAYS - (daysBetween(start, leagueToday) % SEASON_DAYS) - 1 },
  };
}
function pickCats(m) { const o = {}; for (const c of CAT_IDS) o[c] = Number(m && m[c]) || 0; return o; }

export const BADGES = {
  insomniaque: { name: 'Insomniaque', desc: '5 nuits à bosser après 23 h' },
  beton: { name: 'Mur de béton', desc: 'Série de 30 jours' },
  sniper: { name: 'Sniper', desc: 'Une journée à 95 points ou plus' },
  revenant: { name: 'Revenant', desc: 'Remonté après une démotion' },
  chasseur: { name: 'Chasseur de têtes', desc: '3 dépassements dans la saison' },
  zen: { name: 'Zen Master', desc: 'Un jour off sans casser sa série' },
};
function badgesFor(line, events, pid) {
  const b = [];
  if (line.filter(r => r.late >= 30).length >= 5) b.push('insomniaque');
  if (line.some(r => r.streak >= 30)) b.push('beton');
  if (line.some(r => r.pts >= 95 && !r.provisional)) b.push('sniper');
  const mine = events.filter(e => e.who === pid);
  const lastDemo = mine.filter(e => e.type === 'demo').map(e => e.d).sort().pop();
  if (lastDemo && mine.some(e => e.type === 'promo' && e.d > lastDemo)) b.push('revenant');
  if (mine.filter(e => e.type === 'overtake').length >= 3) b.push('chasseur');
  if (line.some(r => r.joker)) b.push('zen');
  return b;
}

// ---------- Crypto helpers ----------
const C = globalThis.crypto;
export function randId(n = 10) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint8Array(n); C.getRandomValues(buf);
  return [...buf].map(x => a[x % a.length]).join('');
}
export async function sha(s) {
  const h = await C.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ---------- API ----------
// store: { get(key) -> obj|null, update(key, fn(obj|null) -> obj) -> obj, set(key, obj) }
const COLORS = ['#4ff0ff', '#ff58db', '#ffd25a', '#8dff6a', '#ff8f4f', '#b38bff', '#5aa8ff', '#ff6a6a'];
const EMOJIS = ['🦊', '🐺', '🦁', '🐉', '🦅', '🐯', '🦈', '🐍'];
const err = (status, msg) => ({ status, json: { error: msg } });
const ok = json => ({ status: 200, json });
const cleanName = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 18);

export function createApi(store, { now = () => Date.now(), agentTemplate = null, origin = '' } = {}) {
  async function auth(token) {
    const [lid, pid, secret] = String(token || '').split('.');
    if (!lid || !pid || !secret) return null;
    const league = await store.get('league/' + lid);
    if (!league) return null;
    const p = league.players.find(x => x.id === pid && !x.removed);
    if (!p || p.tokenHash !== await sha(secret)) return null;
    return { league, me: p, lid, pid };
  }
  async function loadDays(league) {
    const out = {};
    await Promise.all(league.players.map(async p => { out[p.id] = (await store.get(`days/${league.id}/${p.id}`)) || {}; }));
    return out;
  }
  async function newPlayer(lid, body, role, tz) {
    const secret = randId(24);
    const pid = randId(8);
    return {
      player: {
        id: pid, name: cleanName(body.name) || 'Joueur', emoji: EMOJIS.includes(body.emoji) ? body.emoji : EMOJIS[0],
        color: COLORS[0], role, tokenHash: await sha(secret), goalHours: 6, streakHours: 4,
        tz: Number.isFinite(tz) ? clamp(tz, -720, 840) : 420, joinDay: dayKey(now(), Number.isFinite(tz) ? tz : 420),
        moneyLabel: cleanName(body.moneyLabel) || 'Argent', moneySrc: 'declared', kw: {}, joinedAt: now(),
      },
      token: `${lid}.${pid}.${secret}`,
    };
  }
  async function state(a) {
    const { league, me } = a;
    const days = await loadDays(league);
    const c = computeLeague(league, days, now());
    const phones = {};
    await Promise.all(league.players.map(async p => { phones[p.id] = await store.get(`phone/${league.id}/${p.id}`); }));
    for (const st of c.standings) {
      const ph = phones[st.id];
      st.phone = !ph || !ph.lastAt ? 'none' : now() - ph.lastAt < PHONE_OFF_MS ? 'on' : 'off';
      const line = c.lines[st.id] || [];
      st.today.phone = (line[line.length - 1] || {}).phone || 0;
      if (st.phone === 'off') {
        const at = ph.lastAt + PHONE_OFF_MS;
        c.events.push({ id: 'f' + st.id + ph.lastAt, d: dayKey(at, 420), at, type: 'phoneOff', who: st.id, text: vanne('phoneOff', st.id + ph.lastAt, { a: st.name }) });
      }
    }
    const posts = (league.posts || []).slice(-80);
    const feed = [...c.events.map(e => ({ ...e, auto: true })), ...posts.map(p => ({ ...p, type: 'post' }))]
      .sort((x, y) => (y.at || Date.parse(y.d + 'T23:00:00Z')) - (x.at || Date.parse(x.d + 'T23:00:00Z'))).slice(0, 80);
    const myLine = c.lines[me.id] || [];
    const month = todayFor(me, now()).slice(0, 7);
    const palierFor = (p, withTotal) => {
      const mt = monthTotals(days[p.id]);
      const cur = palierOf(mt[month] || 0);
      const best = Object.values(mt).reduce((b, v) => Math.max(b, palierOf(v).i), 0);
      return { name: mt[month] === undefined ? null : cur.name, i: cur.i, best: PALIERS[best].name, total: withTotal ? (mt[month] || 0) : undefined, next: withTotal ? cur.next : undefined,
        months: withTotal ? Object.entries(mt).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12).map(([m, v]) => ({ m, v, palier: palierOf(v).name })) : undefined };
    };
    for (const st of c.standings) {
      const p = league.players.find(x => x.id === st.id);
      if (p.id === me.id || p.showPalier) { const pl = palierFor(p, false); st.palier = pl.name; st.palierBest = pl.best; }
    }
    const contests = league.contests || [];
    return ok({
      version: VERSION,
      league: { id: league.id, name: league.name, invite: me.role === 'admin' ? league.invite : undefined, weights: league.weights || DEFAULT_WEIGHTS, startDay: league.startDay },
      season: c.season, seasonsHistory: c.seasonsHistory,
      me: {
        id: me.id, role: me.role, goalHours: me.goalHours, streakHours: me.streakHours, moneyLabel: me.moneyLabel, kw: me.kw || {},
        currency: me.currency || 'EUR', showPalier: !!me.showPalier, palier: palierFor(me, true), name: me.name, emoji: me.emoji,
        phoneKey: me.phoneKey || null,
        today: todayFor(me, now()),
        history: myLine.slice(-28).map(r => ({ d: r.d, wm: r.wm, pts: r.pts, money: r.money, ms: r.ms, hs: r.hs, streak: r.streak, cats: pickCats(r.cats), phone: r.phone })),
      },
      standings: c.standings,
      challenges: c.challenges.slice(-30).reverse(),
      feed,
      moneyLog: league.players.filter(p => !p.removed && p.id !== me.id).map(p => ({
        id: p.id,
        days: Object.entries(days[p.id] || {}).filter(([, v]) => v.money && v.money.src === 'declared').map(([d, v]) => ({ d, void: !!v.money.void, contested: contests.filter(x => x.pid === p.id && x.d === d).map(x => x.by) })).sort((x, y) => (x.d < y.d ? 1 : -1)).slice(0, 7),
      })),
      cats: catsFor(me).map(({ id, label, work }) => ({ id, label, work })).concat({ id: 'other', label: 'Autre', work: false }),
    });
  }

  const routes = {
    'GET /health': async () => ok({ ok: true, version: VERSION }),

    'POST /setup': async (b) => {
      const lid = randId(6);
      const { player, token } = await newPlayer(lid, b, 'admin', Number(b.tz));
      const league = {
        id: lid, name: String(b.league || '').replace(/[<>]/g, '').trim().slice(0, 32) || 'La Ligue', createdAt: now(), invite: randId(8), tz: player.tz,
        startDay: player.joinDay, weights: DEFAULT_WEIGHTS, players: [player], challenges: [], posts: [
          { id: randId(8), at: now(), from: null, text: vanne('join', player.id, { a: player.name }) },
        ], contests: [],
      };
      await store.set('league/' + lid, league);
      await store.set('invite/' + league.invite, { lid });
      return ok({ token, leagueId: lid, invite: league.invite });
    },

    'POST /invite': async (b) => {
      const inv = await store.get('invite/' + String(b.invite || '').trim().toLowerCase());
      const lg = inv && inv.lid ? await store.get('league/' + inv.lid) : null;
      if (!lg) return err(404, 'Lien d\'invitation expiré ou faux. Demande le nouveau lien à l\'admin.');
      return ok({ name: lg.name, players: lg.players.filter(p => !p.removed).map(p => ({ name: p.name, emoji: p.emoji })) });
    },

    'POST /join': async (b) => {
      const inv = await store.get('invite/' + String(b.invite || '').trim().toLowerCase());
      if (!inv || !inv.lid) return err(404, 'Code d\'invitation inconnu. Demande le bon lien à l\'admin de la ligue.');
      const lg = await store.get('league/' + inv.lid);
      if (!lg) return err(404, 'Ligue introuvable.');
      if (lg.players.filter(p => !p.removed).length >= 12) return err(409, 'La ligue est pleine (12 joueurs max).');
      const { player, token } = await newPlayer(inv.lid, b, 'player', Number(b.tz));
      await store.update('league/' + inv.lid, league => {
        const used = league.players.filter(p => !p.removed).map(p => p.color);
        player.color = COLORS.find(c => !used.includes(c)) || COLORS[league.players.length % COLORS.length];
        league.players.push(player);
        (league.posts ||= []).push({ id: randId(8), at: now(), from: null, text: vanne('join', player.id, { a: player.name }) });
        return league;
      });
      return ok({ token, leagueId: inv.lid });
    },

    'POST /state': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide. Reconnecte-toi avec ton code.');
      return state(a);
    },

    'POST /ingest': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'bad token');
      if (!isKey(b.date)) return err(400, 'bad date');
      const today = dayKey(now(), Number.isFinite(Number(b.tz)) ? Number(b.tz) : a.me.tz);
      if (b.date > today || daysBetween(b.date, today) > 2) return err(400, 'date out of range');
      const m = {};
      for (const c of CAT_IDS) m[c] = clamp(Math.round(Number(b.minutes && b.minutes[c]) || 0), 0, 1440);
      await store.update(`days/${a.lid}/${a.pid}`, days => {
        days ||= {};
        const prev = days[b.date] || {};
        // totals only grow during a day (agent restarts keep local state; never lose minutes)
        const merged = {};
        for (const c of CAT_IDS) merged[c] = Math.max(m[c], (prev.m && prev.m[c]) || 0);
        days[b.date] = { ...prev, m: merged, late: Math.max(clamp(Number(b.late) || 0, 0, 1440), prev.late || 0), src: 'agent' };
        return days;
      });
      if (!a.me.agentSeenAt || now() - a.me.agentSeenAt > 5 * 60000 || Number(b.tz) !== a.me.tz) {
        await store.update('league/' + a.lid, league => {
          const p = league.players.find(x => x.id === a.pid);
          p.agentSeenAt = now();
          if (Number.isFinite(Number(b.tz))) p.tz = clamp(Number(b.tz), -720, 840);
          return league;
        });
      }
      return ok({ ok: true });
    },

    'POST /phone-key': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      let key = a.me.phoneKey;
      if (!key || b.rotate) {
        const old = key;
        key = randId(16);
        await store.update('league/' + a.lid, league => { league.players.find(x => x.id === a.pid).phoneKey = key; return league; });
        await store.set('phonekey/' + key, { lid: a.lid, pid: a.pid });
        if (old) await store.set('phonekey/' + old, { revoked: true });
      }
      return ok({ key });
    },

    'POST /agent-config': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'bad token');
      const extra = a.me.kw || {};
      return ok({ cats: DEFAULT_CATS.map(({ id, work, idle, kw, proc }) => ({ id, work, idle, kw, kwx: (extra[id] || []), proc })), push: 60 });
    },

    'POST /money': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      const d = isKey(b.date) ? b.date : todayFor(a.me, now());
      const today = todayFor(a.me, now());
      if (d > today || daysBetween(d, today) > 7) return err(400, 'Tu peux saisir les 7 derniers jours seulement.');
      const v = Number(String(b.value).replace(',', '.').replace(/\s/g, ''));
      if (!Number.isFinite(v) || Math.abs(v) > 1e8) return err(400, 'Montant invalide.');
      await store.update(`days/${a.lid}/${a.pid}`, days => {
        days ||= {};
        days[d] = { ...(days[d] || {}), money: { v, src: 'declared', at: now() } };
        return days;
      });
      return ok({ ok: true });
    },

    'POST /contest': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      if (b.pid === a.pid) return err(400, 'Tu ne peux pas te contester toi-même.');
      let voided = false;
      await store.update('league/' + a.lid, league => {
        league.contests ||= [];
        if (!league.contests.some(c => c.pid === b.pid && c.d === b.date && c.by === a.pid))
          league.contests.push({ pid: b.pid, d: b.date, by: a.pid, at: now() });
        const others = league.players.filter(p => !p.removed && p.id !== b.pid).length;
        const n = league.contests.filter(c => c.pid === b.pid && c.d === b.date).length;
        voided = n >= Math.max(1, Math.ceil(others / 2));
        if (voided) league.posts.push({ id: randId(8), at: now(), from: null, text: `Montant du ${b.date} de ${(league.players.find(p => p.id === b.pid) || {}).name} annulé par la ligue. Preuve ou rien.` });
        return league;
      });
      if (voided) {
        await store.update(`days/${a.lid}/${b.pid}`, days => {
          days ||= {};
          if (days[b.date] && days[b.date].money) days[b.date].money.void = true;
          return days;
        });
      }
      return ok({ ok: true, voided });
    },

    'POST /post': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      const text = String(b.text || '').replace(/[<>]/g, '').trim().slice(0, 200);
      if (!text) return err(400, 'Message vide.');
      await store.update('league/' + a.lid, league => {
        league.posts ||= [];
        league.posts.push({ id: randId(8), at: now(), from: a.pid, to: league.players.some(p => p.id === b.to) ? b.to : null, text });
        league.posts = league.posts.slice(-200);
        return league;
      });
      return ok({ ok: true });
    },

    'POST /challenge': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      let res = ok({ ok: true });
      await store.update('league/' + a.lid, league => {
        league.challenges ||= [];
        if (b.action === 'create') {
          if (!CH_METRICS[b.metric]) { res = err(400, 'Type de défi inconnu.'); return league; }
          const to = league.players.find(p => p.id === b.to && !p.removed);
          if (!to || to.id === a.pid) { res = err(400, 'Choisis un adversaire.'); return league; }
          const open = league.challenges.filter(c => (c.status === 'pending' || c.status === 'active') && [c.from, c.to].includes(a.pid) && [c.from, c.to].includes(to.id));
          if (open.length) { res = err(409, 'Vous avez déjà un défi en cours tous les deux.'); return league; }
          league.challenges.push({ id: randId(8), from: a.pid, to: to.id, metric: b.metric, days: [1, 3, 7].includes(Number(b.days)) ? Number(b.days) : 3, stake: String(b.stake || '').replace(/[<>]/g, '').trim().slice(0, 40) || 'l\'apéro', status: 'pending', createdAt: now() });
          league.posts.push({ id: randId(8), at: now(), from: null, text: `${a.me.name} défie ${to.name} : ${CH_METRICS[b.metric].label}, ${[1, 3, 7].includes(Number(b.days)) ? Number(b.days) : 3} j, mise : ${String(b.stake || '').replace(/[<>]/g, '').trim().slice(0, 40) || 'l\'apéro'}.` });
        } else {
          const c = league.challenges.find(x => x.id === b.id);
          if (!c) { res = err(404, 'Défi introuvable.'); return league; }
          if (b.action === 'accept' && c.to === a.pid && c.status === 'pending') {
            c.status = 'active'; c.startDay = todayFor(a.me, now()); c.endDay = addDays(c.startDay, c.days - 1);
            league.posts.push({ id: randId(8), at: now(), from: null, text: `${a.me.name} accepte le duel. Que le meilleur gagne.` });
          } else if (b.action === 'decline' && c.to === a.pid && c.status === 'pending') {
            c.status = 'declined';
            league.posts.push({ id: randId(8), at: now(), from: null, text: `${a.me.name} refuse le duel. On note.` });
          } else if (b.action === 'cancel' && c.from === a.pid && c.status === 'pending') {
            c.status = 'cancelled';
          } else res = err(400, 'Action impossible sur ce défi.');
        }
        return league;
      });
      return res;
    },

    'POST /settings': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      await store.update('league/' + a.lid, league => {
        const p = league.players.find(x => x.id === a.pid);
        if (b.name) p.name = cleanName(b.name) || p.name;
        if (EMOJIS.includes(b.emoji)) p.emoji = b.emoji;
        if (b.goalHours) p.goalHours = clamp(Number(b.goalHours) || 6, 1, 14);
        if (b.streakHours) p.streakHours = clamp(Number(b.streakHours) || 4, 1, 12);
        if (b.moneyLabel) p.moneyLabel = cleanName(b.moneyLabel);
        if (b.currency === 'EUR' || b.currency === 'USD') p.currency = b.currency;
        if (typeof b.showPalier === 'boolean') p.showPalier = b.showPalier;
        if (b.kw && typeof b.kw === 'object') {
          p.kw = {};
          for (const c of DEFAULT_CATS) if (Array.isArray(b.kw[c.id])) p.kw[c.id] = b.kw[c.id].map(s => String(s).toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 30);
        }
        if (Number.isFinite(Number(b.tz))) p.tz = clamp(Number(b.tz), -720, 840);
        return league;
      });
      return ok({ ok: true });
    },

    'POST /admin': async (b) => {
      const a = await auth(b.token);
      if (!a || a.me.role !== 'admin') return err(403, 'Réservé à l\'admin de la ligue.');
      let res = ok({ ok: true });
      let oldInvite = null, newInvite = null;
      await store.update('league/' + a.lid, league => {
        if (b.action === 'newInvite') { oldInvite = league.invite; newInvite = league.invite = randId(8); res = ok({ ok: true, invite: newInvite }); }
        else if (b.action === 'remove') {
          const p = league.players.find(x => x.id === b.pid);
          if (!p || p.id === a.pid) res = err(400, 'Joueur introuvable.'); else p.removed = true;
        } else if (b.action === 'rename') league.name = String(b.name || '').replace(/[<>]/g, '').trim().slice(0, 32) || league.name;
        else if (b.action === 'weights') {
          const w = { money: Number(b.money), hours: Number(b.hours), reg: Number(b.reg) };
          const s = w.money + w.hours + w.reg;
          if (!(s > 0) || Object.values(w).some(x => !(x >= 0))) res = err(400, 'Poids invalides.');
          else league.weights = { money: w.money / s, hours: w.hours / s, reg: w.reg / s };
        } else res = err(400, 'Action inconnue.');
        return league;
      });
      if (newInvite) { await store.set('invite/' + newInvite, { lid: a.lid }); if (oldInvite) await store.set('invite/' + oldInvite, { lid: null, revoked: true }); }
      return res;
    },

    'POST /agent': async (b) => {
      const a = await auth(b.token);
      if (!a) return err(401, 'Code perso invalide.');
      if (!agentTemplate) return err(501, 'Agent indisponible ici.');
      const server = String(b.server || origin).replace(/\/+$/, '');
      if (!/^https?:\/\/[\w.:-]+$/.test(server)) return err(400, 'Adresse serveur invalide.');
      const text = agentTemplate(server, b.token, b.mode === 'uninstall');
      return { status: 200, text, headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${b.mode === 'uninstall' ? 'RANKED-desinstaller' : 'RANKED-agent'}.cmd"` } };
    },
  };

  async function phoneEvent(key, ev) {
    const ref = await store.get('phonekey/' + key);
    if (!ref || !ref.lid) return { status: 404, text: 'lien inconnu', headers: { 'content-type': 'text/plain' } };
    const league = await store.get('league/' + ref.lid);
    const p = league && league.players.find(x => x.id === ref.pid && !x.removed);
    if (!p) return { status: 404, text: 'joueur inconnu', headers: { 'content-type': 'text/plain' } };
    const t = now();
    let add = null; // { day, sec }
    await store.update(`phone/${ref.lid}/${ref.pid}`, st => {
      st ||= { openAt: null, lastAt: 0 };
      add = null;
      if (st.openAt && (ev === 'open' || ev === 'close')) {
        const sec = Math.max(0, Math.min(t - st.openAt, PHONE_SESSION_MAX_MS)) / 1000;
        add = { day: dayKey(st.openAt, p.tz ?? 420), sec };
        st.openAt = null;
      }
      if (ev === 'open') st.openAt = t;
      st.lastAt = t;
      return st;
    });
    const today = dayKey(t, p.tz ?? 420);
    await store.update(`days/${ref.lid}/${ref.pid}`, days => {
      days ||= {};
      days[today] = { ...(days[today] || {}), phoneEv: ((days[today] || {}).phoneEv || 0) + 1 };
      if (add && add.sec > 0) days[add.day] = { ...(days[add.day] || {}), phoneSec: ((days[add.day] || {}).phoneSec || 0) + add.sec };
      return days;
    });
    return { status: 200, text: 'ok', headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } };
  }

  return async function handle(method, path, body = {}) {
    const pm = /^\/p\/([a-z0-9]{8,32})\/(open|close|ping)$/.exec(path);
    if (pm && (method === 'GET' || method === 'POST')) {
      try { return await phoneEvent(pm[1], pm[2]); } catch (e) { return err(500, 'Erreur serveur : ' + (e && e.message || e)); }
    }
    const r = routes[`${method} ${path}`];
    if (!r) return err(404, 'Route inconnue.');
    try { return await r(body || {}); }
    catch (e) { return err(500, 'Erreur serveur : ' + (e && e.message || e)); }
  };
}

// In-memory store (tests + demo)
export function memoryStore(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    m,
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; },
    async set(k, v) { m.set(k, JSON.stringify(v)); },
    async update(k, fn) { const cur = m.has(k) ? JSON.parse(m.get(k)) : null; const v = await fn(cur); m.set(k, JSON.stringify(v)); return v; },
  };
}
