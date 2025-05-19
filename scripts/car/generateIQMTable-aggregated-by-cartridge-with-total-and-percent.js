
import fs from 'fs';
import path from 'path';

const inputPath = path.resolve('data/iqm-corrective-action.ndjson');
const outputPath = path.resolve('iqm-corrective-action-summary-by-cartridge-total-percent.html');

const lines = fs.readFileSync(inputPath, 'utf-8').trim().split('\n');

const assets = {};
for (const line of lines) {
  const record = JSON.parse(line);
  const {
    assetName,
    cartridgeLocation,
    CARTRIDGE,
    EVENT,
    'CORRECTIVE_ACTION': ACTION,
    RESULT
  } = record;

  if (!assetName || !CARTRIDGE) continue;

  if (!assets[assetName]) {
    assets[assetName] = {
      location: cartridgeLocation,
      cartridges: {}
    };
  }

  if (!assets[assetName].cartridges[CARTRIDGE]) {
    assets[assetName].cartridges[CARTRIDGE] = {};
  }

  const key = JSON.stringify([EVENT, ACTION, RESULT]);
  if (!assets[assetName].cartridges[CARTRIDGE][key]) {
    assets[assetName].cartridges[CARTRIDGE][key] = 0;
  }
  assets[assetName].cartridges[CARTRIDGE][key]++;
}

let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Resumen de iQM Corrective Actions por Cartridge</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    h2 { color: #333; margin-top: 3rem; }
    h3 { color: #666; margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: center; }
    th { background-color: #eee; }
    td:first-child, th:first-child { text-align: left; }
    tfoot td { font-weight: bold; background-color: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Resumen de acciones correctivas por asset y cartridge</h1>
`;

for (const [asset, data] of Object.entries(assets)) {
  html += `<h2>${asset}</h2>`;
  html += `<h3>${data.location}</h3>`;

  for (const [cartridge, summaries] of Object.entries(data.cartridges)) {
    const total = Object.values(summaries).reduce((acc, val) => acc + val, 0);

    html += `<h3>Cartridge: ${cartridge}</h3>`;
    html += `<table>`;
    html += `<tr>
      <th>Evento</th>
      <th>Acción Correctiva</th>
      <th>Resultado</th>
      <th>Total</th>
      <th>%</th>
    </tr>`;

    for (const keyStr of Object.keys(summaries)) {
      const [EVENT, ACTION, RESULT] = JSON.parse(keyStr);
      const count = summaries[keyStr];
      const percent = Math.round((count / total) * 100);

      html += `<tr>
        <td>${EVENT ?? '-'}</td>
        <td>${ACTION ?? '-'}</td>
        <td>${RESULT ?? '-'}</td>
        <td><strong>${count}</strong></td>
        <td>${percent}%</td>
      </tr>`;
    }

    html += `<tfoot><tr><td colspan="5">Total registros de este cartridge: ${total}</td></tr></tfoot>`;
    html += `</table>`;
  }
}

html += `
</body>
</html>
`;

fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ Resumen agrupado por cartridge con totales y porcentajes generado en ${outputPath}`);
