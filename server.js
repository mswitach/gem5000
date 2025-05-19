import express from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

/* ────── Archivos estáticos ────── */
app.use(express.static(path.join(__dirname, "public")));

/* ────── Helper para ejecutar scripts ────── */
function run(cmd, cwd) {
  console.log("⏩ ejecutando:", cmd);
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, stdio: "inherit" }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr || error);
        return reject(stderr || error);
      }
      console.log("✅ terminó   :", cmd);
      resolve(stdout);
    });
  });
}

/* ────── Copiar salidas al directorio público ────── */
function moveFile(src, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = path.basename(src);
  fs.copyFileSync(src, path.join(destDir, fileName));
}

/* ────── DASHBOARD ────── */
app.get("/run-dashboard", async (req, res) => {
  console.log("▶︎ /run-dashboard HIT");
  try {
    /* auth opcional */
    if (process.env.CRON_KEY && req.query.key !== process.env.CRON_KEY) {
      return res.sendStatus(401);
    }

    const cwd = path.join(__dirname, "scripts", "dashboard");

    /* 1) Scraper Playwright */
    await run("node index.js", cwd);

    /* 2) Generador de tabla */
    await run("node generateTable-fechas-corregidas.js", cwd);

    /* 3) Copiar HTML al público */
    ["effective-tests-table.html", "effective-tests-chart.html"].forEach(f => {
      const src = path.join(cwd, f);
      if (fs.existsSync(src)) {
        moveFile(src, path.join(__dirname, "public", "dashboard"));
      }
    });

    res.type("text/plain").send("dashboard OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("dashboard FAIL");
  }
});

/* ────── CAR ────── */
app.get("/run-car", async (req, res) => {
  console.log("▶︎ /run-car HIT");
  try {
    if (process.env.CRON_KEY && req.query.key !== process.env.CRON_KEY) {
      return res.sendStatus(401);
    }

    const cwd = path.join(__dirname, "scripts", "car");

    await run("node index-iqm-overwrite.js", cwd);
    await run("node generateIQMTable-aggregated-by-cartridge-with-total-and-percent.js", cwd);
    await run("node generateIQMTable-corrective-incluido.js", cwd);

    ["iqm-corrective-action-summary-by-cartridge-total-percent.html",
     "iqm-corrective-action-table.html"].forEach(f => {
      const src = path.join(cwd, f);
      if (fs.existsSync(src)) {
        moveFile(src, path.join(__dirname, "public", "iqm"));
      }
    });

    res.type("text/plain").send("car OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("car FAIL");
  }
});

/* ────── Health check ────── */
app.get("/", (_req, res) => res.type("text/plain").send("alive"));

app.listen(PORT, "0.0.0.0", () => console.log(`Servidor en ${PORT}`));

