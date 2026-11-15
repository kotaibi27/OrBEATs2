/* ORBEAT BOARD: storage adapter. This is the ONLY file that knows where pieces and likes live.
 * To share the board online, replace the functions below (see "How to make the board shared online" in the README).
 *
 * A piece looks like:
 *   { id, title, nick, desc, recipe, dur, peaks:[0..1 x 48], created: ms, sample: bool, hidden: bool, likeTimes: [ms, ...], audio: Blob }
 *
 * Default: pieces (with their audio and a hidden flag) in IndexedDB, the likes (as timestamps) kept inside each piece.
 * Every function returns a Promise, so a network version can be dropped in without touching board.js. */
(function () {
  'use strict';

  var DB = 'orbeat-board', STORE = 'pieces';

  /* ---------- weeks: Sunday 00:00 to Saturday 23:59 in Asia/Kuwait (UTC+3, no daylight saving) ---------- */
  var DAY = 86400000, WEEK = 7 * DAY, KUWAIT = 3 * 3600000;
  function weekStart(ts) {
    var day = Math.floor((ts + KUWAIT) / DAY);          // days since 1970-01-01 in Kuwait
    var dow = (day + 4) % 7;                            // 1970-01-01 was a Thursday; 0 = Sunday
    return (day - dow) * DAY - KUWAIT;
  }
  function weekRange(which, now) {                      // 'week' | 'last' | 'all' -> { from, to } in ms
    now = now || Date.now();
    var s = weekStart(now);
    if (which === 'week') return { from: s, to: s + WEEK };
    if (which === 'last') return { from: s - WEEK, to: s };
    return { from: 0, to: Infinity };
  }

  /* ---------- small helpers ---------- */
  function read(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  var dbPromise = null;
  function db() {
    if (!dbPromise) dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode), out = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { reject(t.error); };
      });
    });
  }
  function all() { return tx('readonly', function (s) { return s.getAll(); }); }

  /* Each piece keeps its likes as a list of timestamps (piece.likeTimes), so a week's likes can be counted.
     Nothing about the visitor is stored. */
  function countIn(p, r) {
    var n = 0, t = p.likeTimes || [], i;
    for (i = 0; i < t.length; i++) if (t[i] >= r.from && t[i] < r.to) n++;
    return n;
  }

  /* ---------- the adapter ---------- */

  /* Pieces for a range ('week', 'last' or 'all'), most likes in that range first. Ties go to the piece posted first.
     Weekly lists show pieces posted that week or liked that week. Hidden pieces are left out unless opts.includeHidden is true (staff only).
     p.likes = likes in the range, p.likesTotal = likes ever. */
  function listPieces(range, opts) {
    var r = weekRange(range), withHidden = !!(opts && opts.includeHidden), weekly = range === 'week' || range === 'last';
    return all().then(function (list) {
      return list
        .filter(function (p) { return (withHidden || !p.hidden) && (!weekly || (p.created < r.to && (p.created >= r.from || countIn(p, r) > 0))); })
        .map(function (p) { p.likes = countIn(p, r); p.likesTotal = (p.likeTimes || []).length; return p; })
        .sort(function (a, b) { return b.likes - a.likes || a.created - b.created; });
    });
  }

  function addPiece(piece) {
    piece.id = piece.id || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    piece.created = piece.created || Date.now();
    piece.hidden = false; piece.likeTimes = [];
    return tx('readwrite', function (s) { s.put(piece); }).then(function () { return piece; });
  }

  /* Add one like (no limits) and return the new total. Read and write happen in one transaction, so fast clicks are never lost. */
  function like(pieceId) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, 'readwrite'), s = t.objectStore(STORE), g = s.get(pieceId), total = 0;
        g.onsuccess = function () {
          var p = g.result;
          if (!p || p.hidden) { t.abort(); reject(new Error('No such piece')); return; }
          p.likeTimes = p.likeTimes || []; p.likeTimes.push(Date.now()); total = p.likeTimes.length; s.put(p);
        };
        t.oncomplete = function () { resolve(total); };
        t.onerror = t.onabort = function () { reject(t.error || new Error('Could not save the like')); };
      });
    });
  }

  /* Last week's winner among VISIBLE pieces: the most likes received last week, ties to the piece posted first. Samples never win. null = no winner yet. */
  function getWeeklyWinner() {
    return listPieces('last').then(function (list) {
      return list.filter(function (p) { return !p.sample && p.likes > 0; })[0] || null;
    });
  }

  /* ---------- staff tools ---------- */
  function setHidden(id, hidden) {
    return all().then(function (list) {
      var p = list.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.hidden = !!hidden; return tx('readwrite', function (s) { s.put(p); });
    });
  }
  function hidePiece(id) { return setHidden(id, true); }
  /* Remove the likes received this week (Sunday to Saturday, Kuwait time). */
  function resetWeekLikes() {
    var r = weekRange('week');
    return tx('readwrite', function (s) {
      var req = s.getAll();
      req.onsuccess = function () {
        req.result.forEach(function (p) {
          if (p.likeTimes && p.likeTimes.length) { p.likeTimes = p.likeTimes.filter(function (t) { return t < r.from || t >= r.to; }); s.put(p); }
        });
      };
      return req;
    });
  }
  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;                    // stop spreadsheets running typed text as a formula
    return '"' + v.replace(/"/g, '""') + '"';
  }
  /* One CSV: a row per piece (with like counts) and a row per like (with its time). */
  function exportCsv() {
    var wk = weekRange('week');
    return listPieces('all', { includeHidden: true }).then(function (list) {
      var rows = [['type', 'piece_id', 'title', 'nickname', 'sample', 'hidden', 'piece_posted', 'likes_total', 'likes_this_week', 'like_time']];
      list.forEach(function (p) {
        rows.push(['piece', p.id, p.title, p.nick, p.sample ? 'yes' : 'no', p.hidden ? 'yes' : 'no', new Date(p.created).toISOString(), p.likesTotal, countIn(p, wk), '']);
      });
      list.forEach(function (p) {
        (p.likeTimes || []).forEach(function (t) { rows.push(['like', p.id, '', '', '', '', '', '', '', new Date(t).toISOString()]); });
      });
      return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    });
  }
  function hasSamples() { return all().then(function (l) { return l.some(function (p) { return p.sample; }); }); }

  window.ORBEAT_STORE = {
    listPieces: listPieces, addPiece: addPiece, like: like, getWeeklyWinner: getWeeklyWinner,
    setHidden: setHidden, hidePiece: hidePiece, resetWeekLikes: resetWeekLikes, exportCsv: exportCsv, hasSamples: hasSamples,
    weekRange: weekRange, weekEnd: function () { return weekRange('week').to; }
  };
})();

/* ---------------------------------------------------------------------------------------------
 * EXAMPLE: the same adapter on Supabase (https://supabase.com). Commented out on purpose.
 * Needs: a table "pieces" (id, title, nick, description, recipe jsonb, dur, peaks jsonb, created timestamptz),
 * a Storage bucket "orbeats" for the audio, and a table "likes" (piece_id, created)
 * See the README for the full steps.
 *
 *   var sb = supabase.createClient('PASTE_PROJECT_URL', 'PASTE_ANON_KEY');   // load @supabase/supabase-js first
 *
 *   function listPieces(range) {
 *     var r = weekRange(range);
 *     return sb.from('pieces').select('*, likes(count)').gte('created', new Date(r.from).toISOString())
 *       .lt('created', r.to === Infinity ? '9999-01-01' : new Date(r.to).toISOString()).then(function (res) { ...map to the piece shape above... });
 *   }
 *   function addPiece(piece) {
 *     return sb.storage.from('orbeats').upload(piece.id + '.webm', piece.audio).then(function () {
 *       return sb.from('pieces').insert({ id: piece.id, title: piece.title, nick: piece.nick, description: piece.desc, recipe: piece.recipe, dur: piece.dur, peaks: piece.peaks });
 *     });
 *   }
 *   function like(id) { return sb.from('likes').insert({ piece_id: id }); }    // then count the rows, or use an RPC that returns the new total
 * --------------------------------------------------------------------------------------------- */
