import fs from 'fs';
import path from 'path';

const inputPath = path.resolve('data/dashboard-history.ndjson');
const outputPath = path.resolve('effective-tests-table.html');

const lines = fs.readFileSync(inputPath, 'utf-8').trim().split('\n');

const formatDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}`;
};

// Agrupar por assetName y día
const assets = {};
for (const line of lines) {
  const record = JSON.parse(line);
  const {
    assetName,
    cartridgeLocation,
    'EFFECTIVE TESTS': effectiveTests,
    'ONBOARD DAYS': onboardDays,
    'ONBOARD STABILITY': onboardStability,
    'LAST INSERTION': lastInsertion,
    serialNumber,
    timestamp,
  } = record;

  if (!assetName) continue;

  const dateKey = timestamp.slice(0, 10); // YYYY-MM-DD

  if (!assets[assetName]) {
    assets[assetName] = {
      location: cartridgeLocation,
      valuesByDay: {},
    };
  }

  const existing = assets[assetName].valuesByDay[dateKey];
  if (!existing || timestamp > existing.timestamp) {
    assets[assetName].valuesByDay[dateKey] = {
      timestamp,
      'EFFECTIVE TESTS': effectiveTests ?? 'N/A',
      'ONBOARD DAYS': onboardDays ?? 'N/A',
      'ONBOARD STABILITY': onboardStability ?? 'N/A',
      'LAST INSERTION': lastInsertion ?? 'N/A',
      'SERIAL NUMBER': serialNumber ?? 'N/A',
    };
  }
}

let html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Histórico de Valores</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    h2 { color: #333; margin-top: 3rem; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: center; }
    th { background-color: #eee; }
    td:first-child, th:first-child { text-align: left; }
    .highlight { color: red; font-weight: bold; }
    .na { color: blue; }
  </style>
</head>
<body>
  <h1>Histórico de valores por asset</h1>
`;

for (const [asset, data] of Object.entries(assets)) {
  const sortedDates = Object.keys(data.valuesByDay).sort();
  const formattedDates = sortedDates.map(formatDate);
  const firstSerialUse = new Set();
  const serialFirstUseDate = {};

  // Detectar la primera aparición de cada serialNumber
  for (const date of sortedDates) {
    const serial = data.valuesByDay[date]['SERIAL NUMBER'];
    if (serial !== 'N/A' && !firstSerialUse.has(serial)) {
      serialFirstUseDate[date] = serial;
      firstSerialUse.add(serial);
    }
  }

  html += `<h2>${asset}</h2>`;
  html += `<h3>${data.location}</h3>`;
  html += `<table>`;
  html += `<tr><th>Valores</th>${formattedDates.map(date => `<th>${date}</th>`).join('')}</tr>`;

  for (const key of ['EFFECTIVE TESTS', 'ONBOARD DAYS', 'ONBOARD STABILITY', 'LAST INSERTION', 'SERIAL NUMBER']) {
    html += `<tr><td>${key}</td>${sortedDates.map(date => {
      const val = data.valuesByDay[date][key];
      if (key === 'SERIAL NUMBER' && serialFirstUseDate[date] === val) {
        return `<td><span class="highlight" title="Cambio de cartridge">${val} 🔄</span></td>`;
      }
      if (val === 'N/A') {
        return `<td><span class="na">${val}</span></td>`;
      }
      return `<td>${val}</td>`;
    }).join('')}</tr>`;
  }

  html += `</table>`;
}

html += `
</body>
</html>
`;

fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ Tabla generada en ${outputPath}`);

