// scripts/dashboard/generateTable-fechas-corregidas.js
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Calcula __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Ruta al NDJSON que acaba de generar index.js
const dataFile = path.join(__dirname, 'data', 'dashboard-history.ndjson');
if (!fs.existsSync(dataFile)) {
  console.error(`❌ No existe el fichero de datos: ${dataFile}`);
  process.exit(1);
}

// Lee y parsea
const rawLines = fs.readFileSync(dataFile, 'utf-8')
                   .trim()
                   .split('\n')
                   .filter(Boolean);
const records = rawLines.map(line => JSON.parse(line));

// 1) Generar fecha/hora de reporte
const reportDate = new Date().toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires'
});

// Aquí va tu lógica para construir la tabla HTML…
const headerCols = [
  'timestamp',
  'assetName',
  'EFFECTIVE TESTS',
  'ONBOARD DAYS',
  'ONBOARD STABILITY',
  'LAST INSERTION',
  'serialNumber',
  'cartridgeLocation'
];
const rows = records.map(r =>
  `<tr>${headerCols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`
).join('\n');

const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Effective Tests Table</title>
</head>
<body>
  <!-- 2) Mostrar fecha/hora -->
  <p>🕒 Reporte generado: ${reportDate}</p>
  <h1>Effective Tests</h1>
  <table border="1">
    <thead>
      <tr>${headerCols.map(c => `<th>${c}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;

// Asegura que exista la carpeta donde vas a volcar la tabla
const outDir = path.join(__dirname, '..', '..', 'public', 'dashboard');
fs.mkdirSync(outDir, { recursive: true });

// Escribe el HTML final
fs.writeFileSync(
  path.join(outDir, 'effective-tests-table.html'),
  html,
  'utf-8'
);

console.log('✅ Tabla generada en public/dashboard/effective-tests-table.html');

