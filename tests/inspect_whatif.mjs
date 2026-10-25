import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = 'http://localhost:5173';

async function inspectWhatIf() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  // Login
  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'bielvieirarocha@gmail.com');
  await page.type('input[type="password"]', 'iChute');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Ir para What-If Liga 2 (Brasileirão)
  console.log('Navegando para Liga 2 What-If...');
  await page.goto(`${APP_URL}/leagues/2/whatif`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });

  // Inspecionar células clicáveis
  const clickableCells = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('tbody tr td.cursor-pointer'));
    return cells.map(c => ({
      text: c.innerText,
      className: c.className,
    }));
  });

  console.log(`Encontradas ${clickableCells.length} células com cursor-pointer na Liga 2.`);
  if (clickableCells.length > 0) {
    console.log('Primeiras células clicáveis:', clickableCells.slice(0, 5));
    // Clicar na primeira
    const firstCell = await page.$('tbody tr td.cursor-pointer');
    await firstCell.click();
    await new Promise(r => setTimeout(r, 1000));

    const drawerData = await page.evaluate(() => {
      const drawer = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('Detalhamento'));
      const matches = document.querySelectorAll('.bg-\\[\\#0A0E2A\\].p-4.rounded-2xl');
      return {
        hasDrawer: !!drawer,
        matchesInDrawerCount: matches.length,
      };
    });
    console.log('Resultado ao abrir Drawer na Liga 2:', drawerData);
  }

  // Agora testar na Liga 1
  console.log('\nNavegando para Liga 1 What-If...');
  await page.goto(`${APP_URL}/leagues/1/whatif`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });

  const clickableCellsL1 = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('tbody tr td.cursor-pointer'));
    return cells.map(c => c.innerText);
  });
  console.log(`Encontradas ${clickableCellsL1.length} células com cursor-pointer na Liga 1.`);

  await browser.close();
}

inspectWhatIf().catch(console.error);
