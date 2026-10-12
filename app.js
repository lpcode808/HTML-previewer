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

  var STORAGE_PREFIX = 'html-playground:v1:';
  var KEYS = {
    code: STORAGE_PREFIX + 'code',
    prefs: STORAGE_PREFIX + 'prefs',
    pending: STORAGE_PREFIX + 'run-pending'
  };
  var AUTO_RUN_DELAY = 900;       // ms of quiet typing before the preview restarts
  var SAVE_DELAY = 400;           // ms of quiet typing before autosaving
  var PENDING_SETTLE_DELAY = 3000; // ms after the preview loads before we trust it did not freeze
  var DOWNLOAD_NAME = 'my-creation.html';
  var NARROW_QUERY = '(max-width: 820px)';

  // What the preview is allowed to do. Deliberately NOT included:
  //   allow-same-origin   (would give pasted code access to this page and its storage)
  //   allow-top-navigation*  (would let pasted code replace this page)
  //   allow-popups-to-escape-sandbox (popups keep these same restrictions)
  var SANDBOX = 'allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock allow-downloads';
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

  function previewHelper(RUN) {
    var target = window.parent;
    var sent = 0;
    function send(type, detail) {
      if (sent >= 60) { return; }
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
    function memoryStorage() {
      var map = new Map();
      var api = {
        getItem: function (key) { key = String(key); return map.has(key) ? map.get(key) : null; },
        setItem: function (key, value) { map.set(String(key), String(value)); },
        removeItem: function (key) { map.delete(String(key)); },
        clear: function () { map.clear(); },
        key: function (index) { var all = Array.from(map.keys()); return index >= 0 && index < all.length ? all[index] : null; }
      };
      return new Proxy(api, {
        get: function (obj, prop) {
          if (prop === 'length') { return map.size; }
          if (typeof prop === 'symbol' || prop in api) { return api[prop]; }
          return map.has(prop) ? map.get(prop) : undefined;
        },
        set: function (obj, prop, value) {
          if (typeof prop !== 'symbol') { map.set(prop, String(value)); }
          return true;
        },
        has: function (obj, prop) { return map.has(prop) || prop in api; },
        deleteProperty: function (obj, prop) { map.delete(prop); return true; },
        ownKeys: function () { return Array.from(map.keys()); },
        getOwnPropertyDescriptor: function (obj, prop) {
          if (map.has(prop)) { return { value: map.get(prop), writable: true, enumerable: true, configurable: true }; }
          return undefined;
        }
      });
    }
    ['localStorage', 'sessionStorage'].forEach(function (name) {
      try { if (window[name]) { window[name].getItem('x'); return; } } catch (e) { }
      try {
        var stand = memoryStorage();
        Object.defineProperty(window, name, { configurable: true, enumerable: true, get: function () { return stand; } });
      } catch (e) { }
    });
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
  var safeBannerText = $('safeBannerText');
  var safeRunBtn = $('safeRunBtn');
  var toastEl = $('toast');
  var toastText = $('toastText');
  var toastAction = $('toastAction');
  var confirmDialog = $('confirmDialog');
  var helpDialog = $('helpDialog');

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
    }
  };

  function isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
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
    previewPointerEnteredAt: 0,
    runStartedAt: 0,
    savePending: false
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
    var result = store.set(KEYS.code, editor.value);
    if (result.ok) {
      lastSaveProblem = null;
      setSaveState(hasCode() ? 'saved' : 'idle');
    } else {
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
    if (store.available && saveStatus.dataset.state !== 'error') { setSaveState('saving'); }
    clearTimeout(timers.save);
    state.savePending = true;
    timers.save = setTimeout(saveNow, SAVE_DELAY);
  }

  // ---------------------------------------------------------------------------
  // Running the preview
  // ---------------------------------------------------------------------------

  // Adds the helper script right after the doctype (or at the very start), on the
  // same line, so standards mode and the line numbers of the pasted code are unchanged.
  function buildPreviewDocument(code, runId) {
    var helper = '<script>(' + HELPER_SOURCE + ')(' + JSON.stringify(runId) + ');<\/script>';
    var match = /^﻿?\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i.exec(code);
    if (match) {
      return code.slice(0, match[0].length) + helper + code.slice(match[0].length);
    }
    return helper + code;
  }

  function markPending(runId) {
    if (store.available) { store.set(KEYS.pending, runId); }
  }

  function clearPending(runId) {
    if (!store.available) { return; }
    if (!runId || store.get(KEYS.pending) === runId) { store.remove(KEYS.pending); }
  }

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

    var oldRunId = state.runId;
    removeFrame();
    clearPending(oldRunId);

    previewNotice.hidden = true;
    if (!code.trim()) {
      state.runId = null;
      previewEmpty.hidden = false;
      return;
    }
    previewEmpty.hidden = true;
    // React/JSX source shows up as a wall of text in a browser, so explain instead.
    if (analyzeCode(code) === 'react') {
      state.runId = null;
      previewNotice.hidden = false;
      return;
    }

    var runId = newRunId();
    state.runId = runId;
    state.runStartedAt = Date.now();
    markPending(runId);

    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', SANDBOX);
    frame.setAttribute('allow', ALLOW);
    frame.setAttribute('title', 'Preview of your creation');
    frame.srcdoc = buildPreviewDocument(code, runId);
    frame.addEventListener('load', function () {
      if (state.runId !== runId) { return; }
      if (state.focusGuard && state.focusGuard.runId === runId) { state.focusGuard.until = Date.now() + 1500; }
      // If pasted code freezes the page, this timer never fires, the marker stays,
      // and the next visit opens paused instead of freezing again.
      setTimeout(function () { clearPending(runId); }, PENDING_SETTLE_DELAY);
    });

    // Some creations grab keyboard focus when they start. If the person is typing
    // in the editor, keep their keystrokes there.
    state.focusGuard = document.activeElement === editor ? { runId: runId, until: Date.now() + 15000 } : null;

    state.frame = frame;
    frameHost.appendChild(frame);
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
      // If the pointer moved onto the preview after it started, the person probably clicked it.
      var pointerCameIn = state.previewPointerEnteredAt > state.runStartedAt;
      if (frame && document.activeElement === frame && !pointerCameIn && focusGuardActive()) {
        editor.focus({ preventScroll: true });
      }
    }, 0);
  });
  frameHost.addEventListener('pointerenter', function () { state.previewPointerEnteredAt = Date.now(); });
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
      var line = Number(data.line);
      var message = friendlyMessage(String(data.message == null ? 'Unknown error' : data.message).slice(0, 500));
      var lineOk = data.inPage === true && isFinite(line) && line >= 1 && line <= countLines(state.lastRunCode || '') && Math.floor(line) === line;
      problem = { message: message, line: lineOk ? line : 0, advice: extraAdvice(message) };
    } else if (data.type === 'resource') {
      var url = String(data.url == null ? '' : data.url).slice(0, 300);
      problem = {
        message: 'Could not load ' + (data.tag === 'link' ? 'a stylesheet' : 'a script') + (url ? ' from ' + url : '') + '.',
        line: 0,
        advice: 'This part comes from the internet. Check the connection, or ask Gemini to include it in the file.'
      };
    } else {
      return;
    }
    addProblem(problem);
  });

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

  function stripComments(text) { return text.replace(/<!--[\s\S]*?-->/g, '').trim(); }

  function analyzeCode(code) {
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
    if (/^```/.test(text) || /```$/.test(text)) { return 'extra-text'; }
    if (/<\/(body|html)>/i.test(text)) { return 'partial'; }
    if (/^\s*import\s[^\n]*from\s*['"]|^\s*export\s+default\b|\bReactDOM\b|\buseState\s*\(/m.test(text) && !/<script[\s>]/i.test(text)) {
      return 'react';
    }
    if (!/<[a-z!][^>]*>/i.test(text)) { return 'not-html'; }
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
    var current = editor.value;
    var selectedAll = editor.selectionStart === 0 && editor.selectionEnd === current.length;
    var replacing = viaButton || (current.trim() !== '' && !selectedAll && findHtmlStart(text) >= 0);
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
    navigator.clipboard.readText().then(function (text) {
      if (!text || !text.trim()) {
        toast('Nothing has been copied yet. Copy the code from Gemini first.');
        return;
      }
      handleIncomingPaste(text, true);
    }, pasteWithKeyboard);
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
    var needsBom = /[^\x00-\x7F]/.test(code) && code.charCodeAt(0) !== 0xFEFF && !/<meta[^>]+charset/i.test(code);
    var blob = new Blob(needsBom ? ['﻿', code] : [code], { type: 'text/html;charset=utf-8' });
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
    clearPending();
  });

  // Only when saving is impossible: warn before the code is lost.
  window.addEventListener('beforeunload', function (event) {
    if (!store.available && hasCode()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

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
    var pending = store.get(KEYS.pending);
    var saved = store.get(KEYS.code);

    if (saved !== null) { editor.value = saved; }
    updateEmptyState();
    updateEditorStatus();

    if (!store.available) {
      setSaveState('error', 'unavailable');
    } else if (saved && saved.trim()) {
      setSaveState('saved');
    }

    if (saved && saved.trim()) {
      state.lastRunCode = '';
      if (safeRequested || pending) {
        state.autoRun = false;
        autoRunToggle.checked = false;
        safeBannerText.textContent = pending
          ? 'Last time, your creation did not finish starting. It may have frozen the page, so it has not been started again. Check the code (or ask Gemini to fix it), then press Run.'
          : 'Safe mode: your code has not been started. Press Run when you are ready.';
        safeBanner.hidden = false;
        clearPending();
        updateRunIndicators();
      } else {
        run();
        toast('Welcome back! Your code from last time is still here.');
      }
      updateHint();
    } else {
      clearPending();
    }
  }

  init();
})();
