// Screenshots of the tutor and student screens at the widths we design for, plus two numbers
// per screen: how far the page overflows sideways (should be 0) and how big the board is.
// Start the app on :8080 first, then: node scripts/responsive-shots.mjs [out-dir]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const out = process.argv[2] || 'shots';
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: '320', width: 320, height: 640, touch: true },
  { name: '393', width: 393, height: 852, touch: true },
  { name: '430', width: 430, height: 932, touch: true },
  { name: '768', width: 768, height: 1024, touch: true },
  { name: '1024', width: 1024, height: 768, touch: true },
  { name: '1440', width: 1440, height: 900, touch: false },
];

const measure = (page) =>
  page.evaluate(() => {
    const board = document.querySelector('[style*=aspect-ratio]')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
      board: board ? `${Math.round(board.width)}x${Math.round(board.height)}` : 'none',
    };
  });

const browser = await chromium.launch();
const report = [];
for (const size of SIZES) {
  const options = { viewport: { width: size.width, height: size.height }, isMobile: size.touch, hasTouch: size.touch };
  const tutorContext = await browser.newContext(options);
  const tutor = await tutorContext.newPage();
  await tutor.goto(`${BASE}/whiteboard`);
  await tutor.getByRole('button', { name: 'Start a session' }).click();
  await tutor.waitForFunction(() => /Code\s*\d{4}/.test(document.body.innerText));
  const code = await tutor.evaluate(() => document.body.innerText.match(/Code\s*(\d{4})/)[1]);
  const studentContext = await browser.newContext(options);
  const student = await studentContext.newPage();
  await student.goto(`${BASE}/whiteboard/${code}`);
  await student.waitForTimeout(1500);
  for (const [role, page] of [['tutor', tutor], ['student', student]]) {
    await page.screenshot({ path: `${out}/${role}-${size.name}.png` });
    report.push({ role, width: size.width, ...(await measure(page)) });
  }
  await tutorContext.close();
  await studentContext.close();
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.table(report);
