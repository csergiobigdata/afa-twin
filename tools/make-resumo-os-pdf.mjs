import { chromium } from "./node_modules/playwright/index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "..", "docs", "manual", "resumo-os.html");
const outPath = path.resolve(__dirname, "..", "docs", "AFA-TWIN-Resumo-Ordem-de-Servico.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });

await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
});

await browser.close();
console.log("PDF gerado em:", outPath);
