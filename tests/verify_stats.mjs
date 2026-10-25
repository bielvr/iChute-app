import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = 'http://localhost:5173';

async function verifyStats() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'bielvieirarocha@gmail.com');
  await page.type('input[type="password"]', 'iChute');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  await page.goto(`${APP_URL}/leagues/2/stats`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('section', { timeout: 10000 });
  const text = await page.evaluate(() => document.body.innerText);

  console.log('Contains Hall da Fama?', text.includes('Hall da Fama'));
  console.log('Contains Diferença na Tabela?', text.includes('Diferença na Tabela'));
  console.log('Contains Melhores por Rodada?', text.includes('Melhores por Rodada'));

  const highlights = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('section:first-of-type .bg-\\[\\#1A1C3A\\]'));
    return cards.map(c => c.innerText.replace(/\n+/g, ' | '));
  });
  console.log('Highlight cards:', highlights);

  await browser.close();
}

verifyStats().catch(console.error);
