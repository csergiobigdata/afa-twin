import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "..", "docs", "manual", "manual-usuario.html");
const outPath = path.resolve(__dirname, "..", "docs", "AFA-TWIN-Manual-do-Usuario.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });

// wait for all images to actually finish loading (file:// images can lag)
await page.evaluate(async () => {
  const imgs = Array.from(document.images);
  await Promise.all(
    imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })
    )
  );
});

await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
});

await browser.close();
console.log("PDF gerado em:", outPath);
