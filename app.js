/*
 * HTML Playground
 * A zero-setup page for pasting HTML (for example from Gemini) and seeing it run.
 * Plain JavaScript, no dependencies, no build step, no server.
 *
 * Pasted code is NEVER run in this page. It only runs inside a sandboxed
 * <iframe srcdoc> without allow-same-origin, so it gets an opaque origin and
 * cannot reach this page's DOM, storage, or top-level navigation.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  // The folder is part of the key so that two copies of the playground on one
  // github.io account (they share storage) do not overwrite each other's code.
  var STORAGE_PREFIX = 'html-playground:v1:' + window.location.pathname.replace(/[^\/]*$/, '') + ':';
  var KEYS = {
    code: STORAGE_PREFIX + 'code',
    prefs: STORAGE_PREFIX + 'prefs',
    running: STORAGE_PREFIX + 'running:',   // + tab id; see "Freeze recovery"
    previewLs: STORAGE_PREFIX + 'preview-ls:' // + code fingerprint; see "Preview storage"
  };
  var PREVIEW_STORAGE_MAX_KEYS = 200;
  var PREVIEW_STORAGE_MAX_KEY_LEN = 500;
  var PREVIEW_STORAGE_MAX_VALUE_LEN = 100000;
  var PREVIEW_STORAGE_MAX_JSON = 2000000;
  var AUTO_RUN_DELAY = 900;       // ms of quiet typing before the preview restarts
  var SAVE_DELAY = 400;           // ms of quiet typing before autosaving
  var HEARTBEAT_INTERVAL = 1000;  // ms between "this tab is still alive" notes while a preview runs
  var HEARTBEAT_STALE = 3000;     // ms without a note before we assume that tab froze
  var MAX_ANALYZE_LENGTH = 2000000; // skip paste hints for enormous code
  var DOWNLOAD_NAME = 'my-creation.html';
  var NARROW_QUERY = '(max-width: 820px)';

  // What the preview is allowed to do. Deliberately NOT included:
  //   allow-same-origin   (would give pasted code access to this page and its storage)
  //   allow-top-navigation*  (would let pasted code replace this page)
  //   allow-popups-to-escape-sandbox (popups keep these same restrictions)
  //   allow-downloads (would let pasted code save files to the Downloads folder without a click)
  var SANDBOX = 'allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock';
  // Browser features the preview may use. Camera, microphone and location are not granted.
  var ALLOW = 'fullscreen; clipboard-write; autoplay';

  var PROMPT_TIP = "Make it a single HTML file with all of the CSS and JavaScript inside it. Don't use React, Tailwind, or other outside libraries. Give me the complete file in one code block.";
  var REWRITE_REQUEST = 'Please rewrite this as one complete HTML file that I can open directly in a web browser. Put all of the CSS and JavaScript inside the same file, and do not use React, imports, or any build tools.';
  var COMPLETE_REQUEST = 'Your code was cut off. Please give me the complete HTML file again, from <!DOCTYPE html> all the way to </html>, in one code block.';

  var SAMPLE = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>Bouncing Balls</title>',
    '  <style>',
    '    body {',
    '      margin: 0;',
    '      padding: 24px 16px;',
    '      font-family: system-ui, sans-serif;',
    '      text-align: center;',
    '      background: #eef4ff;',
    '      color: #1e293b;',
    '    }',
    '    h1 { margin: 0 0 4px; }',
    '    p { margin: 0 0 16px; color: #475569; }',
    '    canvas {',
    '      width: 100%;',
    '      max-width: 640px;',
    '      background: white;',
    '      border-radius: 16px;',
    '      box-shadow: 0 4px 16px rgba(30, 41, 59, 0.15);',
    '      cursor: pointer;',
    '    }',
    '    .controls {',
    '      display: flex;',
    '      flex-wrap: wrap;',
    '      gap: 12px 20px;',
    '      justify-content: center;',
    '      align-items: center;',
    '      margin-top: 16px;',
    '    }',
    '    label { font-weight: 600; }',
    '    input[type="range"] { width: 180px; vertical-align: middle; }',
    '    button {',
    '      font: inherit;',
    '      font-weight: 600;',
    '      padding: 10px 18px;',
    '      border: none;',
    '      border-radius: 999px;',
    '      background: #4f46e5;',
    '      color: white;',
    '      cursor: pointer;',
    '    }',
    '    button:hover { background: #4338ca; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <h1>🏀 Bouncing Balls</h1>',
    '  <p>Click the box to drop a ball. Move the slider to change gravity.</p>',
    '',
    '  <canvas id="box" width="640" height="360"></canvas>',
    '',
    '  <div class="controls">',
    '    <label>',
    '      Gravity',
    '      <input type="range" id="gravity" min="0" max="2" step="0.1" value="0.5">',
    '      <output id="gravityValue">0.5</output>',
    '    </label>',
    '    <button id="addBall">Add a ball</button>',
    '    <button id="reset">Start over</button>',
    '  </div>',
    '  <p id="count" style="margin-top: 12px;">Balls: 0</p>',
    '',
    '  <script>',
    '    // 🎨 Try this: change these colors, then watch the preview update!',
    '    const colors = ["tomato", "gold", "mediumseagreen", "dodgerblue", "orchid"];',
    '',
    '    const canvas = document.getElementById("box");',
    '    const ctx = canvas.getContext("2d");',
    '    const gravitySlider = document.getElementById("gravity");',
    '    const gravityValue = document.getElementById("gravityValue");',
    '    const countText = document.getElementById("count");',
    '    let balls = [];',
    '',
    '    function addBall(x, y) {',
    '      balls.push({',
    '        x: x,',
    '        y: y,',
    '        radius: 12 + Math.random() * 18,',
    '        speedX: (Math.random() - 0.5) * 10,',
    '        speedY: 0,',
    '        color: colors[balls.length % colors.length]',
    '      });',
    '      countText.textContent = "Balls: " + balls.length;',
    '    }',
    '',
    '    function update() {',
    '      const gravity = Number(gravitySlider.value);',
    '      ctx.clearRect(0, 0, canvas.width, canvas.height);',
    '',
    '      for (const ball of balls) {',
    '        ball.speedY += gravity;',
    '        ball.x += ball.speedX;',
    '        ball.y += ball.speedY;',
    '',
    '        // Bounce off the floor, losing a little energy each time',
    '        if (ball.y + ball.radius > canvas.height) {',
    '          ball.y = canvas.height - ball.radius;',
    '          ball.speedY *= -0.85;',
    '          ball.speedX *= 0.99;',
    '        }',
    '        // Bounce off the walls',
    '        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {',
    '          ball.speedX *= -1;',
    '          ball.x = Math.min(Math.max(ball.x, ball.radius), canvas.width - ball.radius);',
    '        }',
    '',
    '        ctx.beginPath();',
    '        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);',
    '        ctx.fillStyle = ball.color;',
    '        ctx.fill();',
    '      }',
    '',
    '      requestAnimationFrame(update);',
    '    }',
    '',
    '    canvas.addEventListener("click", function (event) {',
    '      const rect = canvas.getBoundingClientRect();',
    '      const x = (event.clientX - rect.left) * (canvas.width / rect.width);',
    '      const y = (event.clientY - rect.top) * (canvas.height / rect.height);',
    '      addBall(x, y);',
    '    });',
    '',
    '    document.getElementById("addBall").addEventListener("click", function () {',
    '      addBall(canvas.width / 2, 40);',
    '    });',
    '',
    '    document.getElementById("reset").addEventListener("click", function () {',
    '      balls = [];',
    '      countText.textContent = "Balls: 0";',
    '    });',
    '',
    '    gravitySlider.addEventListener("input", function () {',
    '      gravityValue.textContent = gravitySlider.value;',
    '    });',
    '',
    '    // Start with three balls',
    '    addBall(160, 60);',
    '    addBall(320, 120);',
    '    addBall(480, 40);',
    '    update();',
    '  </script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  // ---------------------------------------------------------------------------
  // Code injected into the PREVIEW ONLY (never into downloads).
  // It runs inside the sandbox, before the pasted code, and:
  //  - reports uncaught errors and failed script/stylesheet loads to this page
  //    (as plain data that we only ever display as text), and
  //  - provides in-memory stand-ins for localStorage/sessionStorage, which a
  //    sandboxed page cannot use, so creations that save scores still work.
  // It is turned into a single line so the pasted code keeps its line numbers.
  // Keep it free of "//" comments and of the text "</script".
  // ---------------------------------------------------------------------------

  function previewHelper(RUN, SEED) {
    var target = window.parent;
    var sent = 0;
    function send(type, detail) {
      if (sent >= 80) { return; }
      sent += 1;
      detail.htmlPlayground = 1;
      detail.type = type;
      detail.run = RUN;
      try { target.postMessage(detail, '*'); } catch (e) { }
    }
    function describe(value) {
      try {
        if (value && typeof value === 'object' && 'message' in value) {
          return String(value.name ? value.name + ': ' + value.message : value.message);
        }
        return String(value);
      } catch (e) {
        return 'Unknown error';
      }
    }
    window.addEventListener('error', function (event) {
      var el = event.target;
      if (el && el !== window && el.tagName) {
        var tag = String(el.tagName).toLowerCase();
        if (tag === 'script' || (tag === 'link' && /stylesheet/i.test(el.rel || ''))) {
          send('resource', { tag: tag, url: String(el.src || el.href || '').slice(0, 300) });
        }
        return;
      }
      send('error', {
        message: String(event.message || (event.error ? describe(event.error) : 'Unknown error')).slice(0, 500),
        line: event.lineno || 0,
        column: event.colno || 0,
        inPage: !event.filename || event.filename === 'about:srcdoc'
      });
    }, true);
    window.addEventListener('unhandledrejection', function (event) {
      send('error', { message: ('Unhandled promise rejection: ' + describe(event.reason)).slice(0, 500), line: 0, column: 0, inPage: false });
    });
    function memoryStorage(syncLocal, useSeed) {
      var map = new Map();
      if (useSeed && SEED && typeof SEED === 'object') {
        try {
          Object.keys(SEED).forEach(function (k) {
            if (typeof SEED[k] === 'string') { map.set(String(k), SEED[k]); }
          });
        } catch (e) { }
      }
      function sync(op, key) {
        if (!syncLocal) { return; }
        var payload = { op: op };
        if (key !== undefined) { payload.key = String(key).slice(0, 500); }
        if (op === 'set') { payload.value = map.get(String(key)); }
        send('preview-storage', payload);
      }
      var api = {
        getItem: function (key) { key = String(key); return map.has(key) ? map.get(key) : null; },
        setItem: function (key, value) {
          key = String(key);
          value = String(value);
          map.set(key, value);
          sync('set', key);
        },
        removeItem: function (key) { key = String(key); map.delete(key); sync('remove', key); },
        clear: function () { map.clear(); sync('clear'); },
        key: function (index) { var all = Array.from(map.keys()); return index >= 0 && index < all.length ? all[index] : null; }
      };
      return new Proxy(api, {
        get: function (obj, prop) {
          if (prop === 'length') { return map.size; }
          if (typeof prop === 'symbol' || prop in api) { return api[prop]; }
          return map.has(prop) ? map.get(prop) : undefined;
        },
        set: function (obj, prop, value) {
          if (typeof prop !== 'symbol') {
            map.set(prop, String(value));
            sync('set', prop);
          }
          return true;
        },
        has: function (obj, prop) { return map.has(prop) || prop in api; },
        deleteProperty: function (obj, prop) {
          map.delete(prop);
          sync('remove', prop);
          return true;
        },
        ownKeys: function () { return Array.from(map.keys()); },
        getOwnPropertyDescriptor: function (obj, prop) {
          if (map.has(prop)) { return { value: map.get(prop), writable: true, enumerable: true, configurable: true }; }
          return undefined;
        }
      });
    }
    try {
      var localStand = memoryStorage(true, true);
      try { if (window.localStorage) { window.localStorage.getItem('x'); } else { throw new Error('need stand-in'); } } catch (e) {
        Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, get: function () { return localStand; } });
      }
    } catch (e) { }
    try {
      var sessionStand = memoryStorage(false, false);
      try { if (window.sessionStorage) { window.sessionStorage.getItem('x'); } else { throw new Error('need stand-in'); } } catch (e) {
        Object.defineProperty(window, 'sessionStorage', { configurable: true, enumerable: true, get: function () { return sessionStand; } });
      }
    } catch (e) { }
    function downloadBlocked() { send('download-blocked', {}); }
    document.addEventListener('click', function (event) {
      var el = event.target;
      if (!el || !el.closest) { return; }
      var link = el.closest('a');
      if (link && link.hasAttribute('download')) { downloadBlocked(); }
    }, true);
    try {
      var anchorProto = HTMLAnchorElement.prototype;
      var origClick = anchorProto.click;
      anchorProto.click = function () {
        if (this.hasAttribute && this.hasAttribute('download')) { downloadBlocked(); }
        return origClick.apply(this, arguments);
      };
    } catch (e) { }
    var me = document.currentScript;
    if (me && me.parentNode) { me.parentNode.removeChild(me); }
  }

  var HELPER_SOURCE = previewHelper.toString().replace(/\s*\n\s*/g, ' ');

  // ---------------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  var body = document.body;
  var editor = $('editor');
  var editorWrap = editor.parentElement;
  var editorStatus = $('editorStatus');
  var saveStatus = $('saveStatus');
  var workspace = $('workspace');
  var codePane = $('codePane');
  var previewPane = $('previewPane');
  var divider = $('divider');
  var frameHost = $('frameHost');
  var previewEmpty = $('previewEmpty');
  var runBtn = $('runBtn');
  var runBtnLabel = $('runBtnLabel');
  var previewNotice = $('previewNotice');
  var runStatus = $('runStatus');
  var autoRunToggle = $('autoRunToggle');
  var wrapToggle = $('wrapToggle');
  var fullscreenBtn = $('fullscreenBtn');
  var fullscreenLabel = $('fullscreenLabel');
  var tabCode = $('tabCode');
  var tabPreview = $('tabPreview');
  var hint = $('hint');
  var hintText = $('hintText');
  var hintAction = $('hintAction');
  var hintDismiss = $('hintDismiss');
  var problemsBar = $('problems');
  var problemsMessage = $('problemsMessage');
  var problemsLine = $('problemsLine');
  var problemsCopy = $('problemsCopy');
  var problemsClose = $('problemsClose');
  var safeBanner = $('safeBanner');
  var tabBanner = $('tabBanner');
  var safeBannerText = $('safeBannerText');
  var safeRunBtn = $('safeRunBtn');
  var toastEl = $('toast');
  var toastText = $('toastText');
  var toastAction = $('toastAction');
  var confirmDialog = $('confirmDialog');
  var helpDialog = $('helpDialog');
  var clearPreviewDataBtn = $('clearPreviewDataBtn');
  var downloadBlockedBanner = $('downloadBlockedBanner');

  // ---------------------------------------------------------------------------
  // Storage (all access guarded: storage can be missing, blocked, or full)
  // ---------------------------------------------------------------------------

  var store = {
    available: false,
    init: function () {
      try {
        var probe = STORAGE_PREFIX + 'probe';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        this.available = true;
      } catch (e) {
        this.available = false;
      }
    },
    get: function (key) {
      if (!this.available) { return null; }
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      if (!this.available) { return { ok: false, reason: 'unavailable' }; }
      try {
        window.localStorage.setItem(key, value);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: isQuotaError(e) ? 'quota' : 'error' };
      }
    },
    remove: function (key) {
      if (!this.available) { return; }
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
    keysStartingWith: function (prefix) {
      var found = [];
      if (!this.available) { return found; }
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var key = window.localStorage.key(i);
          if (key && key.indexOf(prefix) === 0) { found.push(key); }
        }
      } catch (e) { /* ignore */ }
      return found;
    }
  };

  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }

  // Fingerprint of the pasted code so preview localStorage can be restored per project.
  function codeFingerprint(code) {
    var h = 5381;
    for (var i = 0; i < code.length; i++) {
      h = ((h << 5) + h) ^ code.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  function previewStorageKey(code) {
    return KEYS.previewLs + codeFingerprint(code);
  }

  function sanitizePreviewStorage(raw) {
    var out = Object.create(null);
    if (!raw || typeof raw !== 'object') { return out; }
    var keys = Object.keys(raw);
    for (var i = 0; i < keys.length && i < PREVIEW_STORAGE_MAX_KEYS; i++) {
      var k = keys[i];
      if (typeof k !== 'string' || k.length > PREVIEW_STORAGE_MAX_KEY_LEN) { continue; }
      var v = raw[k];
      if (typeof v !== 'string' || v.length > PREVIEW_STORAGE_MAX_VALUE_LEN) { continue; }
      out[k] = v;
    }
    return out;
  }

  function loadPreviewStorage(code) {
    var raw = store.get(previewStorageKey(code));
    if (!raw) { return Object.create(null); }
    try {
      return sanitizePreviewStorage(JSON.parse(raw));
    } catch (e) {
      return Object.create(null);
    }
  }

  function savePreviewStorage(code, data) {
    var clean = sanitizePreviewStorage(data);
    var json = JSON.stringify(clean);
    if (json.length > PREVIEW_STORAGE_MAX_JSON) { return false; }
    if (!Object.keys(clean).length) {
      store.remove(previewStorageKey(code));
      return true;
    }
    return store.set(previewStorageKey(code), json).ok;
  }

  function clearPreviewStorageForCode(code) {
    store.remove(previewStorageKey(code));
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  var prefs = { autoRun: true, wrap: true, split: 0.5 };
  var state = {
    autoRun: true,          // may be switched off for this visit only (safe mode)
    frame: null,
    runId: null,
    runCounter: 0,
    lastRunCode: '',
    justPasted: false,
    hintDismissedFor: null,
    undoValue: null,
    problems: [],
    problemKeys: Object.create(null),
    problemTotal: 0,
    problemsHidden: false,
    focusGuard: null,       // { runId, until } while we keep keyboard focus in the editor
    lastRunLines: 0,
    savePending: false,
    saveFailed: false,
    savePaused: false,      // another tab changed the saved code; wait for the person to choose
    otherTabCode: null,
    previewStorage: Object.create(null),
    previewStorageCode: ''
  };
  var timers = {};
  var isMac = /Mac|iPhone|iPad|iPod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
  var modKeyLabel = isMac ? '⌘' : 'Ctrl';
  var narrowMedia = window.matchMedia ? window.matchMedia(NARROW_QUERY) : { matches: false };
  var coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;

  function loadPrefs() {
    var raw = store.get(KEYS.prefs);
    if (!raw) { return; }
    try {
      var saved = JSON.parse(raw);
      if (typeof saved.autoRun === 'boolean') { prefs.autoRun = saved.autoRun; }
      if (typeof saved.wrap === 'boolean') { prefs.wrap = saved.wrap; }
      if (typeof saved.split === 'number' && isFinite(saved.split)) { prefs.split = clamp(saved.split, 0.2, 0.8); }
    } catch (e) { /* ignore broken prefs */ }
  }

  function savePrefs() {
    store.set(KEYS.prefs, JSON.stringify(prefs));
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function isNarrow() { return narrowMedia.matches; }

  function countLines(text) {
    var lines = 1;
    var i = -1;
    while ((i = text.indexOf('\n', i + 1)) !== -1) { lines += 1; }
    return lines;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function newRunId() {
    state.runCounter += 1;
    return 'r' + Date.now().toString(36) + state.runCounter.toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------------------
  // Toast messages
  // ---------------------------------------------------------------------------

  function toast(message, options) {
    options = options || {};
    toastText.textContent = message;
    if (options.actionLabel && options.onAction) {
      toastAction.textContent = options.actionLabel;
      toastAction.hidden = false;
      toastAction.onclick = function () {
        hideToast();
        options.onAction();
      };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toastEl.classList.add('is-visible');
    clearTimeout(timers.toast);
    timers.toast = setTimeout(hideToast, options.duration || (options.actionLabel ? 9000 : 4500));
  }

  function hideToast() {
    clearTimeout(timers.toast);
    toastEl.classList.remove('is-visible');
    toastText.textContent = '';
    toastAction.hidden = true;
    toastAction.onclick = null;
  }

  // ---------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------

  var dialogSupported = typeof confirmDialog.showModal === 'function';

  // Resolves true only when the person clicks the confirm button.
  function confirmAction(options) {
    return new Promise(function (resolve) {
      if (!dialogSupported) {
        resolve(window.confirm(options.title + '\n\n' + options.body));
        return;
      }
      $('confirmTitle').textContent = options.title;
      $('confirmBody').textContent = options.body;
      $('confirmOk').textContent = options.confirmLabel;
      var extra = $('confirmExtra');
      if (options.extraLabel) {
        extra.textContent = options.extraLabel;
        extra.hidden = false;
        extra.onclick = options.onExtra;
      } else {
        extra.hidden = true;
        extra.onclick = null;
      }
      confirmDialog.returnValue = '';
      confirmDialog.addEventListener('close', function onClose() {
        confirmDialog.removeEventListener('close', onClose);
        extra.onclick = null;
        resolve(confirmDialog.returnValue === 'confirm');
      });
      confirmDialog.showModal();
    });
  }

  function openHelp(sectionId) {
    if (!dialogSupported) {
      helpDialog.setAttribute('open', '');
    } else if (!helpDialog.open) {
      helpDialog.showModal();
    }
    var section = sectionId && $('help-' + sectionId);
    var scroller = helpDialog;
    if (section) {
      scroller.scrollTop = Math.max(0, section.offsetTop - 70);
    } else {
      scroller.scrollTop = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  function hasCode() { return editor.value.trim().length > 0; }

  function updateEmptyState() {
    editorWrap.classList.toggle('has-code', editor.value.length > 0);
    var empty = !hasCode();
    $('copyBtn').disabled = empty;
    $('clearBtn').disabled = editor.value.length === 0;
    runBtn.disabled = empty;
    fullscreenBtn.disabled = empty && !fullscreenElement() && !body.classList.contains('is-expanded');
  }

  function updateEditorStatus() {
    var text = editor.value;
    if (!text.length) {
      editorStatus.textContent = 'Empty';
      return;
    }
    var total = countLines(text);
    if (document.activeElement === editor) {
      var pos = editor.selectionStart;
      var before = text.slice(0, pos);
      var line = countLines(before);
      var column = pos - before.lastIndexOf('\n');
      editorStatus.textContent = 'Line ' + line + ' of ' + total + ', column ' + column;
    } else {
      editorStatus.textContent = plural(total, 'line');
    }
  }

  function scheduleStatusUpdate() {
    if (timers.statusFrame) { return; }
    timers.statusFrame = requestAnimationFrame(function () {
      timers.statusFrame = 0;
      updateEditorStatus();
    });
  }

  function applyWrap() {
    body.classList.toggle('no-wrap', !prefs.wrap);
    editor.setAttribute('wrap', prefs.wrap ? 'soft' : 'off');
    wrapToggle.checked = prefs.wrap;
  }

  // Replace everything in the editor (Paste button, Sample, Clear, Undo).
  function replaceCode(text, options) {
    options = options || {};
    var undoValue = typeof options.undoValue === 'string' ? options.undoValue : editor.value;
    editor.value = text;
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    state.hintDismissedFor = null;
    onCodeChanged({ runNow: true, analyze: true });
    if (options.undoMessage && undoValue.trim() && undoValue !== text) {
      state.undoValue = undoValue;
      toast(options.undoMessage, {
        actionLabel: 'Undo',
        onAction: function () {
          var value = state.undoValue;
          state.undoValue = null;
          if (value !== null) {
            replaceCode(value);
            toast('Your previous code is back.');
          }
        }
      });
    }
    if (options.showPreview) { showPreviewOnSmallScreens(); }
  }

  // Selects one line in the editor and scrolls it into view.
  function goToLine(lineNumber) {
    var text = editor.value;
    var start = 0;
    for (var i = 1; i < lineNumber; i++) {
      var next = text.indexOf('\n', start);
      if (next === -1) { break; }
      start = next + 1;
    }
    var end = text.indexOf('\n', start);
    if (end === -1) { end = text.length; }
    setView('code');
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(start, end);
    scrollEditorTo(start);
    updateEditorStatus();
  }

  // Textareas cannot report where a character is drawn, so measure it with a hidden copy.
  function scrollEditorTo(offset) {
    var cs = window.getComputedStyle(editor);
    var mirror = document.createElement('div');
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'tabSize',
      'wordSpacing', 'whiteSpace', 'overflowWrap', 'wordBreak', 'paddingTop', 'paddingLeft', 'paddingRight'
    ].forEach(function (prop) { mirror.style[prop] = cs[prop]; });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.left = '-99999px';
    mirror.style.top = '0';
    mirror.style.boxSizing = 'border-box';
    mirror.style.border = '0';
    mirror.style.width = editor.clientWidth + 'px';
    mirror.textContent = editor.value.slice(0, offset);
    var marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    var top = marker.offsetTop;
    document.body.removeChild(mirror);
    editor.scrollTop = Math.max(0, top - editor.clientHeight / 3);
    editor.scrollLeft = 0;
  }

  // ---------------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------------

  function setSaveState(kind, reason) {
    saveStatus.dataset.state = kind;
    if (kind === 'saved') {
      saveStatus.textContent = 'Saved';
      var rest = document.createElement('span');
      rest.className = 'save-long';
      rest.textContent = ' on this device';
      saveStatus.appendChild(rest);
      saveStatus.title = 'Your code is kept in this browser, even if you refresh. Use Download to take it home.';
    } else if (kind === 'saving') {
      saveStatus.textContent = 'Saving…';
      saveStatus.title = '';
    } else if (kind === 'error') {
      if (reason === 'quota') {
        saveStatus.textContent = 'Too big to save here';
        saveStatus.title = 'This code is too big for this browser\'s storage. Click Download to keep a copy.';
      } else if (reason === 'other-tab') {
        saveStatus.textContent = 'Not saved: open in another tab';
        saveStatus.title = 'Choose which version to keep in the yellow box above your code.';
      } else {
        saveStatus.textContent = 'Not saved on this device';
        saveStatus.title = 'This browser is not letting the playground save (for example in some private windows). Click Download to keep a copy.';
      }
    } else {
      saveStatus.textContent = '';
      saveStatus.title = '';
    }
  }

  var lastSaveProblem = null;

  function saveNow() {
    clearTimeout(timers.save);
    state.savePending = false;
    if (state.savePaused) {
      setSaveState('error', 'other-tab');
      return false;
    }
    var result = store.set(KEYS.code, editor.value);
    state.saveFailed = !result.ok;
    if (result.ok) {
      lastSaveProblem = null;
      setSaveState(hasCode() ? 'saved' : 'idle');
    } else {
      // Do not leave an older version behind to be "restored" as if it were the latest.
      if (result.reason === 'quota') { store.remove(KEYS.code); }
      setSaveState('error', result.reason);
      if (lastSaveProblem !== result.reason) {
        lastSaveProblem = result.reason;
        toast(result.reason === 'quota'
          ? 'Your code is too big to save in this browser. Click Download to keep a copy.'
          : 'This browser is not letting the playground save your code. Click Download to keep a copy.');
      }
    }
    return result.ok;
  }

  function scheduleSave() {
    if (store.available && !state.savePaused && saveStatus.dataset.state !== 'error') { setSaveState('saving'); }
    clearTimeout(timers.save);
    state.savePending = true;
    timers.save = setTimeout(saveNow, SAVE_DELAY);
  }

  // ---------------------------------------------------------------------------
  // Running the preview
  // ---------------------------------------------------------------------------

  // Where the <!DOCTYPE ...> ends (after an optional byte-order mark, spaces and
  // comments), or -1. A plain scan, so odd input can never make it slow.
  function doctypeEnd(code) {
    var i = code.charCodeAt(0) === 0xFEFF ? 1 : 0;
    for (;;) {
      while (i < code.length && ' \t\n\r\f'.indexOf(code.charAt(i)) !== -1) { i += 1; }
      if (code.substr(i, 4) !== '<!--') { break; }
      var close = code.indexOf('-->', i + 4);
      if (close === -1) { return -1; }
      i = close + 3;
    }
    if (code.substr(i, 9).toLowerCase() !== '<!doctype') { return -1; }
    var end = code.indexOf('>', i);
    return end === -1 ? -1 : end + 1;
  }

  // Adds the helper script right after the doctype (or at the very start), on the
  // same line, so the line numbers of the pasted code are unchanged.
  function buildPreviewDocument(code, runId, previewSeed) {
    var helper = '<script>(' + HELPER_SOURCE + ')(' + JSON.stringify(runId) + ',' + JSON.stringify(previewSeed || null) + ');<\/script>';
    var at = doctypeEnd(code);
    if (at > 0) {
      return code.slice(0, at) + helper + code.slice(at);
    }
    return helper + code;
  }

  // ---------------------------------------------------------------------------
  // Freeze recovery
  // While a preview runs, this tab writes a small "still alive" note every second.
  // If pasted code freezes the tab, the notes stop. The next visit finds a stale
  // note and opens paused instead of freezing again. A normal close removes the
  // note, and hidden tabs (whose timers the browser slows down) are not counted.
  // ---------------------------------------------------------------------------

  var TAB_ID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function writeHeartbeat() {
    if (!state.runId) { return; }
    store.set(KEYS.running + TAB_ID, JSON.stringify({ alive: Date.now(), hidden: document.visibilityState === 'hidden' }));
  }

  function startHeartbeat() {
    if (!store.available) { return; }
    writeHeartbeat();
    if (!timers.heartbeat) { timers.heartbeat = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL); }
  }

  function stopHeartbeat() {
    clearInterval(timers.heartbeat);
    timers.heartbeat = 0;
    store.remove(KEYS.running + TAB_ID);
  }

  // Calls back with true if some tab seems to have frozen while running a preview.
  // A note that is still fresh may belong to a working tab, so wait to see if it updates.
  function checkForFrozenTab(callback) {
    function scan(final) {
      var now = Date.now();
      var frozen = false;
      var waitFor = 0;
      store.keysStartingWith(KEYS.running).forEach(function (key) {
        var note = null;
        try { note = JSON.parse(store.get(key)); } catch (e) { note = null; }
        var age = note && typeof note.alive === 'number' ? now - note.alive : Infinity;
        if (note && note.hidden) {
          if (age > 86400000) { store.remove(key); }
          return;
        }
        if (age > HEARTBEAT_STALE) {
          frozen = true;
          store.remove(key);
        } else if (!final) {
          waitFor = Math.max(waitFor, HEARTBEAT_STALE - age + 300);
        }
      });
      if (frozen || !waitFor) {
        callback(frozen);
      } else {
        setTimeout(function () { scan(true); }, waitFor);
      }
    }
    scan(false);
  }

  document.addEventListener('visibilitychange', writeHeartbeat);

  function removeFrame() {
    if (state.frame) {
      state.frame.remove();
      state.frame = null;
    }
  }

  function run(options) {
    options = options || {};
    clearTimeout(timers.run);
    var code = editor.value;
    state.lastRunCode = code;
    resetProblems();
    updateRunIndicators();
    if (options.manual) { safeBanner.hidden = true; }

    removeFrame();

    previewNotice.hidden = true;
    if (downloadBlockedBanner) { downloadBlockedBanner.hidden = true; }
    if (!code.trim()) {
      state.runId = null;
      stopHeartbeat();
      previewEmpty.hidden = false;
      updateClearPreviewDataButton();
      return;
    }
    previewEmpty.hidden = true;
    // React/JSX source shows up as a wall of text in a browser, so explain instead.
    if (analyzeCode(code) === 'react') {
      state.runId = null;
      stopHeartbeat();
      previewNotice.hidden = false;
      return;
    }

    var runId = newRunId();
    state.runId = runId;
    state.lastRunLines = countLines(code);
    state.previewStorageCode = code;
    state.previewStorage = loadPreviewStorage(code);
    startHeartbeat();

    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', SANDBOX);
    frame.setAttribute('allow', ALLOW);
    frame.setAttribute('title', 'Preview of your creation');
    frame.srcdoc = buildPreviewDocument(code, runId, state.previewStorage);
    frame.addEventListener('load', function () {
      if (state.runId !== runId) { return; }
      if (state.focusGuard && state.focusGuard.runId === runId) { state.focusGuard.until = Date.now() + 1500; }
    });

    // Some creations grab keyboard focus when they start. If the person is typing
    // in the editor, keep their keystrokes there.
    state.focusGuard = document.activeElement === editor ? { runId: runId, until: Date.now() + 15000 } : null;

    state.frame = frame;
    frameHost.appendChild(frame);
    updateClearPreviewDataButton();
    flashRunStatus(options.manual ? 'Restarted' : 'Updated');
  }

  function scheduleRun() {
    clearTimeout(timers.run);
    timers.run = setTimeout(function () { run(); }, AUTO_RUN_DELAY);
  }

  function isDirty() { return editor.value !== state.lastRunCode; }

  function updateRunIndicators() {
    var waiting = !state.autoRun && isDirty();
    // While the preview updates by itself, the button only restarts it, so keep it quiet.
    runBtnLabel.textContent = state.autoRun ? 'Restart' : 'Run';
    runBtn.classList.toggle('btn-run', !state.autoRun);
    runBtn.classList.toggle('is-waiting', waiting);
    clearTimeout(timers.runStatus);
    if (waiting) {
      runStatus.textContent = 'Press Run to see your changes';
      runStatus.classList.add('is-attention');
    } else {
      runStatus.textContent = '';
      runStatus.classList.remove('is-attention');
    }
  }

  function flashRunStatus(text) {
    runStatus.classList.remove('is-attention');
    runStatus.textContent = '✓ ' + text;
    clearTimeout(timers.runStatus);
    timers.runStatus = setTimeout(function () {
      if (!runStatus.classList.contains('is-attention')) { runStatus.textContent = ''; }
    }, 1800);
  }

  // Called after every change to the code, however it happened.
  function onCodeChanged(options) {
    options = options || {};
    updateEmptyState();
    scheduleStatusUpdate();
    scheduleSave();
    if (options.runNow || (options.runIfAuto && state.autoRun)) {
      run();
    } else if (state.autoRun) {
      scheduleRun();
    } else {
      updateRunIndicators();
    }
    if (!hint.hidden || options.analyze) { updateHint(); }
  }

  // ---------------------------------------------------------------------------
  // Focus guard (see run())
  // ---------------------------------------------------------------------------

  function focusGuardActive() {
    var guard = state.focusGuard;
    return !!guard && guard.runId === state.runId && Date.now() <= guard.until;
  }

  editor.addEventListener('blur', function () {
    if (!focusGuardActive()) { return; }
    setTimeout(function () {
      var frame = state.frame;
      // If the pointer is over the preview, the person may have clicked it on purpose.
      var pointerOnPreview = frameHost.matches(':hover');
      if (frame && document.activeElement === frame && !pointerOnPreview && focusGuardActive()) {
        editor.focus({ preventScroll: true });
      }
    }, 0);
  });
  document.addEventListener('pointerdown', function (event) {
    if (event.target !== editor) { state.focusGuard = null; }
  });

  // ---------------------------------------------------------------------------
  // Problems reported by the preview (untrusted data: shown as text, nothing else)
  // ---------------------------------------------------------------------------

  function resetProblems() {
    state.problems = [];
    state.problemKeys = Object.create(null);
    state.problemTotal = 0;
    state.problemsHidden = false;
    problemsBar.hidden = true;
  }

  function friendlyMessage(raw) {
    var message = raw.replace(/^Uncaught\s+/, '');
    if (/^Script error\.?$/i.test(message)) {
      return 'A script from another website ran into a problem. (Your browser hides the details.)';
    }
    return message;
  }

  function extraAdvice(message) {
    if (/Failed to resolve module specifier|Cannot use import statement|import declarations may only appear/i.test(message)) {
      return 'This code expects extra tools (like React) that a single web page does not have. Ask Gemini to rewrite it as one HTML file without imports or build tools.';
    }
    if (/sandbox|SecurityError|The operation is insecure/i.test(message)) {
      return 'This uses a browser feature the preview blocks for safety. It may work in the downloaded file.';
    }
    return '';
  }

  window.addEventListener('message', function (event) {
    var frame = state.frame;
    if (!frame || event.source !== frame.contentWindow) { return; }
    var data = event.data;
    if (!data || typeof data !== 'object' || data.htmlPlayground !== 1 || data.run !== state.runId) { return; }

    var problem;
    if (data.type === 'error') {
      var line = typeof data.line === 'number' ? data.line : 0;
      var message = friendlyMessage(typeof data.message === 'string' ? data.message.slice(0, 500) : 'Unknown error');
      var lineOk = data.inPage === true && line >= 1 && line <= state.lastRunLines && Math.floor(line) === line;
      problem = { message: message, line: lineOk ? line : 0, advice: extraAdvice(message) };
    } else if (data.type === 'resource') {
      var url = typeof data.url === 'string' ? data.url.slice(0, 300) : '';
      problem = {
        message: 'Could not load ' + (data.tag === 'link' ? 'a stylesheet' : 'a script') + (url ? ' from ' + url : '') + '.',
        line: 0,
        advice: 'This part comes from the internet. Check the connection, or ask Gemini to include it in the file.'
      };
    } else if (data.type === 'preview-storage') {
      if (editor.value !== state.previewStorageCode) { return; }
      var op = data.op;
      if (op === 'set') {
        var sKey = typeof data.key === 'string' ? data.key.slice(0, PREVIEW_STORAGE_MAX_KEY_LEN) : '';
        var sVal = typeof data.value === 'string' ? data.value.slice(0, PREVIEW_STORAGE_MAX_VALUE_LEN) : '';
        if (!sKey) { return; }
        state.previewStorage[sKey] = sVal;
      } else if (op === 'remove') {
        var rKey = typeof data.key === 'string' ? data.key.slice(0, PREVIEW_STORAGE_MAX_KEY_LEN) : '';
        if (rKey) { delete state.previewStorage[rKey]; }
      } else if (op === 'clear') {
        state.previewStorage = Object.create(null);
      } else {
        return;
      }
      savePreviewStorage(state.previewStorageCode, state.previewStorage);
      updateClearPreviewDataButton();
    } else if (data.type === 'download-blocked') {
      showDownloadBlockedNotice();
    } else {
      return;
    }
    if (problem) { addProblem(problem); }
  });

  function showDownloadBlockedNotice() {
    if (downloadBlockedBanner) {
      downloadBlockedBanner.hidden = false;
    }
    toast('Downloads are turned off inside the preview. Use Download above to save your code, or open the downloaded file to use in-app save buttons.', { duration: 8000 });
  }

  function updateClearPreviewDataButton() {
    if (!clearPreviewDataBtn) { return; }
    var hasData = state.previewStorage && Object.keys(state.previewStorage).length > 0;
    clearPreviewDataBtn.hidden = !hasData || !hasCode();
    clearPreviewDataBtn.disabled = !hasData;
  }

  function clearPreviewSavedData() {
    if (!hasCode()) { return; }
    confirmAction({
      title: 'Clear saved data in the preview?',
      body: 'This removes anything your creation saved while previewing (like contacts or high scores). Your code in the editor is not changed. The downloaded file keeps its own saved data.',
      confirmLabel: 'Clear preview data'
    }).then(function (ok) {
      if (!ok) { return; }
      clearPreviewStorageForCode(editor.value);
      state.previewStorage = Object.create(null);
      updateClearPreviewDataButton();
      run({ manual: true });
      toast('Cleared saved data for this creation in the preview.');
    });
  }

  function addProblem(problem) {
    state.problemTotal += 1;
    var key = problem.message + '|' + problem.line;
    if (state.problemKeys[key] || state.problems.length >= 20) {
      scheduleProblemsRender();
      return;
    }
    state.problemKeys[key] = true;
    state.problems.push(problem);
    scheduleProblemsRender();
  }

  function scheduleProblemsRender() {
    if (timers.problemsFrame) { return; }
    timers.problemsFrame = requestAnimationFrame(function () {
      timers.problemsFrame = 0;
      renderProblems();
    });
  }

  function renderProblems() {
    if (!state.problems.length || state.problemsHidden) {
      problemsBar.hidden = true;
      return;
    }
    var first = state.problems[0];
    var text = first.message + (first.line ? ' (line ' + first.line + ')' : '');
    if (first.advice) { text += ' ' + first.advice; }
    var others = state.problems.length - 1;
    if (others > 0) { text += '  +' + plural(others, 'more problem'); }
    problemsMessage.textContent = text;
    problemsLine.hidden = !first.line;
    problemsBar.hidden = false;
  }

  function problemsReport() {
    var lines = state.problems.slice(0, 5).map(function (p) {
      return '- ' + p.message + (p.line ? ' (line ' + p.line + ')' : '');
    });
    return 'My HTML page has a problem. The browser reported:\n' + lines.join('\n') +
      '\n\nPlease fix it and give me the complete, updated HTML file.';
  }

  problemsLine.addEventListener('click', function () {
    if (state.problems[0] && state.problems[0].line) { goToLine(state.problems[0].line); }
  });
  problemsCopy.addEventListener('click', function () {
    copyText(problemsReport()).then(function (ok) {
      toast(ok ? 'Copied! Paste it into Gemini and ask for a fix.' : 'Could not copy. Select the message and copy it yourself.');
    });
  });
  problemsClose.addEventListener('click', function () {
    state.problemsHidden = true;
    problemsBar.hidden = true;
  });

  // ---------------------------------------------------------------------------
  // Paste helper: spots common copy-and-paste mix-ups
  // ---------------------------------------------------------------------------

  function findHtmlStart(text) {
    return text.search(/<!doctype\s+html|<html[\s>]/i);
  }

  // Removes <!-- comments --> with a plain scan (a regex can get very slow on odd input).
  function stripComments(text) {
    var out = '';
    var i = 0;
    for (;;) {
      var open = text.indexOf('<!--', i);
      if (open === -1) { out += text.slice(i); break; }
      out += text.slice(i, open);
      var close = text.indexOf('-->', open + 4);
      if (close === -1) { break; }
      i = close + 3;
    }
    return out.trim();
  }

  // Every pattern here runs in linear time, because it runs on every paste and every run.
  function analyzeCode(code) {
    if (code.length > MAX_ANALYZE_LENGTH) { return null; }
    var text = code.trim();
    if (!text) { return null; }
    var start = findHtmlStart(text);
    if (start >= 0) {
      var end = text.toLowerCase().lastIndexOf('</html>');
      var before = start > 0 ? stripComments(text.slice(0, start)) : '';
      var after = end >= 0 ? stripComments(text.slice(end + 7)) : '';
      if (before || after) { return 'extra-text'; }
      if (end < 0 && /<body[\s>]/i.test(text)) { return 'cut-off'; }
      return null;
    }
    if (text.slice(0, 3) === '```' || text.slice(-3) === '```') { return 'extra-text'; }
    if (/<\/(body|html)>/i.test(text)) { return 'partial'; }
    if (/^[ \t]*import[ \t][^\n]*from[ \t]*['"]|^[ \t]*export[ \t]+default\b|\bReactDOM\b|\buseState[ \t]*\(/m.test(text) && !/<script[\s>]/i.test(text)) {
      return 'react';
    }
    if (!/<[a-z!][^<>]*>/i.test(text)) { return 'not-html'; }
    return null;
  }

  function cleanUpCode(code) {
    var text = code.trim();
    var start = findHtmlStart(text);
    if (start >= 0) {
      text = text.slice(start);
      var end = text.toLowerCase().lastIndexOf('</html>');
      if (end >= 0) { text = text.slice(0, end + 7); }
    } else {
      text = text.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return text + '\n';
  }

  function updateHint() {
    var code = editor.value;
    var kind = analyzeCode(code);
    if (!kind || state.hintDismissedFor === kind) {
      hint.hidden = true;
      return;
    }
    hint.dataset.kind = kind;
    if (kind === 'extra-text') {
      hintText.textContent = "Some of Gemini's chat message was copied along with the code.";
      hintAction.textContent = 'Clean it up';
    } else if (kind === 'react') {
      hintText.textContent = 'This looks like React code, which needs extra tools and will not run as a web page. Ask Gemini to rewrite it as a single HTML file.';
      hintAction.textContent = 'Copy a request for Gemini';
    } else if (kind === 'cut-off') {
      hintText.textContent = 'The end of the code seems to be missing. It should finish with </html>. Copy it again, or ask Gemini for the complete file.';
      hintAction.textContent = 'Copy a request for Gemini';
    } else if (kind === 'partial') {
      hintText.textContent = "This looks like only part of the code. In Gemini, use the code box's copy button to copy all of it. It usually starts with <!DOCTYPE html>.";
      hintAction.textContent = 'Show me how';
    } else {
      hintText.textContent = 'This does not look like a complete web page. Make sure you copy all of the code. It usually starts with <!DOCTYPE html>.';
      hintAction.textContent = 'Show me how';
    }
    hint.hidden = false;
  }

  hintAction.addEventListener('click', function () {
    var kind = hint.dataset.kind;
    if (kind === 'extra-text') {
      replaceCode(cleanUpCode(editor.value), { undoMessage: 'Cleaned up your code.' });
      hint.hidden = true;
    } else if (kind === 'react' || kind === 'cut-off') {
      copyGeminiRequest(kind === 'react' ? REWRITE_REQUEST : COMPLETE_REQUEST);
    } else {
      openHelp('trouble');
    }
  });

  function copyGeminiRequest(request) {
    copyText(request).then(function (ok) {
      toast(ok ? 'Copied! Paste it into Gemini, then paste the new code here.' : 'Could not copy. Ask Gemini: ' + request, { duration: ok ? 5000 : 12000 });
    });
  }

  $('noticeCopyBtn').addEventListener('click', function () { copyGeminiRequest(REWRITE_REQUEST); });

  // Pasting is the main way code arrives, so fix the two common mix-ups right away:
  // a whole new page pasted into the middle of the old one, and chat text around the code.
  // Returns true when it took care of the paste.
  function handleIncomingPaste(text, viaButton) {
    if (viaButton) {
      var currentAll = editor.value;
      var cleaningAll = analyzeCode(text) === 'extra-text';
      var finalAll = cleaningAll ? cleanUpCode(text) : text;
      var hadAll = currentAll.trim() !== '' && currentAll !== finalAll;
      var msgAll;
      if (hadAll && cleaningAll) {
        msgAll = "Replaced your old code with the new version (and removed Gemini's chat text).";
      } else if (hadAll) {
        msgAll = 'Replaced your old code with the new version.';
      } else if (cleaningAll) {
        msgAll = "Removed Gemini's chat text that was copied along with your code.";
      } else if (!hadAll && currentAll.trim() === '') {
        msgAll = 'Pasted your code.';
      }
      replaceCode(finalAll, {
        undoMessage: msgAll,
        undoValue: hadAll ? currentAll : text,
        showPreview: true
      });
      return true;
    }
    var current = editor.value;
    var selectedAll = editor.selectionStart === 0 && editor.selectionEnd === current.length;
    var replacing = (current.trim() !== '' && !selectedAll && findHtmlStart(text) >= 0);
    var replacesEverything = replacing || selectedAll || current.trim() === '';
    var cleaning = replacesEverything && analyzeCode(text) === 'extra-text';
    if (!replacing && !cleaning) { return false; }
    var finalText = cleaning ? cleanUpCode(text) : text;
    var hadCode = current.trim() !== '' && current !== finalText;
    var message;
    if (hadCode && cleaning) {
      message = "Replaced your old code with the new version (and removed Gemini's chat text).";
    } else if (hadCode) {
      message = 'Replaced your old code with the new version.';
    } else if (cleaning) {
      message = "Removed Gemini's chat text that was copied along with your code.";
    }
    replaceCode(finalText, {
      undoMessage: message,
      undoValue: hadCode ? current : text,
      showPreview: true
    });
    return true;
  }
  hintDismiss.addEventListener('click', function () {
    state.hintDismissedFor = hint.dataset.kind;
    hint.hidden = true;
    editor.focus();
  });

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var active = document.activeElement;
    var temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.top = '0';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(temp);
    if (active && active.focus) { active.focus({ preventScroll: true }); }
    return ok;
  }

  function pasteFromClipboard() {
    if (!(navigator.clipboard && navigator.clipboard.readText)) {
      pasteWithKeyboard();
      return;
    }
    var readPromise;
    try {
      readPromise = navigator.clipboard.readText();
    } catch (e) {
      pasteWithKeyboard();
      return;
    }
    if (!readPromise || typeof readPromise.then !== 'function') {
      pasteWithKeyboard();
      return;
    }
    readPromise.then(function (text) {
      if (!text || !text.trim()) {
        toast('Nothing has been copied yet. Copy the code from Gemini first.');
        return;
      }
      handleIncomingPaste(text, true);
    }, function () {
      pasteWithKeyboard();
    });
  }

  function pasteWithKeyboard() {
    setView('code');
    editor.focus();
    editor.select();
    toast(coarsePointer
      ? 'Tap and hold in the code box, then choose Paste.'
      : 'Your browser wants you to paste with the keyboard: press ' + modKeyLabel + ' + V now.', { duration: 7000 });
  }

  // ---------------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------------

  function download() {
    var code = editor.value;
    if (!code.trim()) {
      toast('There is nothing to download yet. Paste some code first.');
      return;
    }
    // The file is exactly the code in the editor. The only possible addition is an
    // invisible UTF-8 marker, for files with emoji or accents but no charset line,
    // so they do not show garbled text when opened from disk.
    // (Browsers only look for the charset line near the top, so only check there.)
    var needsBom = /[^\x00-\x7F]/.test(code) && code.charCodeAt(0) !== 0xFEFF && !/<meta[^<>]*charset/i.test(code.slice(0, 1024));
    // octet-stream, not text/html: a browser that ignored the download attribute would
    // otherwise show the file as a page with this playground's origin.
    var blob = new Blob(needsBom ? ['\uFEFF', code] : [code], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = DOWNLOAD_NAME;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    toast('Downloaded ' + DOWNLOAD_NAME + '. Double-click it in your Downloads folder to open it.', {
      actionLabel: 'More tips',
      onAction: function () { openHelp('home'); }
    });
  }

  function copyCode() {
    if (!hasCode()) {
      toast('There is no code to copy yet.');
      return;
    }
    copyText(editor.value).then(function (ok) {
      toast(ok ? 'Copied all of your code.' : 'Could not copy. Click in the code, press ' + modKeyLabel + ' + A, then ' + modKeyLabel + ' + C.');
    });
  }

  function loadSample() {
    var proceed = Promise.resolve(true);
    var replacing = hasCode() && editor.value !== SAMPLE;
    if (replacing) {
      proceed = confirmAction({
        title: 'Replace your code with the sample?',
        body: 'The code you have now will be replaced. You can undo this right after, or download your code first to keep it.',
        confirmLabel: 'Replace with sample',
        extraLabel: 'Download my code first',
        onExtra: download
      });
    }
    proceed.then(function (ok) {
      if (!ok) { return; }
      replaceCode(SAMPLE, { undoMessage: 'Loaded the sample.', showPreview: true });
      if (!replacing && !isNarrow()) { toast('Try it: change a color in the code and watch the preview update.', { duration: 6000 }); }
    });
  }

  function clearCode() {
    if (!editor.value.length) {
      editor.focus();
      return;
    }
    confirmAction({
      title: 'Clear all of your code?',
      body: 'This removes the code from the editor and from this device. You can undo this right after, or download your code first to keep it.',
      confirmLabel: 'Clear everything',
      extraLabel: 'Download my code first',
      onExtra: download
    }).then(function (ok) {
      if (!ok) { return; }
      replaceCode('', { undoMessage: 'Cleared your code.' });
      saveNow();
      setView('code');
      editor.focus();
    });
  }

  // ---------------------------------------------------------------------------
  // Resizable split
  // ---------------------------------------------------------------------------

  function setSplit(value, persist) {
    prefs.split = clamp(value, 0.2, 0.8);
    workspace.style.setProperty('--split', String(prefs.split));
    var codePercent = Math.round(prefs.split * 100);
    divider.setAttribute('aria-valuenow', String(codePercent));
    divider.setAttribute('aria-valuetext', 'Code ' + codePercent + ' percent, preview ' + (100 - codePercent) + ' percent');
    if (persist) { savePrefs(); }
  }

  divider.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) { return; }
    event.preventDefault();
    divider.focus({ preventScroll: true });
    try { divider.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    body.classList.add('is-resizing');
    var rect = workspace.getBoundingClientRect();
    var cs = window.getComputedStyle(workspace);
    var padLeft = parseFloat(cs.paddingLeft) || 0;
    var padRight = parseFloat(cs.paddingRight) || 0;
    var dividerWidth = divider.getBoundingClientRect().width;
    var inner = rect.width - padLeft - padRight - dividerWidth;

    function onMove(e) {
      setSplit((e.clientX - rect.left - padLeft - dividerWidth / 2) / inner, false);
    }
    function onUp() {
      body.classList.remove('is-resizing');
      divider.removeEventListener('pointermove', onMove);
      divider.removeEventListener('pointerup', onUp);
      divider.removeEventListener('pointercancel', onUp);
      savePrefs();
    }
    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onUp);
    divider.addEventListener('pointercancel', onUp);
  });

  divider.addEventListener('dblclick', function () { setSplit(0.5, true); });

  divider.addEventListener('keydown', function (event) {
    var step = event.shiftKey ? 0.1 : 0.05;
    var handled = true;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { setSplit(prefs.split - step, true); }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { setSplit(prefs.split + step, true); }
    else if (event.key === 'Home') { setSplit(0.2, true); }
    else if (event.key === 'End') { setSplit(0.8, true); }
    else if (event.key === 'Enter') { setSplit(0.5, true); }
    else { handled = false; }
    if (handled) { event.preventDefault(); }
  });

  // ---------------------------------------------------------------------------
  // Tabs (small screens)
  // ---------------------------------------------------------------------------

  function setView(view, focusTab) {
    body.dataset.view = view;
    var codeSelected = view === 'code';
    tabCode.setAttribute('aria-selected', String(codeSelected));
    tabPreview.setAttribute('aria-selected', String(!codeSelected));
    tabCode.tabIndex = codeSelected ? 0 : -1;
    tabPreview.tabIndex = codeSelected ? -1 : 0;
    if (focusTab) { (codeSelected ? tabCode : tabPreview).focus(); }
  }

  function showPreviewOnSmallScreens() {
    if (isNarrow()) {
      if (document.activeElement === editor) { editor.blur(); }
      setView('preview');
    }
  }

  tabCode.addEventListener('click', function () { setView('code'); });
  tabPreview.addEventListener('click', function () { setView('preview'); });
  [tabCode, tabPreview].forEach(function (tab) {
    tab.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        var toCode = event.key === 'Home' || (event.key !== 'End' && body.dataset.view !== 'code');
        setView(toCode ? 'code' : 'preview', true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Full screen
  // ---------------------------------------------------------------------------

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function updateFullscreenButton() {
    var on = !!fullscreenElement() || body.classList.contains('is-expanded');
    fullscreenLabel.textContent = on ? 'Exit full screen' : 'Full screen';
    fullscreenBtn.setAttribute('aria-pressed', String(on));
  }

  function setExpanded(on) {
    body.classList.toggle('is-expanded', on);
    updateFullscreenButton();
    if (on) { toast('Press Esc or click "Exit full screen" to go back.'); }
  }

  function toggleFullscreen() {
    if (fullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (body.classList.contains('is-expanded')) {
      setExpanded(false);
      return;
    }
    var request = previewPane.requestFullscreen || previewPane.webkitRequestFullscreen;
    if (request) {
      try {
        var result = request.call(previewPane);
        if (result && typeof result.catch === 'function') {
          result.catch(function () { setExpanded(true); });
        }
        return;
      } catch (e) { /* fall through */ }
    }
    setExpanded(true);
  }

  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  editor.addEventListener('paste', function (event) {
    var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
    if (text && handleIncomingPaste(text, false)) {
      event.preventDefault();
      return;
    }
    state.justPasted = true;
  });

  editor.addEventListener('input', function () {
    if (state.justPasted) {
      state.justPasted = false;
      state.hintDismissedFor = null;
      onCodeChanged({ runIfAuto: true, analyze: true });
      if (hasCode()) { showPreviewOnSmallScreens(); }
      return;
    }
    onCodeChanged();
  });

  ['keyup', 'click', 'focus', 'blur', 'select'].forEach(function (type) {
    editor.addEventListener(type, scheduleStatusUpdate);
  });
  document.addEventListener('selectionchange', function () {
    if (document.activeElement === editor) { scheduleStatusUpdate(); }
  });

  runBtn.addEventListener('click', function () { run({ manual: true }); });
  safeRunBtn.addEventListener('click', function () { run({ manual: true }); });

  autoRunToggle.addEventListener('change', function () {
    state.autoRun = autoRunToggle.checked;
    prefs.autoRun = state.autoRun;
    savePrefs();
    if (state.autoRun && isDirty()) { run(); }
    updateRunIndicators();
    toast(state.autoRun ? 'The preview will update as you type.' : 'The preview will wait until you press Run.');
  });

  wrapToggle.addEventListener('change', function () {
    prefs.wrap = wrapToggle.checked;
    applyWrap();
    savePrefs();
  });

  fullscreenBtn.addEventListener('click', toggleFullscreen);
  $('downloadBtn').addEventListener('click', download);
  $('copyBtn').addEventListener('click', copyCode);
  $('pasteBtn').addEventListener('click', pasteFromClipboard);
  $('emptyPasteBtn').addEventListener('click', pasteFromClipboard);
  $('sampleBtn').addEventListener('click', loadSample);
  $('emptySampleBtn').addEventListener('click', loadSample);
  $('clearBtn').addEventListener('click', clearCode);
  if (clearPreviewDataBtn) { clearPreviewDataBtn.addEventListener('click', clearPreviewSavedData); }
  $('helpBtn').addEventListener('click', function () { openHelp(); });
  $('copyPromptBtn').addEventListener('click', function () {
    copyText(PROMPT_TIP).then(function (ok) {
      toast(ok ? 'Copied! Add it to your request in Gemini.' : 'Could not copy. Select the sentence and copy it yourself.');
    });
  });
  document.querySelectorAll('[data-help]').forEach(function (button) {
    button.addEventListener('click', function () { openHelp(button.getAttribute('data-help')); });
  });

  document.addEventListener('keydown', function (event) {
    var mod = event.ctrlKey || event.metaKey;
    if (mod && event.key === 'Enter') {
      event.preventDefault();
      run({ manual: true });
    } else if (mod && !event.shiftKey && !event.altKey && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      if (saveNow()) {
        toast(hasCode() ? 'Saved on this device. To keep a file, click Download.' : 'Nothing to save yet.');
      }
    } else if (event.key === 'Escape' && body.classList.contains('is-expanded')) {
      setExpanded(false);
    }
  });

  // A normal reload or close is not a freeze, so do not open paused next time.
  window.addEventListener('pagehide', function () {
    if (state.savePending) { saveNow(); }
    stopHeartbeat();
  });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && state.runId) { startHeartbeat(); }
  });

  // Only when the code could not be saved: warn before it is lost.
  window.addEventListener('beforeunload', function (event) {
    if ((!store.available || state.saveFailed || state.savePaused) && hasCode()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // The playground open in two tabs: do not let one silently overwrite the other.
  window.addEventListener('storage', function (event) {
    if (event.key !== KEYS.code || event.newValue === null || event.newValue === editor.value) { return; }
    state.otherTabCode = event.newValue;
    state.savePaused = true;
    clearTimeout(timers.save);
    setSaveState('error', 'other-tab');
    tabBanner.hidden = false;
  });

  function resolveOtherTab(useOther) {
    var other = state.otherTabCode;
    state.savePaused = false;
    state.otherTabCode = null;
    tabBanner.hidden = true;
    setSaveState('idle');
    if (useOther && other !== null) {
      replaceCode(other, { undoMessage: 'Loaded the code from your other tab.' });
    }
    saveNow();
  }
  $('tabUseOther').addEventListener('click', function () { resolveOtherTab(true); });
  $('tabKeepThis').addEventListener('click', function () { resolveOtherTab(false); });

  if (narrowMedia.addEventListener) {
    narrowMedia.addEventListener('change', function () {
      if (!isNarrow()) { setView('code'); }
    });
  }

  // ---------------------------------------------------------------------------
  // Start up
  // ---------------------------------------------------------------------------

  function init() {
    store.init();
    loadPrefs();
    state.autoRun = prefs.autoRun;
    autoRunToggle.checked = prefs.autoRun;
    updateRunIndicators();
    applyWrap();
    setSplit(prefs.split, false);
    setView('code');

    // Show the right keyboard keys for this computer.
    document.querySelectorAll('.mod-key').forEach(function (el) { el.textContent = modKeyLabel; });
    $('pasteKeys').textContent = modKeyLabel + ' + V';
    if (coarsePointer) {
      $('pasteKeys').parentElement.textContent = 'Tap and hold in this box, then choose Paste';
    }
    runBtn.title = 'Run the code (' + modKeyLabel + ' + Enter)';

    var params = new URLSearchParams(window.location.search);
    var safeRequested = params.has('safe') || /^#safe$/i.test(window.location.hash);
    var saved = store.get(KEYS.code);

    if (saved !== null) { editor.value = saved; }
    updateEmptyState();
    updateEditorStatus();

    if (!store.available) {
      setSaveState('error', 'unavailable');
    } else if (saved && saved.trim()) {
      setSaveState('saved');
    }

    if (!saved || !saved.trim()) {
      checkForFrozenTab(function () { /* nothing to start; just tidy up old notes */ });
      return;
    }
    state.lastRunCode = '';
    updateHint();
    checkForFrozenTab(function (frozen) {
      if (editor.value !== saved) { return; } // the person already started something new
      if (safeRequested || frozen) {
        state.autoRun = false;
        autoRunToggle.checked = false;
        safeBannerText.textContent = frozen
          ? 'Last time, your creation stopped responding, so it has not been started again. Check the code (or ask Gemini to fix it), then press Run.'
          : 'Safe mode: your code has not been started. Press Run when you are ready.';
        safeBanner.hidden = false;
        updateRunIndicators();
      } else {
        run();
        toast('Welcome back! Your code from last time is still here.');
      }
    });
  }

  init();
})();
