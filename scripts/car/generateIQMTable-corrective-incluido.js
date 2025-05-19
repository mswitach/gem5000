
import fs from 'fs';
import path from 'path';

const inputPath = path.resolve('data/iqm-corrective-action.ndjson');
const outputPath = path.resolve('iqm-corrective-action-table.html');

const lines = fs.readFileSync(inputPath, 'utf-8').trim().split('\n');

const assets = {};
for (const line of lines) {
  const record = JSON.parse(line);
  const {
    assetName,
    cartridgeLocation,
    timestamp,
    DATE,
    CARTRIDGE,
    EVENT,
    'CORRECTIVE_ACTION': ACTION,
    RESULT
  } = record;

  if (!assetName) continue;

  if (!assets[assetName]) {
    assets[assetName] = {
      location: cartridgeLocation,
      entries: [],
    };
  }

  assets[assetName].entries.push({
    timestamp,
    DATE,
    CARTRIDGE,
    EVENT,
    ACTION,
    RESULT
  });
}

let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de iQM Corrective Actions</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    h2 { color: #333; margin-top: 3rem; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: center; }
    th { background-color: #eee; }
    td:first-child, th:first-child { text-align: left; }
  </style>
</head>
<body>
  <h1>iQM Corrective Actions por asset</h1>
`;

for (const [asset, data] of Object.entries(assets)) {
  html += `<h2>${asset}</h2>`;
  html += `<h3>${data.location}</h3>`;
  html += `<table>`;
  html += `<tr><th>Fecha</th><th>Cartridge</th><th>Evento</th><th>Acción Correctiva</th><th>Resultado</th></tr>`;
  for (const row of data.entries) {
    html += `<tr>
      <td>${row.DATE ?? '-'}</td>
      <td>${row.CARTRIDGE ?? '-'}</td>
      <td>${row.EVENT ?? '-'}</td>
      <td>${row.ACTION ?? '-'}</td>
      <td>${row.RESULT ?? '-'}</td>
    </tr>`;
  }
  html += `</table>`;
}

html += `
</body>
</html>
`;

fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ Tabla generada en ${outputPath}`);
