import fs from 'fs';
import readline from 'readline';

const filePath = './data/dashboard-history.ndjson';

const parseLine = (line) => {
  try {
    const obj = JSON.parse(line);
    const effectiveTestMatch = obj["EFFECTIVE TESTS"]?.match(/\d+/);
    const location = obj.cartridgeLocation?.split('/')[0]?.trim();
    return {
      timestamp: obj.timestamp,
      assetName: obj.assetName,
      location,
      serialNumber: obj.serialNumber,
      effectiveTests: effectiveTestMatch ? parseInt(effectiveTestMatch[0]) : null
    };
  } catch (e) {
    return null;
  }
};

const groupByAssetAndDay = (data) => {
  const grouped = {};
  data.forEach(({ timestamp, assetName, effectiveTests, location, serialNumber }) => {
    const dateKey = timestamp.slice(0, 10); // YYYY-MM-DD
    if (!grouped[assetName]) grouped[assetName] = { location, recordsByDay: {} };
    const existing = grouped[assetName].recordsByDay[dateKey];
    if (!existing || timestamp > existing.timestamp) {
      grouped[assetName].recordsByDay[dateKey] = { timestamp, effectiveTests, serialNumber };
    }
  });

  // Convertimos a formato final
  const groupedFinal = {};
  for (const assetName in grouped) {
    const asset = grouped[assetName];
    groupedFinal[assetName] = {
      location: asset.location,
      records: Object.values(asset.recordsByDay)
    };
  }

  return groupedFinal;
};

const generateChartHTML = (groupedData) => {
  const allTimestamps = Array.from(
    new Set(Object.values(groupedData).flatMap(asset => asset.records.map(r => r.timestamp)))
  ).sort();

  const formattedLabels = allTimestamps.map(ts => {
    const date = new Date(ts);
    return new Date(date.getTime()).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  const timestampToIndex = Object.fromEntries(
    allTimestamps.map((ts, index) => [ts, index])
  );

  const datasets = Object.entries(groupedData).map(([assetName, assetData]) => {
    const data = new Array(formattedLabels.length).fill(null);
    const serials = new Array(formattedLabels.length).fill(null);
    assetData.records.forEach(record => {
      const index = timestampToIndex[record.timestamp];
      if (index !== undefined) {
        data[index] = record.effectiveTests;
        serials[index] = record.serialNumber || 'N/A';
      }
    });
    return {
      label: assetName + "\n" + (assetData.location || ''),
      data,
      serials,
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      showLine: true,
      spanGaps: true
    };
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Effective Tests Over Time</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    canvas { margin-bottom: 2rem; }
  </style>
</head>
<body>
  <canvas id="chart" width="1200" height="600"></canvas>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(formattedLabels)},
        datasets: ${JSON.stringify(datasets)}
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              generateLabels: (chart) => {
                return chart.data.datasets.map((dataset, i) => {
                  const labelLines = dataset.label.split("\\n");
                  return {
                    text: labelLines[0] + " (" + labelLines[1] + ")",
                    fillStyle: chart.data.datasets[i].borderColor,
                    strokeStyle: chart.data.datasets[i].borderColor,
                    lineWidth: 2,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i
                  };
                });
              }
            }
          },
          title: {
            display: true,
            text: 'Effective Tests por Asset (Horario Argentina GMT-3)'
          },
          tooltip: {
            callbacks: {
              afterLabel: function(context) {
                const serial = context.dataset.serials?.[context.dataIndex];
                return "Serial: " + (serial || "N/A");
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 90,
              minRotation: 45
            },
            title: {
              display: true,
              text: 'Hora (GMT-3 Argentina)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Effective Tests'
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;
};

const run = async () => {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const parsedData = [];
  for await (const line of rl) {
    const parsed = parseLine(line);
    if (parsed) parsedData.push(parsed);
  }

  const grouped = groupByAssetAndDay(parsedData);
  const html = generateChartHTML(grouped);
  fs.writeFileSync('effective-tests-chart.html', html);
  console.log('✅ Gráfico generado: effective-tests-chart.html');
};

run();

