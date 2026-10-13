// Browser tests for the HTML Playground (Chromium via Playwright).
//
//   cd tests && npm install && npm test
//
// Starts a tiny static server for the repository root, so it exercises the same
// files GitHub Pages would serve. Nothing here is needed to use the playground.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'output');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const results = [];
let only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;

async function test(name, fn) {
  if (only && !only.test(name)) { return; }
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✔ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✘ ${name}\n      ${String(error && error.stack || error).split('\n').slice(0, 4).join('\n      ')}`);
  }
}

function assert(condition, message) {
  if (!condition) { throw new Error('Assertion failed: ' + message); }
}

// ---------- helpers ----------

async function openApp(options = {}) {
  const context = options.context || await browser.newContext({
    viewport: options.viewport || { width: 1366, height: 820 },
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    ...(options.contextOptions || {})
  });
  const page = await context.newPage();
  // Only count errors from the playground itself. Code inside the preview is
  // expected to throw in some tests, and Playwright reports those too.
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && String(m.location().url || '').startsWith(BASE)) {
      problems.push('console: ' + m.text());
    }
  });
  await page.addInitScript(() => {
    if (window !== window.top) { return; }
    window.__parentErrors = [];
    window.addEventListener('error', (e) => window.__parentErrors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => window.__parentErrors.push('rejection: ' + String(e.reason)));
  });
  if (options.initScript) { await page.addInitScript(options.initScript); }
  await page.goto(BASE + (options.query || ''));
  await page.evaluate(() => {
    window.__runs = 0;
    new MutationObserver((records) => {
      for (const r of records) { for (const n of r.addedNodes) { if (n.tagName === 'IFRAME') { window.__runs += 1; } } }
    }).observe(document.getElementById('frameHost'), { childList: true });
  });
  return { context, page, problems };
}

async function setCode(page, code) {
  await page.evaluate((value) => {
    const editor = document.getElementById('editor');
    editor.value = value;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);
}

// A real paste: clipboard -> Ctrl+V into the editor.
async function pasteCode(page, code) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), code);
  await page.click('#editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+V');
}

// The current preview frame, once it has loaded. Pass `afterRuns` to wait for a newer run.
async function previewFrame(page, timeout = 5000, afterRuns = -1) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await runs(page)) > afterRuns) {
      const handle = await page.$('#frameHost iframe');
      const frame = handle && await handle.contentFrame();
      if (frame) {
        await frame.waitForLoadState('load');
        return frame;
      }
    }
    await wait(50);
  }
  throw new Error('preview did not start within ' + timeout + ' ms');
}

async function parentErrors(page, problems) {
  return problems.concat(await page.evaluate(() => window.__parentErrors || []));
}

// The saved code in the playground's own storage (keys look like html-playground:v1:/path/:code).
async function savedCode(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('html-playground:v1:') && key.endsWith(':code')) { return localStorage.getItem(key); }
    }
    return null;
  });
}

async function runs(page) { return page.evaluate(() => window.__runs || 0); }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const FEATURE_DOC = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Feature test</title>
<style>
  body { font-family: sans-serif; background: rgb(250, 240, 230); }
  #box { width: 50px; height: 50px; background: rgb(0, 128, 0); transition: transform 0.2s; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
</style>
</head>
<body>
  <h1 id="title">Hello</h1>
  <button id="btn">Click me</button>
  <span id="clicks">0</span>
  <input type="range" id="slider" min="0" max="10" value="3">
  <span id="sliderValue">3</span>
  <span id="ticks">0</span>
  <span id="frames">0</span>
  <div id="box" class="spin"></div>
  <svg id="svg" width="100" height="60"><circle id="dot" cx="30" cy="30" r="20" fill="purple"/></svg>
  <canvas id="canvas" width="40" height="40"></canvas>
  <form id="form"><input name="q" value="x"><button id="submit">Go</button></form>
  <span id="submitted">no</span>
  <span id="saved"></span>
  <script>
    let clicks = 0;
    document.getElementById('btn').addEventListener('click', () => {
      clicks += 1;
      document.getElementById('clicks').textContent = String(clicks);
    });
    const slider = document.getElementById('slider');
    slider.addEventListener('input', () => { document.getElementById('sliderValue').textContent = slider.value; });
    let ticks = 0;
    setInterval(() => { ticks += 1; document.getElementById('ticks').textContent = String(ticks); }, 50);
    let frames = 0;
    (function loop() { frames += 1; document.getElementById('frames').textContent = String(frames); requestAnimationFrame(loop); })();
    const ctx = document.getElementById('canvas').getContext('2d');
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 40, 40);
    document.getElementById('form').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('submitted').textContent = 'yes';
    });
    localStorage.setItem('score', '42');
    document.getElementById('saved').textContent = localStorage.getItem('score');
  </script>
</body>
</html>
`;

// ---------- tests ----------

console.log('HTML Playground browser tests\n');

await test('1. First visit shows the empty state and loads without errors', async () => {
  const { context, page, problems } = await openApp();
  assert(await page.isVisible('text=Paste your HTML from Gemini here'), 'empty-state instruction visible');
  assert(await page.isVisible('#previewEmpty'), 'empty preview message visible');
  assert(await page.inputValue('#editor') === '', 'editor starts empty');
  assert(await page.$('#frameHost iframe') === null, 'no preview iframe while empty');
  for (const id of ['copyBtn', 'clearBtn', 'runBtn', 'fullscreenBtn']) {
    assert(await page.isDisabled('#' + id), id + ' is disabled until there is code');
  }
  assert(await page.isEnabled('#downloadBtn') && await page.isEnabled('#pasteBtn') && await page.isEnabled('#sampleBtn'), 'main actions available');
  { const errs = await parentErrors(page, problems); assert(errs.length === 0, 'no console errors: ' + errs.join('; ')); }
  await page.screenshot({ path: path.join(OUT, 'empty.png') });
  await context.close();
});

await test('2. Pasting a complete document runs it: buttons, sliders, timers, animation, SVG, canvas, forms', async () => {
  const { context, page, problems } = await openApp();
  await pasteCode(page, FEATURE_DOC);
  const frame = await previewFrame(page, 3000);
  assert(await page.inputValue('#editor') === FEATURE_DOC, 'editor holds pasted code');
  assert(await page.$eval('.editor-wrap', (el) => el.classList.contains('has-code')), 'empty state hidden');

  await frame.click('#btn');
  await frame.click('#btn');
  assert(await frame.textContent('#clicks') === '2', 'button clicks counted');

  await frame.fill('#slider', '7');
  assert(await frame.textContent('#sliderValue') === '7', 'slider input event works');

  await wait(400);
  assert(Number(await frame.textContent('#ticks')) >= 3, 'setInterval timer ticks');
  assert(Number(await frame.textContent('#frames')) >= 5, 'requestAnimationFrame runs');
  const anim = await frame.evaluate(() => document.getAnimations().length);
  assert(anim >= 1, 'CSS animation running');

  const svgBox = await frame.evaluate(() => { const b = document.getElementById('dot').getBBox(); return [b.width, b.height]; });
  assert(svgBox[0] === 40 && svgBox[1] === 40, 'SVG circle rendered with the right size');

  const pixel = await frame.evaluate(() => Array.from(document.getElementById('canvas').getContext('2d').getImageData(10, 10, 1, 1).data));
  assert(pixel[0] === 255 && pixel[1] === 0 && pixel[2] === 0, 'canvas drew red pixels: ' + pixel);

  await frame.click('#submit');
  assert(await frame.textContent('#submitted') === 'yes', 'form submit handler ran (allow-forms)');
  assert(await frame.textContent('#saved') === '42', 'localStorage stand-in works inside the preview');

  const bg = await frame.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(bg === 'rgb(250, 240, 230)', 'embedded CSS applied');
  assert(await frame.evaluate(() => document.compatMode) === 'CSS1Compat', 'standards mode preserved');
  assert(await frame.evaluate(() => document.querySelectorAll('script').length) === 1, 'helper script removed itself from the DOM');
  assert(await page.isHidden('#problems'), 'no problem bar for working code');
  { const errs = await parentErrors(page, problems); assert(errs.length === 0, 'no parent errors: ' + errs.join('; ')); }
  await page.screenshot({ path: path.join(OUT, 'features.png') });
  await context.close();
});

await test('3. Editing updates the preview after a pause, without restarting on every keystroke', async () => {
  const { context, page } = await openApp();
  await setCode(page, '<!DOCTYPE html><h1 id="t">Version 1</h1>');
  await wait(1200);
  let frame = await previewFrame(page);
  assert(await frame.textContent('#t') === 'Version 1', 'first version shown');
  const before = await runs(page);

  // Type 12 characters quickly: should cause exactly one restart.
  await page.click('#editor');
  await page.keyboard.press('Control+End');
  await page.keyboard.type('<p id="p">abcdefg</p>', { delay: 20 });
  await wait(300);
  assert(await runs(page) === before, 'no restart while still typing');
  await wait(1100);
  assert(await runs(page) === before + 1, 'exactly one restart after the pause, got ' + ((await runs(page)) - before));
  frame = await previewFrame(page);
  assert(await frame.textContent('#p') === 'abcdefg', 'typed content shown');

  for (let i = 2; i <= 4; i++) {
    await setCode(page, `<!DOCTYPE html><h1 id="t">Version ${i}</h1>`);
    await wait(1100);
    frame = await previewFrame(page);
    assert(await frame.textContent('#t') === `Version ${i}`, `version ${i} shown`);
  }

  // Auto-update off: no restarts until Run.
  await page.click('label:has(#autoRunToggle)');
  assert(!(await page.isChecked('#autoRunToggle')), 'auto-update switched off');
  const runsOff = await runs(page);
  await setCode(page, '<!DOCTYPE html><h1 id="t">Manual</h1>');
  await wait(1300);
  assert(await runs(page) === runsOff, 'no auto restart when auto-update is off');
  assert((await page.textContent('#runStatus')).includes('Press Run'), 'waiting indicator shown');
  await page.click('#runBtn');
  frame = await previewFrame(page);
  assert(await frame.textContent('#t') === 'Manual', 'Run button shows latest code');

  // Ctrl+Enter runs too.
  const runsBefore = await runs(page);
  await page.click('#editor');
  await page.keyboard.press('Control+Enter');
  assert(await runs(page) === runsBefore + 1, 'Ctrl+Enter runs');
  await context.close();
});

await test('4. Preview cannot reach the parent page, its storage, or top-level navigation', async () => {
  const { context, page } = await openApp();
  await setCode(page, '<!DOCTYPE html><p>secret parent code marker</p>');
  await wait(600);
  const probe = `<!DOCTYPE html><html><body><a id="topLink" href="https://example.com/" target="_top">top</a>
<form id="f" action="https://example.com/" target="_top"></form>
<script>
  var r = {};
  try { r.parentDoc = String(parent.document.title); } catch (e) { r.parentDoc = 'blocked:' + e.name; }
  try { r.topDoc = String(top.document.body.innerHTML.length); } catch (e) { r.topDoc = 'blocked:' + e.name; }
  try { r.parentStorage = parent.localStorage.length; } catch (e) { r.parentStorage = 'blocked:' + e.name; }
  r.ownStorage = String(localStorage.getItem('html-playground:v1:code'));
  r.storageKeys = Object.keys(localStorage).length;
  try { r.cookie = document.cookie; } catch (e) { r.cookie = 'blocked:' + e.name; }
  try { r.indexedDB = typeof indexedDB.open('x'); } catch (e) { r.indexedDB = 'blocked:' + e.name; }
  r.origin = location.origin;
  try { top.location.href = 'https://example.com/'; r.topNav = 'not thrown'; } catch (e) { r.topNav = 'blocked:' + e.name; }
  window.__r = r;
</script></body></html>`;
  await setCode(page, probe);
  await wait(1300);
  const frame = await previewFrame(page);
  const r = await frame.evaluate(() => window.__r);
  assert(String(r.parentDoc).startsWith('blocked:SecurityError'), 'parent.document blocked: ' + r.parentDoc);
  assert(String(r.topDoc).startsWith('blocked:SecurityError'), 'top.document blocked: ' + r.topDoc);
  assert(String(r.parentStorage).startsWith('blocked:SecurityError'), 'parent.localStorage blocked: ' + r.parentStorage);
  assert(r.ownStorage === 'null' && r.storageKeys === 0, 'preview storage is a separate empty stand-in');
  assert(String(r.cookie).startsWith('blocked'), 'cookies unavailable: ' + r.cookie);
  assert(r.origin === 'null', 'opaque origin: ' + r.origin);
  await frame.click('#topLink').catch(() => {});
  await frame.evaluate(() => document.getElementById('f').submit()).catch(() => {});
  await wait(800);
  assert(page.url() === BASE, 'parent page was not navigated away: ' + page.url());
  const sandbox = await page.$eval('#frameHost iframe', (f) => f.getAttribute('sandbox'));
  assert(!/allow-same-origin|allow-top-navigation|escape-sandbox|allow-downloads/.test(sandbox), 'sandbox flags are restrictive: ' + sandbox);
  assert((await savedCode(page)) !== null, 'parent storage intact');

  // Forged / hostile messages from the preview are shown as text only, and stale ones are ignored.
  await setCode(page, `<!DOCTYPE html><script>
    parent.postMessage({ htmlPlayground: 1, type: 'error', run: 'wrong-run', message: 'STALE' }, '*');
    parent.postMessage({ htmlPlayground: 1, type: 'run-code', run: 'x', code: 'alert(1)' }, '*');
    throw new Error('<img src=x onerror="window.top.__pwned=1">');
  <\/script>`);
  await wait(1500);
  await page.waitForSelector('#problems:not([hidden])', { timeout: 3000 });
  const text = await page.textContent('#problemsMessage');
  assert(text.includes('<img src=x'), 'markup is displayed as text');
  assert(!text.includes('STALE'), 'message for another run ignored');
  assert(await page.$('#problems img') === null, 'no element injected');
  assert(await page.evaluate(() => window.__pwned) === undefined, 'nothing executed in parent');

  // The run id is not a secret (it filters out stale messages). Even with it,
  // odd message shapes must not upset the parent.
  await setCode(page, `<!DOCTYPE html><script>
    Object.defineProperty(Object.prototype, 'run', { configurable: true, set: function (v) {
      Object.defineProperty(this, 'run', { value: v, writable: true, enumerable: true, configurable: true });
      var id = v;
      setTimeout(function () {
        parent.postMessage({ htmlPlayground: 1, type: 'error', run: id, message: { toString: 'x' }, line: { valueOf: 1 } }, '*');
        parent.postMessage({ htmlPlayground: 1, type: 'resource', run: id, url: ['x'], tag: 7 }, '*');
        parent.postMessage({ htmlPlayground: 1, type: 'error', run: id, message: 'x'.repeat(100000), line: 1e9 }, '*');
      }, 50);
    } });
    setTimeout(function () { throw new Error('first'); }, 10);
  <\/script>`);
  await wait(1700);
  const errs = await page.evaluate(() => window.__parentErrors);
  assert(errs.length === 0, 'odd messages handled quietly: ' + errs.join('; '));
  assert((await page.textContent('#problemsMessage')).length < 1500, 'long messages are cut short');
  await context.close();
});

await test('5. Refreshing the page brings back the saved code', async () => {
  const { context, page } = await openApp();
  await page.click('#editor');
  await page.keyboard.type('<!DOCTYPE html><h1 id="h">Remember me</h1>');
  await wait(700);
  assert((await page.textContent('#saveStatus')).includes('Saved'), 'saved indicator: ' + await page.textContent('#saveStatus'));
  await page.reload();
  assert(await page.inputValue('#editor') === '<!DOCTYPE html><h1 id="h">Remember me</h1>', 'code restored after reload');
  const frame = await previewFrame(page);
  assert(await frame.textContent('#h') === 'Remember me', 'restored code runs');
  assert(await page.isHidden('#safeBanner'), 'normal reload does not trigger safe mode');
  assert((await page.textContent('#toastText')).includes('Welcome back'), 'welcome-back message');

  // Reload right after typing (before the save delay) still keeps the code.
  await page.click('#editor');
  await page.keyboard.press('Control+End');
  await page.keyboard.type('!');
  await page.reload();
  assert((await page.inputValue('#editor')).endsWith('!'), 'pending save flushed on reload');
  assert(await page.isHidden('#safeBanner'), 'quick reload is not mistaken for a freeze');
  await context.close();
});

await test('6. Download gives the exact code as my-creation.html that works on its own', async () => {
  const { context, page } = await openApp();
  await page.click('#emptySampleBtn');
  await previewFrame(page);
  const code = await page.inputValue('#editor');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
  assert(download.suggestedFilename() === 'my-creation.html', 'filename: ' + download.suggestedFilename());
  const file = path.join(OUT, 'my-creation.html');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  assert(bytes.toString('utf8') === code, 'downloaded bytes equal the editor content exactly');

  const standalone = await context.newPage();
  const errors = [];
  standalone.on('pageerror', (e) => errors.push(e.message));
  await standalone.goto('file://' + file);
  assert((await standalone.textContent('h1')).includes('Bouncing Balls'), 'file opens with emoji intact');
  await standalone.click('#addBall');
  assert((await standalone.textContent('#count')) === 'Balls: 4', 'downloaded file is interactive');
  assert(errors.length === 0, 'no errors in downloaded file: ' + errors.join('; '));

  // No charset declaration + non-ASCII text: an invisible UTF-8 marker keeps it readable from disk.
  await setCode(page, '<p id="x">Café 🎉 naïve</p>');
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
  const file2 = path.join(OUT, 'no-charset.html');
  await d2.saveAs(file2);
  const b2 = fs.readFileSync(file2);
  assert(b2[0] === 0xEF && b2[1] === 0xBB && b2[2] === 0xBF, 'BOM added only when needed');
  assert(b2.subarray(3).toString('utf8') === '<p id="x">Café 🎉 naïve</p>', 'rest of file unchanged');
  await standalone.goto('file://' + file2);
  assert((await standalone.textContent('#x')) === 'Café 🎉 naïve', 'accents and emoji display correctly from disk');

  // Empty editor: no download, friendly message.
  await setCode(page, '');
  await page.click('#downloadBtn');
  assert((await page.textContent('#toastText')).includes('nothing to download'), 'empty download explained');
  await context.close();
});

await test('7. Broken HTML or JavaScript never breaks the playground; errors are explained', async () => {
  const { context, page, problems } = await openApp();
  await pasteCode(page, '<div><p>Unclosed <b>tags <table><tr><td>cell\n<script>function broken( {\n<\/script>\n<h2 id="after">still here</h2>');
  const frame = await previewFrame(page);
  await page.waitForSelector('#problems:not([hidden])', { timeout: 3000 });
  assert(/SyntaxError/i.test(await page.textContent('#problemsMessage')), 'syntax error reported');
  assert((await frame.textContent('body')).includes('still here'), 'rest of the page still renders');

  const errorDoc = '<!DOCTYPE html>\n<html>\n<body>\n<p>ok</p>\n<script>\n  let a = 1;\n  missingFunction();\n<\/script>\n</body>\n</html>';
  let before = await runs(page);
  await pasteCode(page, errorDoc);
  await previewFrame(page, 5000, before);
  await page.waitForSelector('#problems:not([hidden])', { timeout: 3000 });
  const message = await page.textContent('#problemsMessage');
  assert(message.includes('missingFunction is not defined') && message.includes('line 7'), 'error with correct line number: ' + message);
  await page.click('#problemsLine');
  const selected = await page.evaluate(() => { const e = document.getElementById('editor'); return e.value.slice(e.selectionStart, e.selectionEnd); });
  assert(selected.trim() === 'missingFunction();', 'Show line selects the line: ' + JSON.stringify(selected));
  await page.click('#problemsCopy');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip.includes('missingFunction is not defined') && clip.includes('complete, updated HTML file'), 'copy for Gemini text');

  // Promise rejections, failed external scripts, and endless error loops.
  before = await runs(page);
  await pasteCode(page, '<!DOCTYPE html><script src="http://127.0.0.1:9/missing.js"><\/script><script>Promise.reject(new Error("async oops")); setInterval(function(){ throw new Error("again") }, 5);<\/script>');
  await previewFrame(page, 5000, before);
  await wait(1200);
  const many = await page.textContent('#problemsMessage');
  assert(/Could not load a script|async oops|again/.test(many), 'async and resource problems reported: ' + many);

  // Parent still fully usable.
  await page.click('#helpBtn');
  assert(await page.isVisible('#helpDialog'), 'help still opens');
  await page.keyboard.press('Escape');
  before = await runs(page);
  await page.click('#sampleBtn');
  await page.click('#confirmOk');
  const f2 = await previewFrame(page, 5000, before);
  assert((await f2.textContent('h1')).includes('Bouncing'), 'sample loads after errors');
  { const errs = await parentErrors(page, problems); assert(errs.length === 0, 'no errors in the parent page: ' + errs.join('; ')); }
  await context.close();
});

await test('7b. Endless loop: the next visit opens paused instead of freezing again', async () => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const { page } = await openApp({ context });
  await setCode(page, '<!DOCTYPE html><p>loop</p><script>setTimeout(function () { while (true) {} }, 300);<\/script>');
  await wait(2500); // let the autosave + auto-run happen, then the loop starts
  const responsive = await Promise.race([page.evaluate(() => 'responsive'), wait(2500).then(() => 'frozen')]);
  await page.close({ runBeforeUnload: false }).catch(() => {});
  const again = await context.newPage();
  await again.goto(BASE);
  console.log('      parent during loop: ' + responsive);
  assert(await again.isVisible('#safeBanner'), 'safe-mode banner shown (parent was ' + responsive + ')');
  assert(await again.$('#frameHost iframe') === null, 'code not started automatically');
  assert(!(await again.isChecked('#autoRunToggle')), 'auto-update paused for this visit');
  assert((await again.inputValue('#editor')).includes('while (true)'), 'code is still there to fix');
  await again.reload();
  assert(await again.isHidden('#safeBanner'), 'only the visit right after a freeze is paused');
  await context.close();
});

await test('7c. ?safe opens paused', async () => {
  const { context, page } = await openApp();
  await setCode(page, '<!DOCTYPE html><p>hi</p>');
  await wait(600);
  await page.goto(BASE + '?safe');
  assert(await page.isVisible('#safeBanner'), 'safe banner');
  assert(await page.$('#frameHost iframe') === null, 'not started');
  await page.click('#safeRunBtn');
  await previewFrame(page);
  assert(await page.isHidden('#safeBanner'), 'banner gone after Run');
  await context.close();
});

await test('7d. Freezes that start later are caught too; a second open tab is not mistaken for a freeze', async () => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const { page } = await openApp({ context });
  await setCode(page, '<!DOCTYPE html><p>late</p><script>setTimeout(function () { while (true) {} }, 4500);<\/script>');
  await wait(7500);
  await page.close({ runBeforeUnload: false }).catch(() => {});
  const again = await context.newPage();
  await again.goto(BASE);
  await again.waitForTimeout(500);
  assert(await again.isVisible('#safeBanner'), 'a freeze 4.5 s after start is detected');

  // Two healthy tabs: the second one must not open paused.
  await setCode(again, '<!DOCTYPE html><p id="ok">fine</p>');
  await wait(1500);
  const second = await context.newPage();
  await second.goto(BASE);
  const frame = await previewFrame(second, 6000);
  assert(await frame.textContent('#ok') === 'fine', 'second tab starts the code');
  assert(await second.isHidden('#safeBanner'), 'no false "stopped responding" message');
  await context.close();
});

await test('7e. Two tabs: changes in one tab are not silently overwritten by the other', async () => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const { page: a } = await openApp({ context });
  await setCode(a, '<!DOCTYPE html><p>first</p>');
  await wait(700);
  const b = await context.newPage();
  await b.goto(BASE);
  await setCode(b, '<!DOCTYPE html><p>newer work in tab B</p>');
  await wait(800);
  assert(await a.isVisible('#tabBanner'), 'tab A notices tab B saved different code');
  await setCode(a, '<!DOCTYPE html><p>stale tab A keeps typing</p>');
  await wait(800);
  assert((await savedCode(a)).includes('newer work in tab B'), "tab A did not overwrite tab B's saved code");
  assert((await a.textContent('#saveStatus')).includes('another tab'), 'tab A says it is not saving');
  await a.click('#tabUseOther');
  assert((await a.inputValue('#editor')).includes('newer work in tab B'), 'can load the other version');
  assert(await a.isHidden('#tabBanner'), 'banner closes');
  await context.close();
});

await test('7f. Unusual pastes cannot make the playground itself slow', async () => {
  const { context, page } = await openApp();
  const cases = {
    'many comments, no doctype': '<!--a-->' + ' <!--b-->'.repeat(40) + '<p>x</p>',
    'many blank lines': '\n'.repeat(60000) + 'x',
    'many unclosed tags': '<a'.repeat(120000),
    'many unclosed comments': '<!--'.repeat(40000),
    'many unclosed meta tags with accents': 'é' + '<meta '.repeat(40000)
  };
  for (const [name, code] of Object.entries(cases)) {
    const t0 = Date.now();
    await setCode(page, code);
    await page.evaluate(() => document.getElementById('runBtn').click());
    const elapsed = Date.now() - t0;
    assert(elapsed < 1500, `${name}: handled in ${elapsed} ms`);
  }
  const t1 = Date.now();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
  assert(Date.now() - t1 < 1500 && download.suggestedFilename() === 'my-creation.html', 'download stays quick');
  await context.close();
});

await test('8. Long files stay responsive', async () => {
  const { context, page } = await openApp();
  const rows = [];
  for (let i = 0; i < 20000; i++) { rows.push(`<div class="row">Row ${i} <span>${'lorem ipsum '.repeat(3)}</span></div>`); }
  const lines = ['<!DOCTYPE html>', '<html>', '<body>', ...rows, '<script>', 'document.body.dataset.done = document.querySelectorAll(".row").length;', 'notDefinedAtTheEnd();', '<\/script>', '</body>', '</html>'];
  const big = lines.join('\n');
  const errorLine = lines.indexOf('notDefinedAtTheEnd();') + 1;
  const t0 = Date.now();
  await pasteCode(page, big);
  const frame = await previewFrame(page, 10000);
  await frame.waitForFunction(() => document.body.dataset.done === '20000', null, { timeout: 10000 });
  const elapsed = Date.now() - t0;
  assert(elapsed < 8000, 'large paste rendered in ' + elapsed + ' ms');
  assert((await page.textContent('#editorStatus')).includes('of ' + lines.length), 'line count: ' + await page.textContent('#editorStatus'));
  await page.waitForSelector('#problems:not([hidden])');
  assert((await page.textContent('#problemsMessage')).includes('line ' + errorLine), 'line number near the end is right: ' + await page.textContent('#problemsMessage'));
  await page.click('#problemsLine');
  const scroll = await page.$eval('#editor', (e) => ({ top: e.scrollTop, height: e.scrollHeight, client: e.clientHeight, selected: e.value.slice(e.selectionStart, e.selectionEnd) }));
  assert(scroll.selected === 'notDefinedAtTheEnd();', 'selected the reported line');
  assert(scroll.top > scroll.height - scroll.client * 3, 'scrolled near the end: ' + JSON.stringify(scroll));
  const typeStart = Date.now();
  await page.keyboard.press('End');
  await page.keyboard.type(' // more');
  assert(Date.now() - typeStart < 2000, 'typing stays quick in a big file');
  await context.close();
});

await test('8b. Very large code: autosave fails gracefully and says so', async () => {
  const { context, page, problems } = await openApp();
  const huge = '<!DOCTYPE html><p>big</p><!--' + 'x'.repeat(11 * 1024 * 1024) + '-->';
  await setCode(page, huge);
  await wait(1500);
  const status = await page.textContent('#saveStatus');
  assert(/Too big|Not saved/.test(status), 'save problem shown: ' + status);
  const frame = await previewFrame(page, 10000);
  assert((await frame.textContent('p')) === 'big', 'still previews');
  assert((await savedCode(page)) === null, 'no older version left behind to be restored as if it were current');
  { const errs = await parentErrors(page, problems); assert(errs.length === 0, 'no uncaught errors: ' + errs.join('; ')); }
  await context.close();
});

await test('8c. Narrow phone-sized window: tabs, no sideways scrolling, paste shows the preview', async () => {
  for (const width of [320, 390, 768]) {
    const { context, page } = await openApp({ viewport: { width, height: 740 }, contextOptions: { isMobile: width < 500, hasTouch: width < 500 } });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `no horizontal scroll at ${width}px (overflow ${overflow})`);
    assert(await page.isVisible('#tabCode') && await page.isVisible('#tabPreview'), 'tabs visible');
    assert(await page.isHidden('#previewPane'), 'preview hidden on code tab');
    await pasteCode(page, '<!DOCTYPE html><h1 id="m">Phone</h1>');
    await page.waitForSelector('#previewPane', { state: 'visible', timeout: 3000 });
    assert(await page.getAttribute('#tabPreview', 'aria-selected') === 'true', 'switched to the preview tab after paste');
    const frame = await previewFrame(page);
    assert(await frame.textContent('#m') === 'Phone', 'preview works on narrow screens');
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow2 <= 0, `still no horizontal scroll at ${width}px with code (overflow ${overflow2})`);
    await page.screenshot({ path: path.join(OUT, `narrow-${width}.png`) });
    await page.click('#tabCode');
    assert(await page.isVisible('#editor'), 'back to code');
    await context.close();
  }
});

await test('9. Clear and Sample ask first; Undo works; keyboard controls work', async () => {
  const { context, page } = await openApp();
  await setCode(page, '<!DOCTYPE html><p>mine</p>');
  await page.click('#clearBtn');
  assert(await page.isVisible('#confirmDialog'), 'clear asks for confirmation');
  await page.click('#confirmDialog button[value="cancel"]');
  assert(await page.inputValue('#editor') === '<!DOCTYPE html><p>mine</p>', 'cancel keeps code');

  await page.click('#clearBtn');
  await page.keyboard.press('Escape');
  assert(await page.inputValue('#editor') !== '', 'Esc cancels');

  await page.click('#clearBtn');
  const focused = await page.evaluate(() => document.activeElement.textContent.trim());
  assert(focused === 'Cancel', 'the safe choice has focus by default: ' + focused);
  await page.click('#confirmOk');
  await page.waitForFunction(() => document.getElementById('editor').value === '');
  assert(await page.inputValue('#editor') === '', 'cleared');
  assert(await page.isVisible('text=Paste your HTML from Gemini here'), 'empty state is back');
  assert((await savedCode(page)) === '', 'cleared on this device too');
  await page.click('#toastAction');
  assert(await page.inputValue('#editor') === '<!DOCTYPE html><p>mine</p>', 'undo restores');

  await page.click('#sampleBtn');
  assert(await page.isVisible('#confirmDialog'), 'sample asks before replacing code');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#confirmExtra')]);
  assert(download.suggestedFilename() === 'my-creation.html', 'download-first works from the dialog');
  await page.click('#confirmOk');
  await page.waitForFunction(() => document.getElementById('editor').value.includes('Bouncing Balls'), null, { timeout: 2000 });

  // Divider by keyboard and mouse.
  await page.focus('#divider');
  const v0 = Number(await page.getAttribute('#divider', 'aria-valuenow'));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const v1 = Number(await page.getAttribute('#divider', 'aria-valuenow'));
  assert(v1 === v0 - 10, `arrow keys move divider ${v0} -> ${v1}`);
  const box = await page.$eval('#divider', (d) => { const r = d.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y, { steps: 5 });
  await page.mouse.up();
  const v2 = Number(await page.getAttribute('#divider', 'aria-valuenow'));
  assert(v2 > v1 + 10, `dragging moves divider ${v1} -> ${v2}`);
  await page.reload();
  assert(Number(await page.getAttribute('#divider', 'aria-valuenow')) === v2, 'divider position remembered');

  // Visible focus indicator for keyboard users.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
  assert(outline.startsWith('solid') && parseFloat(outline.split(' ')[1]) >= 2, 'focus ring visible: ' + outline);

  // Ctrl+S
  await page.click('#editor');
  await page.keyboard.press('Control+s');
  assert((await page.textContent('#toastText')).includes('Saved on this device'), 'Ctrl+S explains saving');

  // Wrap toggle
  await page.click('label:has(#wrapToggle)');
  assert(await page.$eval('#editor', (e) => getComputedStyle(e).whiteSpace) === 'pre', 'wrap off');
  await page.click('label:has(#wrapToggle)');
  assert(await page.$eval('#editor', (e) => getComputedStyle(e).whiteSpace) === 'pre-wrap', 'wrap on');

  // Full screen (real full screen or the fill-the-window fallback) and back.
  await page.click('#fullscreenBtn');
  await wait(400);
  assert((await page.textContent('#fullscreenLabel')) === 'Exit full screen', 'full screen on');
  await page.click('#fullscreenBtn');
  await wait(400);
  assert((await page.textContent('#fullscreenLabel')) === 'Full screen', 'full screen off');

  // Help dialog opens at the right section and closes with Esc.
  await page.click('button[data-help="home"]');
  assert(await page.isVisible('#help-home'), 'help opens');
  await page.keyboard.press('Escape');
  assert(await page.isHidden('#helpDialog'), 'help closes with Esc');
  await context.close();
});

await test('9b. Keyboard focus stays in the editor when a creation grabs focus on start', async () => {
  const { context, page } = await openApp();
  await setCode(page, '<!DOCTYPE html><input id="grab"><script>document.getElementById("grab").focus(); setTimeout(function(){ document.getElementById("grab").focus(); }, 300);<\/script>');
  await wait(1300);
  await page.click('#editor');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' ');
  await wait(1700); // auto-run happens; creation tries to take focus
  await page.keyboard.type('XYZ');
  const value = await page.inputValue('#editor');
  assert(value.endsWith(' XYZ'), 'typing stayed in the editor: ' + JSON.stringify(value.slice(-12)));
  const frame = await previewFrame(page);
  assert(await frame.inputValue('#grab') === '', 'nothing typed into the preview');
  await context.close();
});

await test('9c. Paste helper: chat text / ``` fences, React code, partial copies, and non-HTML', async () => {
  const { context, page } = await openApp();
  const chat = 'Here is your app!\n```html\n<!DOCTYPE html>\n<html><body><h1 id="z">Fenced</h1></body></html>\n```\nLet me know if you want changes.';
  await pasteCode(page, chat);
  await page.waitForFunction(() => document.getElementById('editor').value.startsWith('<!DOCTYPE html>'));
  const cleaned = await page.inputValue('#editor');
  assert(cleaned.startsWith('<!DOCTYPE html>') && cleaned.trim().endsWith('</html>'), 'chat text removed on paste: ' + JSON.stringify(cleaned));
  assert((await page.textContent('#toastText')).includes("Removed Gemini's chat text"), 'explained: ' + await page.textContent('#toastText'));
  assert(await page.isHidden('#hint'), 'no hint needed after cleaning');
  let frame = await previewFrame(page);
  assert(await frame.evaluate(() => document.compatMode) === 'CSS1Compat', 'standards mode after cleaning');
  await page.click('#toastAction');
  assert(await page.inputValue('#editor') === chat, 'undo brings back exactly what was pasted');
  await page.waitForSelector('#hint:not([hidden])');
  assert((await page.textContent('#hintText')).includes('chat message'), 'hint offers the clean-up again');
  await page.click('#hintAction');
  assert((await page.inputValue('#editor')).startsWith('<!DOCTYPE html>'), 'Clean it up button works');

  await pasteCode(page, '<!DOCTYPE html>\n<html>\n<head><title>Quiz</title></head>\n<body>\n<h1>Quiz</h1>\n<script>\nconst questions = [');
  await page.waitForSelector('#hint:not([hidden])');
  assert((await page.textContent('#hintText')).includes('end of the code seems to be missing'), 'cut-off code noticed');
  await page.click('#hintAction');
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes('complete HTML file again'), 'request for the full file copied');

  await pasteCode(page, '  <button onclick="go()">Go</button>\n</body>\n</html>');
  await page.waitForSelector('#hint:not([hidden])');
  assert((await page.textContent('#hintText')).includes('only part of the code'), 'partial copy noticed');

  await pasteCode(page, "import React, { useState } from 'react';\n\nexport default function App() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n");
  await page.waitForSelector('#hint:not([hidden])');
  assert((await page.textContent('#hintText')).includes('React'), 'React noticed');
  await page.click('#hintAction');
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes('one complete HTML file'), 'request for Gemini copied');
  assert(await page.isVisible('#previewNotice'), 'preview explains that React cannot run here');
  assert(await page.$('#frameHost iframe') === null, 'React source is not run as a page');

  await pasteCode(page, 'body { color: red; }\n.box { padding: 4px; }');
  await page.waitForSelector('#hint:not([hidden])');
  assert((await page.textContent('#hintText')).includes('complete web page'), 'non-HTML noticed');
  await page.click('#hintDismiss');
  assert(await page.isHidden('#hint'), 'Ignore hides hint');

  await pasteCode(page, FEATURE_DOC);
  await wait(200);
  assert(await page.isHidden('#hint'), 'no hint for a normal document');
  await context.close();
});

await test('9f. Pasting a new version into old code replaces it (instead of mixing the two)', async () => {
  const { context, page } = await openApp();
  const v1 = '<!DOCTYPE html>\n<html>\n<body>\n<h1 id="v">One</h1>\n</body>\n</html>\n';
  const v2 = '<!DOCTYPE html>\n<html>\n<body>\n<h1 id="v">Two</h1>\n</body>\n</html>\n';
  await setCode(page, v1);
  await wait(1200);
  // Click into the middle of the old code (no select-all) and paste the new version.
  await page.evaluate((text) => navigator.clipboard.writeText(text), v2);
  await page.click('#editor');
  await page.evaluate(() => document.getElementById('editor').setSelectionRange(20, 20));
  const before = await runs(page);
  await page.keyboard.press('Control+V');
  assert(await page.inputValue('#editor') === v2, 'old code replaced, not mixed: ' + JSON.stringify(await page.inputValue('#editor')));
  const frame = await previewFrame(page, 3000, before);
  assert(await frame.textContent('#v') === 'Two', 'new version runs right away');
  assert((await page.textContent('#toastText')).includes('Replaced your old code'), 'explained with undo');
  await page.click('#toastAction');
  assert(await page.inputValue('#editor') === v1, 'undo restores the old version');

  // Pasting a small piece (not a whole page) still inserts at the cursor.
  await page.evaluate((text) => navigator.clipboard.writeText(text), '<p>extra</p>');
  await page.click('#editor');
  await page.evaluate(() => { const e = document.getElementById('editor'); const i = e.value.indexOf('</body>'); e.setSelectionRange(i, i); });
  await page.keyboard.press('Control+V');
  assert((await page.inputValue('#editor')).includes('<p>extra</p></body>'), 'snippet inserted at the cursor');
  await context.close();
});

await test('9d. Storage blocked: the playground still works and says it cannot save', async () => {
  const { context, page, problems } = await openApp({
    initScript: () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    }
  });
  assert((await page.textContent('#saveStatus')).includes('Not saved'), 'warning shown: ' + await page.textContent('#saveStatus'));
  await page.click('#emptySampleBtn');
  const frame = await previewFrame(page);
  assert((await frame.textContent('h1')).includes('Bouncing'), 'still runs');
  { const errs = await parentErrors(page, problems); assert(errs.length === 0, 'no errors: ' + errs.join('; ')); }
  await context.close();
});

await test('9g. Paste button without clipboard permission explains Ctrl/Cmd+V', async () => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  // Headless Chromium leaves an unpermitted read pending instead of refusing it,
  // so act like a browser where the person said no.
  await context.addInitScript(() => {
    navigator.clipboard.readText = () => Promise.reject(new DOMException('Read permission denied.', 'NotAllowedError'));
  });
  const { page } = await openApp({ context });
  await page.click('#emptyPasteBtn');
  await page.waitForFunction(() => document.getElementById('toastText').textContent.length > 0);
  const toast = await page.textContent('#toastText');
  assert(/Ctrl|⌘|paste with the keyboard|Tap and hold/i.test(toast), 'fallback message: ' + toast);
  assert(await page.inputValue('#editor') === '', 'editor unchanged when clipboard read is blocked');
  await context.close();
});

await test('9h. Preview localStorage survives reload and Restart; cannot read playground keys', async () => {
  const { context, page } = await openApp();
  // Saves 150 times per run, like a game or a form that saves on every keystroke.
  const doc = `<!DOCTYPE html><html><body>
<p id="out">empty</p>
<script>
  var n = Number(localStorage.getItem('count') || '0') + 1;
  for (var i = 1; i <= 150; i++) { localStorage.setItem('writes', String(i)); }
  localStorage.setItem('count', String(n));
  document.getElementById('out').textContent = 'count=' + n;
  document.body.dataset.parentProbe = String(localStorage.getItem('html-playground:v1:code'));
<\/script></body></html>`;
  // The sandboxed preview has its own origin, so read it through Playwright's frame.
  async function countAfter(action) {
    const before = await runs(page);
    await action();
    const frame = await previewFrame(page, 15000, before);
    await frame.waitForFunction(() => document.getElementById('out').textContent !== 'empty');
    await wait(500);  // let the batched save land
    return { frame, text: await frame.textContent('#out') };
  }
  let r = await countAfter(() => setCode(page, doc));
  assert(r.text === 'count=1', 'first run sets count: ' + r.text);
  assert(await r.frame.evaluate(() => document.body.dataset.parentProbe) === 'null', 'no access to playground storage keys');

  await page.reload();
  let frame = await previewFrame(page, 15000);  // a reload clears the run counter, so take the first preview
  await frame.waitForFunction(() => document.getElementById('out').textContent !== 'empty');
  assert(await frame.textContent('#out') === 'count=2', 'reload keeps count: ' + await frame.textContent('#out'));
  assert(await frame.evaluate(() => localStorage.getItem('writes')) === '150', 'every save is kept, not just the first few');
  await page.evaluate(() => {
    window.__runs = 0;
    new MutationObserver((records) => {
      for (const rec of records) { for (const n of rec.addedNodes) { if (n.tagName === 'IFRAME') { window.__runs += 1; } } }
    }).observe(document.getElementById('frameHost'), { childList: true });
  });
  await wait(500);

  r = await countAfter(() => page.click('#runBtn'));
  assert(r.text === 'count=3', 'Restart keeps count: ' + r.text);

  r = await countAfter(async () => { await page.click('#clearPreviewDataBtn'); await page.click('#confirmOk'); });
  assert(r.text === 'count=1', 'Clear preview data resets: ' + r.text);
  await context.close();
});

await test('9i. In-preview download attempt shows a notice', async () => {
  const { context, page } = await openApp();
  await setCode(page, `<!DOCTYPE html><body><a id="dl" download="x.txt" href="data:text/plain,hi">Save</a>
<script>document.getElementById('dl').click();<\/script></body>`);
  await wait(1300);
  await previewFrame(page);
  await page.waitForSelector('#downloadBlockedBanner:not([hidden])', { timeout: 3000 });
  const toast = await page.textContent('#toastText');
  assert(/Downloads are turned off|Download above/i.test(toast), 'toast explains downloads: ' + toast);
  await context.close();
});

await test('9e. Paste button reads the clipboard; Undo restores the old code', async () => {
  const { context, page } = await openApp();
  await page.evaluate(() => navigator.clipboard.writeText('<!DOCTYPE html><h1 id="c">From clipboard</h1>'));
  await page.click('#emptyPasteBtn');
  let frame = await previewFrame(page);
  assert(await frame.textContent('#c') === 'From clipboard', 'empty-state paste button works');
  await page.evaluate(() => navigator.clipboard.writeText('<!DOCTYPE html><h1 id="c">Second</h1>'));
  const before = await runs(page);
  await page.click('#pasteBtn');
  frame = await previewFrame(page, 5000, before);
  assert(await frame.textContent('#c') === 'Second', 'toolbar paste replaces code');
  await page.click('#toastAction');
  assert((await page.inputValue('#editor')).includes('From clipboard'), 'undo restores previous');
  await context.close();
});

await test('10. Works from a plain static server and straight from disk (file://)', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.click('#emptySampleBtn');
  const frame = await previewFrame(page);
  await frame.click('#addBall');
  assert((await frame.textContent('#count')) === 'Balls: 4', 'sample interactive from file://');
  assert(errors.length === 0, 'no errors: ' + errors.join('; '));
  const res = await fetch(BASE + 'index.html');
  assert(res.ok, 'served by a plain static server');
  await context.close();
});

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results.map((r) => ({ name: r.name, ok: r.ok, ms: r.ms, error: r.error ? String(r.error.message || r.error) : undefined })), null, 2));
process.exit(failed.length ? 1 : 0);
