import pw from '/home/devdevil/node_modules/playwright-core/index.js';
const { chromium } = pw;

const EXEC =
  '/home/devdevil/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';

const stub = () => {
  window.__speakLog = [];
  const count = () =>
    typeof window.__getShapeCount === 'function' ? window.__getShapeCount() : 0;
  class FakeUtt {
    constructor(t) {
      this.text = t;
    }
  }
  const fakeSynth = {
    speaking: false,
    speak(u) {
      this.speaking = true;
      window.__speakLog.push({ text: String(u.text).slice(0, 45), shapesAtSpeak: count() });
      setTimeout(() => {
        this.speaking = false;
        u.onend && u.onend();
      }, 100);
    },
    cancel() {
      this.speaking = false;
    },
    pause() {},
    resume() {},
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtt,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    value: fakeSynth,
    configurable: true,
  });
};

const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = (page) =>
  page.evaluate(() => ({
    speaks: window.__speakLog?.length ?? 0,
    shapes: typeof window.__getShapeCount === 'function' ? window.__getShapeCount() : 0,
    steps: document.querySelectorAll('aside ol li').length,
    paused: document.body.innerText.includes('Paused'),
    errorBanner:
      document.querySelector('[data-error-banner]')?.textContent?.trim() ?? '',
  }));

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.addInitScript(stub);

log('navigating…');
await page.goto('http://localhost:5173/session', { waitUntil: 'domcontentloaded' });
// chat-first empty state: fill the topic, then wait for the Start button to
// enable (it stays disabled until the socket connects).
await page.fill('input[placeholder="Teach me Binary Search from scratch…"]', 'Binary Search');
await page.waitForSelector('button:has-text("Start Learning"):not([disabled])', {
  timeout: 15000,
});
log('✓ connected to backend');

await page.click('button:has-text("Start Learning")');
log('▶ started lesson; polling…');

// poll up to ~160s for first 2 speaks
let interrupted = false;
let preInterruptSpeaks = 0;
for (let i = 0; i < 32; i++) {
  await wait(5000);
  const s = await snap(page);
  log(
    `  t+${(i + 1) * 5}s  speaks=${s.speaks} shapes=${s.shapes} steps=${s.steps} paused=${s.paused}` +
      (s.errorBanner ? `  ERROR="${s.errorBanner}"` : ''),
  );
  if (!interrupted && s.speaks >= 2) {
    preInterruptSpeaks = s.speaks;
    log('  → interrupting with typed question…');
    await page.fill(
      'input[placeholder="Type a question to interrupt…"]',
      'Why must the array be sorted?',
    );
    await page.click('button[title="Ask"]');
    interrupted = true;
  }
  if (interrupted && s.speaks > preInterruptSpeaks && !s.paused && i > 2) {
    log('  → interruption answered and resumed');
    break;
  }
  if (s.errorBanner) break;
}

const final = await page.evaluate(() => ({
  speaks: window.__speakLog ?? [],
  errorBanner: document.querySelector('[data-error-banner]')?.textContent?.trim() ?? '',
}));

log('\n=== RESULTS ===');
log('total speak events:', final.speaks.length);
final.speaks.forEach((s) => log(`  [shapes=${s.shapesAtSpeak}] ${s.text}`));

const badSync = final.speaks.filter((s) => s.shapesAtSpeak === 0);
log('\nSYNC INVARIANT (shapes present before each speech):');
log(
  final.speaks.length > 0 && badSync.length === 0
    ? `  ✓ all ${final.speaks.length} speeches had shapes already rendered`
    : `  ✗ ${badSync.length}/${final.speaks.length} speeches started with 0 shapes`,
);
log('interruption performed:', interrupted);
log('error banner:', final.errorBanner || '(none)');
log('console errors:', errors.length ? '\n  ' + errors.slice(0, 8).join('\n  ') : '(none)');

await page.screenshot({ path: '/tmp/teacher.png' });
log('screenshot -> /tmp/teacher.png');
await browser.close();
process.exit(0);
