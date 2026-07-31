const { chromium } = require('playwright');
const path = require('path');

const FILE = process.argv[2] || 'Q01.html';
const OUT  = process.argv[3] || 'frames';
const DUR  = parseFloat(process.argv[4] || '10');   // seconds
const FPS  = parseInt(process.argv[5] || '25', 10);
const CONTACT = process.argv[6] === 'contact';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve(FILE));
  await page.waitForTimeout(300);

  // freeze CSS animations and scrub by setting negative delay
  const total = CONTACT ? 8 : Math.round(DUR * FPS);
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });

  for (let i = 0; i < total; i++) {
    const t = CONTACT ? (i * DUR / 8) : (i / FPS);
    await page.evaluate((t) => {
      document.querySelectorAll('.anim').forEach(el => {
        el.style.animationPlayState = 'paused';
        el.style.animationDelay = (-t) + 's';
      });
      // ambient loops too
      const c = document.getElementById('curtain');
      if (c) { c.style.animationPlayState = 'paused'; c.style.animationDelay = (-t) + 's'; }
    }, t);
    await page.waitForTimeout(12);
    const name = CONTACT
      ? `${OUT}/t${t.toFixed(2)}.png`
      : `${OUT}/f${String(i).padStart(4, '0')}.png`;
    await page.screenshot({ path: name });
  }
  await browser.close();
  console.log('frames written:', total);
})();
