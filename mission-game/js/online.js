'use strict';
/* =========================================================================
   Çevrimiçi takım odası / Online team room
   - Oda kur / koda göre katıl (2–4 oyuncu), roller katılma sırasına göre (ROLE_SPLIT)
   - Tasarım canlı eşitlenir; her adımı sadece o adımın sorumlusu değiştirebilir
   - Herkes kendi onayını verir; fırlatma herkese aynı tohumla (seed) aynı uçuşu başlatır
   - Uçuştaki olayda sorumlu oyuncu seçer, karar herkese uygulanır
   - Sohbet: filtre, kişisel bilgi gizleme, hız sınırı, susturma; kurucu sohbeti kapatabilir / oyuncu çıkarabilir
   Altyapı: Firebase Realtime Database (window.FIREBASE_CONFIG) ya da yerel test için
   LocalNet (aynı tarayıcıdaki sekmeler; localhost'ta ?net=local veya Firebase ayarı yoksa).
   Bu dosya iki dil klasöründe de AYNIDIR; metinler LANG'e göre seçilir.
   ========================================================================= */
(function () {
  if (!window.MA_SITE) return; // claude.ai önizlemesinde çevrimiçi mod yok (orada dış bağlantılar kapalı)

  const TXT = {
    tr: {
      panelTitle: 'Arkadaşlarınla çevrimiçi oyna',
      panelText: 'Bir oda kur ve kodu arkadaşlarına gönder. Her biri kendi cihazından katılır, aynı uzay aracını birlikte tasarlarsınız (2–4 kişi).',
      name: 'Adın', namePh: 'Örn. Ayşe', create: 'Oda kur', or: 'ya da', codePh: 'Oda kodu', join: 'Katıl',
      needName: 'Önce adını yaz.', badCode: 'Oda kodu 6 karakter olmalı (örn. K7M-2QX).', noRoom: 'Bu kodla bir oda bulunamadı.',
      full: 'Bu oda dolu (en fazla 4 oyuncu).', oldRoom: 'Bu odanın süresi dolmuş. Yeni bir oda kur.', kickedJoin: 'Bu odaya tekrar katılamazsın.',
      connecting: 'Bağlanılıyor…', netFail: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
      notReady: 'Çevrimiçi mod henüz kurulmadı.',
      lobby: 'Oda', code: 'Oda kodu', copyCode: 'Kodu kopyala', copyLink: 'Davet bağlantısını kopyala', copied: 'Kopyalandı!',
      players: 'Oyuncular', host: 'kurucu', you: 'sen', kick: 'Çıkar', waitHost: 'Oda kurucusunun görevi başlatması bekleniyor…',
      mission: 'Görev', difficulty: 'Zorluk', startGame: 'Görevi başlat', leave: 'Odadan çık',
      leaveQ: 'Odadan çıkılsın mı?', leaveYes: 'Evet, çık', cancel: 'Vazgeç',
      kickQ: (n) => `${n} odadan çıkarılsın mı? Tekrar katılamaz.`, kickYes: 'Evet, çıkar',
      roomGone: 'Oda kapandı.', kicked: 'Oda kurucusu seni odadan çıkardı.',
      roomBtn: (c, n) => `Oda ${c} · ${n} oyuncu`,
      viewOnly: (role, name) => `Bu adımı ${role} (${name}) değiştirebilir. Sen izliyorsun; fikrini sohbetten yazabilirsin.`,
      notYours: (role) => `Bu ayar ${role} görevinde.`,
      approveOwn: 'Sadece kendi onayını verebilirsin.', needApprovals: 'Fırlatmak için herkesin onayı gerekiyor.',
      deciding: (role, name) => `${role} (${name}) karar veriyor. Seçenekleri birlikte konuşun!`,
      chat: 'Sohbet', chatPh: 'Mesaj yaz…', send: 'Gönder', chatSafety: 'Sohbet sadece bu odadakilerle. Gerçek adını, adresini, telefonunu ya da okulunu paylaşma.',
      chatOff: 'Sohbet oda kurucusu tarafından kapatıldı.', chatToggleOff: 'Sohbeti kapat', chatToggleOn: 'Sohbeti aç',
      tooFast: 'Biraz yavaş: birkaç saniye bekle.', mute: 'Gizle', unmute: 'Göster', hidden: '[gizlendi]', mutedNote: 'Bu oyuncunun mesajlarını gizledin.',
      close: 'Kapat', roomPanel: 'Oda bilgisi', chatEmpty: 'Henüz mesaj yok. İlk mesajı sen yaz!',
    },
    en: {
      panelTitle: 'Play online with friends',
      panelText: 'Create a room and send the code to your friends. Everyone joins from their own device and you design the same spacecraft together (2–4 players).',
      name: 'Your name', namePh: 'e.g. Alex', create: 'Create room', or: 'or', codePh: 'Room code', join: 'Join',
      needName: 'Type your name first.', badCode: 'The room code has 6 characters (e.g. K7M-2QX).', noRoom: 'No room found with this code.',
      full: 'This room is full (max 4 players).', oldRoom: 'This room has expired. Create a new one.', kickedJoin: 'You can\'t join this room again.',
      connecting: 'Connecting…', netFail: 'Could not connect. Check your internet and try again.',
      notReady: 'Online mode is not set up yet.',
      lobby: 'Room', code: 'Room code', copyCode: 'Copy code', copyLink: 'Copy invite link', copied: 'Copied!',
      players: 'Players', host: 'host', you: 'you', kick: 'Remove', waitHost: 'Waiting for the host to start the mission…',
      mission: 'Mission', difficulty: 'Difficulty', startGame: 'Start mission', leave: 'Leave room',
      leaveQ: 'Leave the room?', leaveYes: 'Yes, leave', cancel: 'Cancel',
      kickQ: (n) => `Remove ${n} from the room? They can't join again.`, kickYes: 'Yes, remove',
      roomGone: 'The room was closed.', kicked: 'The host removed you from the room.',
      roomBtn: (c, n) => `Room ${c} · ${n} players`,
      viewOnly: (role, name) => `Only the ${role} (${name}) can change this step. You are watching; share ideas in the chat.`,
      notYours: (role) => `This setting belongs to the ${role}.`,
      approveOwn: 'You can only give your own approval.', needApprovals: 'Everyone has to approve before launch.',
      deciding: (role, name) => `The ${role} (${name}) is deciding. Talk the options through together!`,
      chat: 'Chat', chatPh: 'Type a message…', send: 'Send', chatSafety: 'Chat is only with people in this room. Don\'t share your real name, address, phone number or school.',
      chatOff: 'The host turned the chat off.', chatToggleOff: 'Turn chat off', chatToggleOn: 'Turn chat on',
      tooFast: 'Slow down: wait a few seconds.', mute: 'Hide', unmute: 'Show', hidden: '[hidden]', mutedNote: 'You hid this player\'s messages.',
      close: 'Close', roomPanel: 'Room info', chatEmpty: 'No messages yet. Say hello!',
    },
  };
  const T = TXT[LANG] || TXT.tr;

  /* ------------------------------------------------------------------ */
  /* ALTYAPI / NETWORK ADAPTERS                                           */
  /* ------------------------------------------------------------------ */
  function LocalNet() {
    const KEY = 'ma_net_rooms';
    const ch = 'BroadcastChannel' in window ? new BroadcastChannel('ma_net') : null;
    let uid = null;
    try { uid = sessionStorage.getItem('ma_net_uid'); } catch { /* yok */ }
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 12); try { sessionStorage.setItem('ma_net_uid', uid); } catch { /* yok */ } }
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
    const getAt = (t, p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), t);
    const setAt = (t, p, v) => {
      const ks = p.split('/').filter(Boolean); let o = t;
      for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
      if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
    };
    let watchers = [];
    const notify = () => { const t = load(); watchers.forEach((w) => w.cb(getAt(t, 'rooms/' + w.code) ?? null)); };
    const save = (t) => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* yok */ } if (ch) ch.postMessage(1); setTimeout(notify, 0); };
    if (ch) ch.onmessage = notify;
    addEventListener('storage', (e) => { if (e.key === KEY) notify(); });
    const disc = new Set();
    addEventListener('pagehide', () => { const t = load(); disc.forEach((p) => setAt(t, p, null)); save(t); });
    return {
      kind: 'local',
      init: async () => uid,
      get uid() { return uid; },
      exists: async (code) => getAt(load(), 'rooms/' + code + '/meta') != null,
      watch(code, cb) { const w = { code, cb }; watchers.push(w); setTimeout(() => cb(getAt(load(), 'rooms/' + code) ?? null), 0); return () => { watchers = watchers.filter((x) => x !== w); }; },
      set: async (p, v) => { const t = load(); setAt(t, p, v); save(t); },
      push: async (p, v) => { const t = load(); setAt(t, p + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), v); save(t); },
      setIfAbsent: async (p, v) => { const t = load(); if (getAt(t, p) != null) return false; setAt(t, p, v); save(t); return true; },
      onDisconnectRemove(p) { disc.add(p); },
      cancelDisconnect(p) { disc.delete(p); },
    };
  }

  function FirebaseNet(cfg) {
    const V = '10.14.1';
    let db = null, uid = null, ready = null;
    const disc = {};
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
    return {
      kind: 'firebase',
      init() {
        if (!ready) ready = (async () => {
          for (const m of ['app', 'auth', 'database']) await load(`https://www.gstatic.com/firebasejs/${V}/firebase-${m}-compat.js`);
          if (!firebase.apps.length) firebase.initializeApp(cfg);
          // Her sekme ayrı oyuncu olsun (yenilemede aynı kalır): oturum sadece bu sekmede saklanır
          await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
          const cred = await firebase.auth().signInAnonymously();
          uid = cred.user.uid; db = firebase.database();
          return uid;
        })().catch((e) => { ready = null; throw e; });
        return ready;
      },
      get uid() { return uid; },
      exists: async (code) => (await db.ref('rooms/' + code + '/meta').get()).exists(),
      watch(code, cb) { const ref = db.ref('rooms/' + code); const h = ref.on('value', (s) => cb(s.val())); return () => ref.off('value', h); },
      set: (p, v) => db.ref(p).set(v === undefined ? null : v),
      push: (p, v) => db.ref(p).push(v),
      setIfAbsent: async (p, v) => (await db.ref(p).transaction((cur) => (cur === null ? v : undefined))).committed,
      onDisconnectRemove(p) { const od = db.ref(p).onDisconnect(); od.remove(); disc[p] = od; },
      cancelDisconnect(p) { if (disc[p]) { disc[p].cancel(); delete disc[p]; } },
    };
  }

  function pickNet() {
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const wantLocal = new URLSearchParams(location.search).get('net') === 'local';
    if (localHost && (wantLocal || !window.FIREBASE_CONFIG)) return LocalNet();
    if (window.FIREBASE_CONFIG) return FirebaseNet(window.FIREBASE_CONFIG);
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* DURUM / STATE                                                        */
  /* ------------------------------------------------------------------ */
  const O = { net: pickNet(), code: null, room: null, name: '', joined: 0, unwatch: null, flightId: null, leaving: false,
    chatOpen: false, seenChat: 0, muted: new Set(), lastSend: 0, pushTimer: 0, lastSig: '', busy: false };
  window.MA_ONLINE = O;
  const on = () => !!O.code && !!O.room;
  const rp = (p) => 'rooms/' + O.code + (p ? '/' + p : '');
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
  const fmtCode = (c) => (c ? c.slice(0, 3) + '-' + c.slice(3) : '');
  const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const myName = () => { try { return localStorage.getItem('ma_name') || ''; } catch { return ''; } };
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };

  /* ---------- sohbet güvenliği ---------- */
  const BAD_SUB = ['amina', 'aminako', 'orospu', 'siktir', 'sikerim', 'sikeyim', 'sikik', 'yarrak', 'gotveren', 'pezevenk', 'kahpe', 'gavat', 'ibne', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'bastard', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'motherf'];
  const BAD_WORD = ['amk', 'aq', 'pic', 'oc', 'sik', 'got', 'yarak', 'dick', 'slut', 'piss'];
  const norm = (s) => s.toLowerCase().replace(/[ıİ]/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
  function cleanText(s, max = 200) {
    s = String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    s = s.replace(/\b(https?:\/\/|www\.)\S+/gi, T.hidden)
      .replace(/\S+@\S+\.\S+/g, T.hidden)
      .replace(/\b\S+\.(com|net|org|io|tr|gg|me|ly|co|app|xyz)\b\S*/gi, T.hidden)
      .replace(/\+?\d[\d\s().-]{7,}\d/g, T.hidden);
    return s.split(' ').map((w) => {
      const n = norm(w);
      const bad = BAD_SUB.some((b) => n.includes(b)) || BAD_WORD.includes(n);
      return bad ? '*'.repeat(Math.max(3, Math.min(6, w.length))) : w;
    }).join(' ');
  }
  const cleanName = (s) => cleanText(s, 18).replace(/\[[^\]]*\]/g, '').trim().slice(0, 18);

  /* ---------- oyuncular ve roller ---------- */
  function plist() {
    const ps = (O.room && O.room.players) || {};
    return Object.entries(ps).map(([uid, p]) => ({ uid, name: p.name, joined: p.joined || 0 })).sort((a, b) => a.joined - b.joined || (a.uid < b.uid ? -1 : 1));
  }
  const _players = window.players;
  window.players = function () {
    if (!on()) return _players();
    const list = plist().slice(0, 4);
    if (!list.length) return _players();
    const split = ROLE_SPLIT[list.length];
    return list.map((p, i) => ({ idx: i, name: p.name, roles: split[i], uid: p.uid }));
  };
  const me = () => players().find((p) => p.uid === O.net.uid);
  const myRoles = () => (me() || { roles: [] }).roles;
  const isHost = () => O.room && O.room.meta && O.room.meta.hostUid === O.net.uid;
  const GROUP_OWNER = { orbit: 'MM', months: 'MM', aerobrake: 'MM', launcher: 'MM', instruments: 'SL' };
  const ownerOfGroup = (k) => GROUP_OWNER[k] || (PARTS[k] && PARTS[k].owner) || 'MM';
  const canEdit = (k) => myRoles().includes(ownerOfGroup(k));
  O.canEdit = canEdit;
  const roleName = (r) => (ROLES[r] ? ROLES[r].name : r);

  /* ------------------------------------------------------------------ */
  /* ODA / ROOM                                                           */
  /* ------------------------------------------------------------------ */
  function setErr(msg) { const e = document.getElementById('on-err'); if (e) e.textContent = msg || ''; }
  async function ensureNet() {
    if (!O.net) throw new Error(T.notReady);
    try { await O.net.init(); } catch { throw new Error(T.netFail); }
  }
  async function createRoom() {
    const name = cleanName(document.getElementById('on-name')?.value || '');
    if (!name) { setErr(T.needName); return; }
    if (O.busy) return; O.busy = true; setErr(T.connecting);
    try {
      await ensureNet();
      let code = genCode();
      for (let i = 0; i < 5 && (await O.net.exists(code)); i++) code = genCode();
      await O.net.set('rooms/' + code + '/meta', { created: Date.now(), hostUid: O.net.uid, status: 'lobby',
        scenario: S.scenario, difficulty: S.difficulty === 'sandbox' ? 'normal' : S.difficulty, chatOff: false });
      await enterRoom(code, name);
    } catch (e) { setErr(e.message || T.netFail); } finally { O.busy = false; }
  }
  async function joinRoom(codeRaw, nameRaw, silent) {
    const name = cleanName(nameRaw ?? document.getElementById('on-name')?.value ?? '');
    const code = normCode(codeRaw ?? document.getElementById('on-code')?.value);
    if (!name) { if (!silent) setErr(T.needName); return false; }
    if (code.length !== 6) { if (!silent) setErr(T.badCode); return false; }
    if (O.busy) return false; O.busy = true; if (!silent) setErr(T.connecting);
    try {
      await ensureNet();
      if (!(await O.net.exists(code))) { if (!silent) setErr(T.noRoom); return false; }
      const room = await new Promise((res) => { const un = O.net.watch(code, (r) => { setTimeout(() => un(), 0); res(r); }); });
      if (!room || !room.meta) { if (!silent) setErr(T.noRoom); return false; }
      if (room.kicked && room.kicked[O.net.uid]) { if (!silent) setErr(T.kickedJoin); return false; }
      if (Date.now() - (room.meta.created || 0) > 24 * 3600 * 1000) { if (!silent) setErr(T.oldRoom); return false; }
      const count = Object.keys(room.players || {}).filter((u) => u !== O.net.uid).length;
      if (count >= 4) { if (!silent) setErr(T.full); return false; }
      await enterRoom(code, name);
      return true;
    } catch (e) { if (!silent) setErr(e.message || T.netFail); return false; } finally { O.busy = false; }
  }
  async function enterRoom(code, name) {
    O.code = code; O.name = name; O.joined = Date.now(); O.leaving = false; O.flightId = null; O.lastSig = '';
    try { localStorage.setItem('ma_name', name); sessionStorage.setItem('ma_room', JSON.stringify({ code, name })); } catch { /* yok */ }
    await O.net.set(rp('players/' + O.net.uid), { name, joined: O.joined });
    O.net.onDisconnectRemove(rp('players/' + O.net.uid));
    O.unwatch = O.net.watch(code, onRoom);
    try { const u = new URL(location.href); u.searchParams.set('oda', code); history.replaceState(null, '', u); } catch { /* yok */ }
    S.mode = 'team';
  }
  async function leaveRoom() {
    if (!O.code) return;
    O.leaving = true;
    const last = plist().length <= 1;
    try {
      O.net.cancelDisconnect(rp('players/' + O.net.uid));
      if (last) await O.net.set(rp(''), null);
      else { await O.net.set(rp('approvals/' + O.net.uid), null); await O.net.set(rp('players/' + O.net.uid), null); }
    } catch { /* bağlantı yoksa da çık */ }
    endOnline();
  }
  function endOnline(msg) {
    if (O.unwatch) O.unwatch();
    O.unwatch = null; O.code = null; O.room = null; O.flightId = null; O.chatOpen = false; O.seenChat = 0;
    try { sessionStorage.removeItem('ma_room'); const u = new URL(location.href); u.searchParams.delete('oda'); history.replaceState(null, '', u); } catch { /* yok */ }
    document.getElementById('on-chat')?.remove(); document.getElementById('on-chat-btn')?.remove();
    S.mode = 'solo'; S.approvals = {}; S.sim = null; closeModal(); S.screen = 'title'; render();
    if (msg) toast(msg);
  }

  /* ---------- oda değişince / on room snapshot ---------- */
  function onRoom(room) {
    if (!O.code) return;
    if (!room || !room.meta) { if (!O.leaving) endOnline(T.roomGone); return; }
    O.room = room;
    const uid = O.net.uid;
    if (room.kicked && room.kicked[uid]) { O.net.cancelDisconnect(rp('players/' + uid)); endOnline(T.kicked); return; }
    if (!room.players || !room.players[uid]) { // bağlantı kopup geri geldiyse yeniden ekle
      if (!O.leaving) { O.net.set(rp('players/' + uid), { name: O.name, joined: O.joined }); O.net.onDisconnectRemove(rp('players/' + uid)); }
      return;
    }
    const list = plist();
    if (!room.players[room.meta.hostUid] && list[0] && list[0].uid === uid) O.net.set(rp('meta/hostUid'), uid);

    S.scenario = room.meta.scenario || S.scenario;
    S.difficulty = room.meta.difficulty || S.difficulty;
    S.mode = 'team';
    const merged = { ...defaultDesign(SCENARIOS[S.scenario]), ...(room.design || {}), instruments: { ...((room.design && room.design.instruments) || {}) } };
    S.design = merged;
    S.approvals = {};
    players().forEach((p) => { if (room.approvals && room.approvals[p.uid]) S.approvals[p.idx] = true; });
    const sig = JSON.stringify([merged, room.approvals || null, list.map((p) => p.uid + p.name), room.meta.scenario, room.meta.difficulty, room.meta.hostUid]);
    const changed = sig !== O.lastSig; O.lastSig = sig;

    const f = room.flight;
    if (f && f.id && f.id !== O.flightId) { O.flightId = f.id; startFlight(f); }
    else if (room.meta.status === 'lobby') { if (S.screen !== 'lobby') showLobby(); else if (changed) renderLobby(); }
    else if (S.screen === 'lobby' || S.screen === 'title') { S.screen = 'design'; S.step = 'mission'; render(); }
    else if (S.screen === 'design' && changed) refreshDesign();
    else if (S.screen === 'sim') applyDecisionIfReady();
    renderRoomButton(); renderChat();
  }

  /* ------------------------------------------------------------------ */
  /* LOBİ / LOBBY                                                         */
  /* ------------------------------------------------------------------ */
  function showLobby() { if (S.ui) { cancelAnimationFrame(S.ui.raf); S.ui = null; } closeModal(); S.screen = 'lobby'; renderLobby(); window.scrollTo(0, 0); document.dispatchEvent(new CustomEvent('ma:screen', { detail: 'lobby' })); }
  function renderLobby() {
    if (S.screen !== 'lobby') return;
    const host = isHost(), ps = players(), uid = O.net.uid;
    const link = (() => { try { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('oda', O.code); return u.toString(); } catch { return ''; } })();
    $('#app').innerHTML = `<div class="topbar"><div class="brand">${esc(LANG === 'tr' ? 'Görev Mimarı' : 'Mission Architect')}</div><div class="mission-name grow">${T.lobby} ${fmtCode(O.code)}</div>
        <button class="btn small ghost" data-act="on-leave">${T.leave}</button>${langSwitch()}</div>
      <div class="title-wrap on-lobby">
        <div class="panel pad on-codebox">
          <div class="tag">${T.code}</div>
          <div class="on-code mono" aria-label="${T.code}">${fmtCode(O.code)}</div>
          <div class="row wrap"><button class="btn" data-act="on-copy" data-v="${O.code}">${T.copyCode}</button>
          <button class="btn" data-act="on-copy" data-v="${esc(link)}">${T.copyLink}</button></div>
        </div>
        <div class="setup-grid">
          <div class="panel pad"><h3 style="margin-bottom:10px">${T.players} (${ps.length}/4)</h3><div class="choice-list">
            ${ps.map((p) => `<div class="goal"><div class="grow"><b>${esc(p.name)}</b>${p.uid === uid ? ` <span class="chip">${T.you}</span>` : ''}${O.room.meta.hostUid === p.uid ? ` <span class="chip primary">${T.host}</span>` : ''}
              <div class="role-chips" style="margin-top:4px">${p.roles.map((r) => `<span class="chip" style="border-color:${ROLES[r].color};color:${ROLES[r].color}">${ROLES[r].name}</span>`).join('')}</div></div>
              ${host && p.uid !== uid ? `<button class="btn small" data-act="on-kick" data-v="${p.uid}">${T.kick}</button>` : ''}</div>`).join('')}
          </div></div>
          <div class="panel pad"><h3 style="margin-bottom:10px">${T.mission}</h3>
            <div class="choice-list">${Object.values(SCENARIOS).map((sc) => `<button class="choice ${S.scenario === sc.id ? 'sel' : ''}" data-act="on-scen" data-v="${sc.id}" ${host ? '' : 'disabled'}>
              <img src="${planetImage(sc.body)}" alt="" width="36" height="36"><span><b>${sc.name}</b><small>${sc.level} · ${fmtMoney(sc.budget)}</small></span></button>`).join('')}</div>
            <h3 style="margin:14px 0 8px">${T.difficulty}</h3>
            <div class="seg">${Object.entries(DIFFICULTY).filter(([k]) => k !== 'sandbox').map(([k, d]) => `<button data-act="on-diff" data-v="${k}" class="${S.difficulty === k ? 'sel' : ''}" ${host ? '' : 'disabled'}>${d.name}</button>`).join('')}</div>
          </div>
        </div>
        <div class="start-bar">${host ? `<button class="btn go big" data-act="on-start">${T.startGame}</button>` : `<p class="muted">${T.waitHost}</p>`}</div>
      </div>`;
  }
  async function startGame() {
    if (!isHost()) return;
    await O.net.set(rp('design'), defaultDesign(SCENARIOS[S.scenario]));
    await O.net.set(rp('approvals'), null);
    await O.net.set(rp('flight'), null);
    await O.net.set(rp('meta/status'), 'design');
  }

  /* ------------------------------------------------------------------ */
  /* TASARIM EŞİTLEME / DESIGN SYNC                                       */
  /* ------------------------------------------------------------------ */
  function pushDesign() {
    clearTimeout(O.pushTimer);
    O.pushTimer = setTimeout(() => { if (!on()) return; O.net.set(rp('design'), S.design); O.net.set(rp('approvals'), null); }, 120);
  }
  const _odc = window.onDesignChange;
  window.onDesignChange = function (...a) { _odc.apply(this, a); if (on()) pushDesign(); };
  document.addEventListener('input', (e) => { if (on() && e.target.dataset && e.target.dataset.act === 'months') pushDesign(); });

  function decorateDesign() {
    if (!on() || S.screen !== 'design') return;
    const st = STEPS.find((s) => s.id === S.step);
    const main = document.getElementById('main-col');
    if (!main || !st) return;
    const mine = myRoles();
    const owners = st.owners || [st.owner];
    const viewOnly = st.owner !== 'ALL' && !owners.some((r) => mine.includes(r));
    main.classList.toggle('view-only', viewOnly);
    main.querySelector('.on-note')?.remove();
    if (viewOnly) {
      const owner = ownerOf(owners[0]);
      const note = document.createElement('div');
      note.className = 'on-note'; note.setAttribute('role', 'note');
      note.textContent = T.viewOnly(owners.map(roleName).join(' / '), [...new Set(owners.map((r) => (ownerOf(r) || {}).name).filter(Boolean))].join(' / '));
      main.insertBefore(note, main.children[1] || null);
    }
    document.querySelectorAll('[data-act="months"], [data-act="aero"]').forEach((i) => { i.disabled = !canEdit('months'); });
    const my = me();
    document.querySelectorAll('[data-act="approve"]').forEach((b) => { if (!my || b.dataset.v !== String(my.idx)) b.disabled = true; });
  }

  /* ------------------------------------------------------------------ */
  /* UÇUŞ / FLIGHT                                                        */
  /* ------------------------------------------------------------------ */
  function launchTogether() {
    const R = calc();
    if (R.errors.length) return;
    if (!players().every((p) => S.approvals[p.idx])) { toast(T.needApprovals); return; }
    O.net.set(rp('flight'), { id: Date.now().toString(36) + '-' + O.net.uid.slice(0, 5), seed: Math.floor(Math.random() * 2147483647), by: O.net.uid, design: S.design });
  }
  function startFlight(f) {
    if (f.design) S.design = { ...defaultDesign(SCENARIOS[S.scenario]), ...f.design, instruments: { ...(f.design.instruments || {}) } };
    closeModal();
    S.sim = createSim(calc(), f.seed);
    S.screen = 'sim';
    render();
  }
  const decisionAt = (k) => { const ds = O.room && O.room.flight && O.room.flight.decisions; return ds ? ds[k] : null; };
  function applyDecisionIfReady() {
    const sim = S.sim;
    if (!sim || !sim.pending) return;
    const d = decisionAt(sim.decisions.length);
    if (!d) return;
    resolveEvent(sim, d.idx); showEventResult(); updateSimPanels();
    if (sim.done) afterStep();
  }
  const _sem = window.showEventModal;
  window.showEventModal = function () {
    if (!on()) return _sem();
    const sim = S.sim;
    if (decisionAt(sim.decisions.length)) { applyDecisionIfReady(); return; }
    _sem();
    const owner = ownerOf(sim.pending.ev.role);
    if (owner && owner.uid === O.net.uid) return;
    document.querySelectorAll('#modal-root .opt-btn').forEach((b) => { b.disabled = true; });
    const dec = document.querySelector('#modal-root .decider');
    if (dec) dec.textContent = T.deciding(roleName(sim.pending.ev.role), owner ? owner.name : '');
  };

  /* ------------------------------------------------------------------ */
  /* ODA DÜĞMESİ, ODA BİLGİSİ / ROOM BUTTON & PANEL                       */
  /* ------------------------------------------------------------------ */
  function renderRoomButton() {
    if (!on() || S.screen === 'lobby' || S.screen === 'title') return;
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    let b = bar.querySelector('[data-act="on-room"]');
    if (!b) { b = document.createElement('button'); b.className = 'btn small on-roombtn'; b.dataset.act = 'on-room'; bar.insertBefore(b, bar.children[2] || null); }
    b.textContent = T.roomBtn(fmtCode(O.code), plist().length);
  }
  function roomPanel() {
    const host = isHost(), uid = O.net.uid, chatOff = !!O.room.meta.chatOff;
    $('#modal-root').innerHTML = `<div class="modal-bg" data-act="bgclose"><div class="modal" role="dialog" aria-modal="true" aria-label="${T.roomPanel}">
      <h2>${T.lobby} ${fmtCode(O.code)}</h2>
      <div class="row wrap"><button class="btn small" data-act="on-copy" data-v="${O.code}">${T.copyCode}</button></div>
      <div class="choice-list">${players().map((p) => `<div class="goal"><div class="grow"><b>${esc(p.name)}</b>${p.uid === uid ? ` <span class="chip">${T.you}</span>` : ''}${O.room.meta.hostUid === p.uid ? ` <span class="chip primary">${T.host}</span>` : ''}
        <div class="role-chips" style="margin-top:4px">${p.roles.map((r) => `<span class="chip" style="border-color:${ROLES[r].color};color:${ROLES[r].color}">${ROLES[r].name}</span>`).join('')}</div></div>
        ${host && p.uid !== uid ? `<button class="btn small" data-act="on-kick" data-v="${p.uid}">${T.kick}</button>` : ''}</div>`).join('')}</div>
      <div class="row wrap">${host ? `<button class="btn small" data-act="on-chatoff">${chatOff ? T.chatToggleOn : T.chatToggleOff}</button>` : ''}
        <span class="grow"></span><button class="btn small" data-act="on-leave">${T.leave}</button><button class="btn small primary" data-act="closemodal">${T.close}</button></div>
    </div></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* SOHBET / CHAT                                                        */
  /* ------------------------------------------------------------------ */
  function chatMessages() {
    const c = (O.room && O.room.chat) || {};
    return Object.values(c).filter((m) => m && typeof m.text === 'string').sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-80);
  }
  function renderChat() {
    if (!on()) return;
    let btn = document.getElementById('on-chat-btn');
    if (!btn) { btn = document.createElement('button'); btn.id = 'on-chat-btn'; btn.className = 'btn primary'; btn.dataset.act = 'on-chat'; document.body.appendChild(btn); }
    const msgs = chatMessages();
    const unread = O.chatOpen ? 0 : msgs.filter((m) => m.ts > O.seenChat && m.uid !== O.net.uid).length;
    btn.innerHTML = `${T.chat}${unread ? ` <span class="on-badge">${unread}</span>` : ''}`;
    btn.setAttribute('aria-expanded', String(O.chatOpen));
    let panel = document.getElementById('on-chat');
    if (!O.chatOpen) { panel?.remove(); return; }
    O.seenChat = Math.max(O.seenChat, ...msgs.map((m) => m.ts || 0), 0);
    const chatOff = !!O.room.meta.chatOff;
    const roleColor = (uid) => { const p = players().find((x) => x.uid === uid); return p ? ROLES[p.roles[0]].color : 'var(--muted)'; };
    const body = msgs.length ? msgs.map((m) => {
      const mine = m.uid === O.net.uid, muted = O.muted.has(m.uid);
      return `<div class="on-msg ${mine ? 'mine' : ''}"><div class="on-msg-head"><b style="color:${roleColor(m.uid)}">${esc(m.name || '?')}</b>
        ${mine ? '' : `<button class="on-mute" data-act="on-mute" data-v="${esc(m.uid)}">${muted ? T.unmute : T.mute}</button>`}</div>
        <div class="on-msg-text">${muted ? `<i class="muted">${T.mutedNote}</i>` : esc(m.text)}</div></div>`;
    }).join('') : `<p class="muted">${T.chatEmpty}</p>`;
    const keep = panel && panel.querySelector('#on-chat-input');
    const draft = keep ? keep.value : '';
    const hadFocus = keep && document.activeElement === keep;
    if (!panel) { panel = document.createElement('section'); panel.id = 'on-chat'; panel.setAttribute('aria-label', T.chat); document.body.appendChild(panel); }
    panel.innerHTML = `<header><b>${T.chat}</b><button class="btn small ghost" data-act="on-chat">${T.close}</button></header>
      <p class="on-safety">${T.chatSafety}</p>
      <div class="on-msgs" aria-live="polite">${body}</div>
      ${chatOff ? `<p class="on-safety">${T.chatOff}</p>` : `<form class="on-form" data-on-chat-form><input id="on-chat-input" maxlength="200" autocomplete="off" placeholder="${T.chatPh}" aria-label="${T.chatPh}"><button class="btn primary small" type="submit">${T.send}</button></form>`}`;
    const list = panel.querySelector('.on-msgs'); list.scrollTop = list.scrollHeight;
    const inp = panel.querySelector('#on-chat-input');
    if (inp) { inp.value = draft; if (hadFocus) inp.focus(); }
  }
  async function sendChat(text) {
    if (!on() || O.room.meta.chatOff) return;
    const now = Date.now();
    if (now - O.lastSend < 1500) { toast(T.tooFast); return false; }
    const clean = cleanText(text);
    if (!clean) return false;
    O.lastSend = now;
    await O.net.push(rp('chat'), { uid: O.net.uid, name: O.name, text: clean, ts: now });
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* BAŞLANGIÇ EKRANI PANELİ / TITLE SCREEN PANEL                         */
  /* ------------------------------------------------------------------ */
  function injectTitlePanel() {
    if (S.screen !== 'title' || on() || document.getElementById('online-panel')) return;
    const anchor = document.querySelector('.title-wrap .start-bar');
    if (!anchor) return;
    const code = normCode(new URLSearchParams(location.search).get('oda') || '');
    const ready = !!O.net;
    const el = document.createElement('div');
    el.className = 'panel pad online-panel'; el.id = 'online-panel';
    el.innerHTML = `<div class="section-title"><span class="n">+</span> ${T.panelTitle}</div>
      <p class="muted" style="margin-bottom:12px">${ready ? T.panelText : T.notReady}</p>
      ${ready ? `<div class="on-form-grid">
        <label class="on-field"><span>${T.name}</span><input id="on-name" maxlength="18" autocomplete="nickname" placeholder="${T.namePh}" value="${esc(myName())}"></label>
        <button class="btn primary" data-act="on-create">${T.create}</button>
        <span class="muted on-or">${T.or}</span>
        <label class="on-field"><span>${T.codePh}</span><input id="on-code" maxlength="7" autocomplete="off" placeholder="K7M-2QX" value="${fmtCode(code)}" style="text-transform:uppercase"></label>
        <button class="btn" data-act="on-join">${T.join}</button>
      </div><p id="on-err" class="on-err" role="alert"></p>` : ''}`;
    anchor.insertAdjacentElement('afterend', el);
    if (code) { el.scrollIntoView({ block: 'center' }); (document.getElementById('on-name').value ? document.querySelector('[data-act="on-join"]') : document.getElementById('on-name')).focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------------ */
  /* OLAYLAR / EVENTS                                                     */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, v = el.dataset.v;
    if (act.startsWith('on-')) {
      stop(e);
      if (act === 'on-create') createRoom();
      else if (act === 'on-join') joinRoom();
      else if (act === 'on-leave') { closeModal(); askConfirm(T.leaveQ, T.leaveYes, T.cancel, leaveRoom); }
      else if (act === 'on-copy') { const done = () => toast(T.copied); (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(done, () => { const t = document.createElement('textarea'); t.value = v; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch { /* yok */ } t.remove(); }); }
      else if (act === 'on-scen' && isHost()) O.net.set(rp('meta/scenario'), v);
      else if (act === 'on-diff' && isHost()) O.net.set(rp('meta/difficulty'), v);
      else if (act === 'on-start') startGame();
      else if (act === 'on-room') roomPanel();
      else if (act === 'on-kick' && isHost()) { const p = plist().find((x) => x.uid === v); closeModal(); askConfirm(T.kickQ(p ? p.name : ''), T.kickYes, T.cancel, async () => { await O.net.set(rp('kicked/' + v), true); await O.net.set(rp('players/' + v), null); await O.net.set(rp('approvals/' + v), null); }); }
      else if (act === 'on-chatoff' && isHost()) { O.net.set(rp('meta/chatOff'), !O.room.meta.chatOff); closeModal(); }
      else if (act === 'on-chat') { O.chatOpen = !O.chatOpen; renderChat(); if (O.chatOpen) document.getElementById('on-chat-input')?.focus(); else document.getElementById('on-chat-btn')?.focus(); }
      else if (act === 'on-mute') { if (O.muted.has(v)) O.muted.delete(v); else O.muted.add(v); renderChat(); }
      return;
    }
    if (!on()) return;
    if (act === 'set' || act === 'inst') {
      const k = act === 'inst' ? 'instruments' : el.dataset.k;
      if (!canEdit(k)) { stop(e); toast(T.notYours(roleName(ownerOfGroup(k)))); }
      return;
    }
    if (act === 'approve') {
      stop(e);
      const my = me();
      if (!my || String(my.idx) !== v) { toast(T.approveOwn); return; }
      O.net.set(rp('approvals/' + O.net.uid), O.room.approvals && O.room.approvals[O.net.uid] ? null : true);
      return;
    }
    if (act === 'launch' || act === 'refly') { stop(e); launchTogether(); return; }
    if (act === 'choose') { stop(e); if (S.sim && S.sim.pending) O.net.setIfAbsent(rp('flight/decisions/' + S.sim.decisions.length), { idx: +v, by: O.net.uid }); return; }
    if (act === 'exit' || act === 'home') { stop(e); askConfirm(T.leaveQ, T.leaveYes, T.cancel, leaveRoom); }
  }, true);
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-on-chat-form]')) return;
    e.preventDefault();
    // Kutuyu göndermeden ÖNCE boşalt: Firebase mesajı anında geri bildirip paneli yeniden çiziyor,
    // o sırada kutuda metin kalırsa "taslak" sanılıp yeni kutuya geri yazılıyordu.
    const inp = document.getElementById('on-chat-input');
    const text = inp.value;
    if (!text.trim()) return;
    inp.value = '';
    sendChat(text).then((ok) => {
      const cur = document.getElementById('on-chat-input');
      if (!cur) return;
      if (!ok && !cur.value) cur.value = text; // gönderilemediyse (hız sınırı vb.) metni geri koy
      cur.focus();
    }).catch(() => { const cur = document.getElementById('on-chat-input'); if (cur && !cur.value) cur.value = text; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && (e.target.id === 'on-code' || e.target.id === 'on-name') && S.screen === 'title') {
      e.preventDefault(); if (e.target.id === 'on-code' || normCode(document.getElementById('on-code')?.value).length === 6) joinRoom(); else createRoom();
    }
  });
  document.addEventListener('ma:screen', (e) => {
    const s = e.detail;
    if (s === 'title') { if (on()) { showLobby(); return; } injectTitlePanel(); }
    if (on()) { if (s === 'design') decorateDesign(); renderRoomButton(); renderChat(); }
  });
  document.addEventListener('ma:refresh', () => decorateDesign());

  /* ---------- açılış: dil değişimi / yenileme sonrası odaya geri dön ---------- */
  (async () => {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('ma_room') || 'null'); } catch { saved = null; }
    if (S.screen === 'title') injectTitlePanel();
    if (saved && saved.code && O.net) { const ok = await joinRoom(saved.code, saved.name, true); if (!ok) { try { sessionStorage.removeItem('ma_room'); } catch { /* yok */ } } }
  })();
})();
