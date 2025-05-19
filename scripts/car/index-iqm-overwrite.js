import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* ────── carga .env desde la raíz del proyecto ────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const wait = (ms) => new Promise(res => setTimeout(res, ms));

/* ────── lista completa de assets ────── */
const assetUrls = [
  "https://blockinar.io/things/asset-info?core_id=Qqkw4QTHKXA03PhfuiHI&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=LBOxYd3kwznY1S0YszF7&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=WSSW6biSLwfDhXsxpYlY&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=lVl6m2JrnjEH4iHlrKXe&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=mqpImzWSxjywdrfhwJWO&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=u2ROFIMf1rGjlyV8oe2O&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=XkWN5oJSSCoTsHDF00OM&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=DD5vUyxAR16rblA2jyk4&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=Xmvx2RkQMHffKhdKmL9W&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=H5YhLrngrHuHIgnp7oUY&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=e3uhXIJ7Ey6zOHsROJBR&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=FMsAQ7qgpQF9CwlwrTMc&tab=dashboard"
];

/* ────── scraping de un asset ────── */
const scrapeAsset = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForSelector('.cartridge-card', { timeout: 60000 });

  await page.getByRole('button', { name: 'iQM CORRECTIVE ACTION REPORTS', exact: true }).click();
  await page.waitForSelector('table thead', { timeout: 30000 });

  await page.evaluate(() => {
    const container = document.querySelector('table')?.parentElement;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  });
  await wait(3000);

  /* extrae filas + cabeceras */
  const rows = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return [];

    const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
      th.innerText.trim().toUpperCase().replace(/\s+/g, '_')
    );

    const dataRows = Array.from(table.querySelectorAll('tbody tr'));
    return dataRows.map(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
      const entry = {};
      headers.forEach((h, i) => { entry[h] = cells[i] || 'N/A'; });
      return entry;
    });
  });

  /* extrae metadatos (nombre, ubicación, serial) */
  const meta = await page.evaluate(() => {
    const record = {};
    const name = document.querySelector('.gateway-title')?.innerText?.trim();
    if (name) record.assetName = name;

    const location = document.querySelector('.asset-info-container .layout-route')?.innerText?.trim();
    if (location) record.cartridgeLocation = location;

    const spans = Array.from(document.querySelectorAll('span'));
    const serialSpans = spans.filter(span =>
      span.innerText?.trim().startsWith('Serial Number:')
    );
    if (serialSpans.length >= 2) {
      record.serialNumber = serialSpans[1].innerText
        .replace('Serial Number:', '')
        .trim()
        .replace(/"/g, '');
    }
    return record;
  });

  return rows.map(row => ({
    ...meta,
    ...row,
    timestamp: new Date().toISOString()
  }));
};

/* ────── login a Blockinar ────── */
const login = async (page) => {
  console.log('🌐 Abriendo página de login...');
  await page.goto('https://blockinar.io/auth/login', { waitUntil: 'domcontentloaded', timeout: 0 });

  console.log('✍️ Click en "Sign in with email"...');
  await page.getByText('Sign in with email', { exact: true }).click();

  console.log('📧 Completando email...');
  await page.locator('input[type="email"]').fill(process.env.BLOCKINAR_EMAIL);

  console.log('➡️ Click en "NEXT"...');
  await page.getByRole('button', { name: 'NEXT' }).click();

  console.log('🔒 Completando contraseña...');
  await page.locator('input[type="password"]').fill(process.env.BLOCKINAR_PASSWORD);

  console.log('🔐 Click en "SIGN IN"...');
  await page.getByRole('button', { name: 'SIGN IN' }).click();

  console.log('🛜 Esperando número de Assets en el dashboard...');
  await page.waitForSelector('div.total-number span', { timeout: 60000 });

  console.log('✅ Login exitoso!');
};

/* ────── flujo principal ────── */
const scrapeAllAssets = async () => {
  const loopId = new Date().toISOString();
  console.log(`🚀 Iniciando scraping de ${assetUrls.length} assets: ${loopId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);

    const outDir  = path.resolve(__dirname, 'data');
    const outFile = path.join(outDir, 'iqm-corrective-action.ndjson');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, '');               // limpia en cada loop

    for (const url of assetUrls) {
      try {
        console.log(`📄 Scrapeando asset: ${url}`);
        const records = await scrapeAsset(page, url);
        for (const r of records) {
          fs.appendFileSync(outFile, JSON.stringify({ loopId, ...r }) + '\n');
        }
        console.log(`✅ ${records.length} registros guardados`);
      } catch (err) {
        console.error(`❌ Error con asset: ${url}, ${err.message}`);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('❌ Error general:', err.message);
    await browser.close();
  }
};

scrapeAllAssets();

