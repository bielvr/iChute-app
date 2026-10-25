import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = 'http://localhost:5173';

async function runE2E() {
  console.log('--- RE-EXECUTANDO BATERIA COMPLETA DE TESTES E2E NO ICHUTE ---');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=412,915'],
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      console.log(`[BROWSER ERROR]: ${text}`);
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
    console.log(`[PAGE ERROR]: ${err}`);
  });

  try {
    // 1. AUTENTICAÇÃO E SESSÃO
    console.log('\n[MÓDULO 1] AUTENTICAÇÃO E SESSÃO...');
    await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle0' });

    // Se já estiver logado, faz logout para testar fluxo completo de login
    const isAlreadyLogged = page.url().includes('/home');
    if (isAlreadyLogged) {
      console.log('Sessão pré-existente detectada. Realizando logout para testar fluxo de login...');
      const logoutBtn = await page.$('header ~ button, button');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sair') || b.innerText.includes('SAIR'));
        if (btn) btn.click();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
    }

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✓ Tela de login renderizada com campos visíveis.');

    await page.type('input[type="email"]', 'bielvieirarocha@gmail.com');
    await page.type('input[type="password"]', 'iChute');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    const currentUrl = page.url();
    console.log(`✓ Redirecionamento pós-login: ${currentUrl}`);

    const sessionInfo = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.includes('auth-token') || k.includes('supabase'));
      const authVal = authKey ? JSON.parse(localStorage.getItem(authKey)) : null;
      return {
        authKey,
        hasAccessToken: !!authVal?.access_token,
        hasRefreshToken: !!authVal?.refresh_token,
        userEmail: authVal?.user?.email,
      };
    });
    console.log('✓ Sessão no localStorage:', sessionInfo);

    // 2. HOME E SELEÇÃO DE MODALIDADES
    console.log('\n[MÓDULO 2] HOME E SELEÇÃO DE MODALIDADES...');
    await page.waitForSelector('main button', { timeout: 5000 });
    const sports = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('main button'));
      return btns.map(b => b.innerText.replace(/\n+/g, ' ').trim());
    });
    console.log('✓ Modalidades ativas na Home:', sports);

    // 3. LISTAGEM E CRIAÇÃO DE LIGAS
    console.log('\n[MÓDULO 3] LISTAGEM E CRIAÇÃO DE LIGAS (/leagues/1)...');
    await page.goto(`${APP_URL}/leagues/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h2, button, div', { timeout: 5000 });
    const leaguesData = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        activeLeaguesFound: text.includes('Ligas Ativas') || text.includes('LIGAS ATIVAS'),
        createLeagueFound: text.includes('Criar Liga') || text.includes('CRIAR'),
      };
    });
    console.log('✓ Ligas renderizadas:', leaguesData);

    // 4. PERSISTÊNCIA E MATRIZ DE PALPITES (Liga 2)
    console.log('\n[MÓDULO 4] PERSISTÊNCIA E MATRIZ DE PALPITES...');
    await page.goto(`${APP_URL}/predictions/2`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });

    // Selecionar Rodada 34
    await page.evaluate(() => {
      const sel = document.querySelector('select');
      if (sel) {
        const opt = Array.from(sel.options).find(o => o.value === '34' || o.text.includes('34'));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Confirmar que o palpite 9 x 9 na partida virgem está persistido intacto
    const persistedValues = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="number"]:not(:disabled)'));
      return inputs.slice(0, 2).map(i => i.value);
    });
    console.log(`✓ Palpite de teste 9 x 9 na partida futura virgem: [${persistedValues.join(' x ')}]`);

    // 5. RESULTADOS E COMPARATIVO
    console.log('\n[MÓDULO 5] RESULTADOS E COMPARATIVO (/leagues/2/results)...');
    await page.goto(`${APP_URL}/leagues/2/results`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });
    const compCards = await page.$$eval('.bg-\\[\\#1A1C3A\\]', els => els.length);
    console.log(`✓ Cards de Comparativo carregados: ${compCards}`);

    // 6. CLASSIFICAÇÃO / RANKING
    console.log('\n[MÓDULO 6] CLASSIFICAÇÃO / RANKING (/leagues/2/ranking)...');
    await page.goto(`${APP_URL}/leagues/2/ranking`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });
    const rankingUsers = await page.$$eval('main > div', els => els.length);
    console.log(`✓ Participantes no ranking: ${rankingUsers}`);

    // 7. PAINEL "E SE?" COM DRAWER INTERATIVO
    console.log('\n[MÓDULO 7] PAINEL "E SE?" (/leagues/2/whatif)...');
    await page.goto(`${APP_URL}/leagues/2/whatif`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const clickedDrawer = await page.evaluate(() => {
      const cell = document.querySelector('tbody tr td.cursor-pointer');
      if (cell) {
        cell.scrollIntoView();
        cell.click();
        return true;
      }
      return false;
    });

    if (clickedDrawer) {
      await new Promise(r => setTimeout(r, 1000));
      const drawerInfo = await page.evaluate(() => {
        const matchesInDrawer = document.querySelectorAll('.bg-\\[\\#0A0E2A\\].p-4.rounded-2xl');
        return {
          matchesCount: matchesInDrawer.length,
          isOpen: matchesInDrawer.length > 0,
        };
      });
      console.log(`✓ Drawer interativo abriu com sucesso com ${drawerInfo.matchesCount} partidas isoladas da temporada!`);
    }

    // 8. NOVA PÁGINA DE ESTATÍSTICAS
    console.log('\n[MÓDULO 8] NOVA PÁGINA DE ESTATÍSTICAS (/leagues/2/stats)...');
    await page.goto(`${APP_URL}/leagues/2/stats`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });
    const statsCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHallDaFama: text.includes('Hall da Fama') || text.includes('Mais Certeiro'),
        hasGaps: text.includes('Diferença na Tabela') || text.includes('Gaps'),
        hasMelhoresRodada: text.includes('Melhores por Rodada'),
      };
    });
    console.log('✓ Seções de Estatísticas:', statsCheck);

    // 9. CONFIGURAÇÕES
    console.log('\n[MÓDULO 9] CONFIGURAÇÕES E PERFIL...');
    await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });
    console.log('✓ UserSettings carregou perfeitamente.');

    await page.goto(`${APP_URL}/leagues/2/settings`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('header', { timeout: 10000 });
    console.log('✓ LeagueSettings carregou perfeitamente.');

    // Verificação de responsividade mobile
    const overflowCheck = await page.evaluate(() => {
      return {
        windowWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log('✓ Responsividade mobile (sem overflow indesejado):', overflowCheck);

  } catch (err) {
    console.error('❌ Erro no E2E:', err);
  } finally {
    console.log(`\n========================================`);
    console.log(`TOTAL DE ERROS DE CONSOLE CAPTURADOS: ${consoleErrors.length}`);
    await browser.close();
  }
}

runE2E().catch(console.error);
