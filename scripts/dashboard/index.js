// index.js  (añade / reemplaza las líneas de dotenv)
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// ruta del directorio actual del script
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// carga el .env que vive dos niveles arriba:  ../../.env
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

// -- resto de tu código —

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const generateChart = () => {
  return new Promise((resolve, reject) => {
    console.log('📊 Generando gráfico con los datos actualizados...');
    exec('node generateChart.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error al generar el gráfico: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`⚠️ Advertencias al generar el gráfico: ${stderr}`);
      }
      console.log(stdout);
      console.log('✅ Gráfico generado correctamente');
      resolve();
    });
  });
};

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

const scrapeAsset = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForSelector('.cartridge-card', { timeout: 60000 });

  const data = await page.evaluate(() => {
    const record = {};

    const name = document.querySelector('.gateway-title')?.innerText?.trim();
    if (name) record.assetName = name;

    const location = document.querySelector('.asset-info-container .layout-route')?.innerText?.trim();
    if (location) record.cartridgeLocation = location;

    // Buscar el segundo número de serie
    const infoSpans = Array.from(document.querySelectorAll('span'));
    const serialSpans = infoSpans.filter(span =>
      span.innerText?.trim().startsWith('Serial Number:')
    );
    if (serialSpans.length >= 2) {
      record.serialNumber = serialSpans[1].innerText
        .replace('Serial Number:', '')
        .trim()
        .replace(/"/g, '');
    }

    const cards = Array.from(document.querySelectorAll('.cartridge-card'));
    cards.forEach(card => {
      const title = card.querySelector('.cartridge-card-title')?.innerText?.trim();
      const value = card.querySelector('.cartridge-value')?.innerText?.trim();

      if (!title || !value) return;

      if (title === 'EFFECTIVE TESTS' && /^\d+$/.test(value)) {
        record['EFFECTIVE TESTS'] = value;
      }

      if (title === 'ONBOARD DAYS' && /^\d+$/.test(value)) {
        record['ONBOARD DAYS'] = value;
      }

      if (title === 'ONBOARD STABILITY' && /^\d+$/.test(value)) {
        record['ONBOARD STABILITY'] = value;
      }

      if (title === 'LAST INSERTION') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const dd = String(date.getDate()).padStart(2, '0');
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yyyy = date.getFullYear();
          record['LAST INSERTION'] = `${dd}-${mm}-${yyyy}`;
        }
      }
    });

    return record;
  });

  return data;
};

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

const scrapeAllAssets = async () => {
  const loopId = new Date().toISOString();
  console.log(`🚀 Iniciando scraping de ${assetUrls.length} assets: ${loopId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);

    const outputPath = path.join(__dirname, 'data', 'dashboard-history.ndjson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const records = [];

    for (const url of assetUrls) {
      try {
        console.log(`📄 Scrapeando asset: ${url}`);
        const record = await scrapeAsset(page, url);
        if (record['EFFECTIVE TESTS']) {
          records.push({
            loopId,
            timestamp: loopId,
            ...record
          });

          console.log(`✅ Scrapeado: ${record.assetName}`);
          console.log(`   📌 EFFECTIVE TESTS: ${record['EFFECTIVE TESTS']}`);
          console.log(`   📌 ONBOARD DAYS: ${record['ONBOARD DAYS'] ?? 'N/A'}`);
          console.log(`   📌 ONBOARD STABILITY: ${record['ONBOARD STABILITY'] ?? 'N/A'}`);
          console.log(`   📌 LAST INSERTION: ${record['LAST INSERTION'] ?? 'N/A'}`);
          console.log(`   🆔 SERIAL NUMBER: ${record.serialNumber ?? 'N/A'}`);
          console.log(`   🗺️ UBICACIÓN: ${record.cartridgeLocation ?? 'N/A'}`);
        } else {
          console.warn(`⚠️ Sin datos de EFFECTIVE TESTS para ${record.assetName}`);
        }
      } catch (err) {
        console.error(`❌ Error con asset: ${url}, ${err.message}`);
      }
    }

    for (const r of records) {
      fs.appendFileSync(outputPath, JSON.stringify(r) + '\n');
    }

    await browser.close();
  } catch (err) {
    console.error('❌ Error general:', err.message);
    await browser.close();
  }
};

const main = async () => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-AR', { hour12: false });

  console.log(`\n⌛ Ejecutando scraping a las ${timeStr}...\n`);
  await scrapeAllAssets();

  try {
    await generateChart();
  } catch (error) {
    console.error('❌ Error al generar el gráfico:', error);
  }
};

// Ejecutar una sola vez
main();
