import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:5173";
const OUT = "shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 450);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? false });
  console.log("captured:", name);
}

async function clickText(text, tag = "button") {
  await page.locator(`${tag}:has-text("${text}")`).first().click();
}

try {
  // 1. Login
  await page.goto(`${BASE}/login`);
  await shot("01-login");

  await page.fill("#username", "gestor");
  await page.fill("#password", "AfaTwin@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  await shot("02-painel", { wait: 900 });

  // scroll to chart
  await page.mouse.wheel(0, 900);
  await shot("03-painel-grafico");
  await page.mouse.wheel(0, -900);

  // 2. Aeronaves - Cadastro (list)
  await page.goto(`${BASE}/aeronaves/cadastro`);
  await shot("04-aeronaves-cadastro");

  // 3. Aeronaves - Pesquisa
  await page.goto(`${BASE}/aeronaves/pesquisa`);
  await shot("05-aeronaves-pesquisa");

  // 4. Aircraft detail - find FAB 4824 (F-5EM, interesting data) link
  await page.goto(`${BASE}/aeronaves/cadastro`);
  await page.waitForTimeout(600);
  await page.locator('a:has-text("FAB 4824")').first().click();
  await page.waitForTimeout(700);
  await shot("06-aeronave-detalhe-geral");

  await clickText("Componentes (");
  await shot("07-aeronave-componentes");

  await clickText("Confiabilidade & Risco");
  await shot("08-aeronave-confiabilidade-risco", { wait: 700 });

  await clickText("Inspeção Fotográfica");
  await shot("09-aeronave-inspecao-fotografica");

  await clickText("Pessoal (");
  await shot("10-aeronave-pessoal-grupos");

  // 5. Nova aeronave (form)
  await page.goto(`${BASE}/aeronaves/novo`);
  await shot("11-aeronave-novo-formulario", { fullPage: true });

  // 6. Manutenção - Ordem de Serviço
  await page.goto(`${BASE}/manutencao/ordens`);
  await shot("12-manutencao-os-lista");

  // open one OS
  await page.locator('a:has-text("OS-2026")').first().click();
  await page.waitForTimeout(600);
  await shot("13-manutencao-os-detalhe", { fullPage: true });

  // 7. Manutenção - Cadastro de Manutenção
  await page.goto(`${BASE}/manutencao/cadastro`);
  await shot("14-manutencao-cadastro");

  // 8. Diagnóstico - run a search
  await page.goto(`${BASE}/diagnostico`);
  await page.waitForTimeout(400);
  await page.locator('button:has-text("A luz FUEL PRESS")').first().click();
  await page.locator('button:has-text("Pesquisar ocorrências")').first().click();
  await page.waitForTimeout(800);
  await shot("15-diagnostico-resultado", { fullPage: true });

  // 9. Planejamento
  await page.goto(`${BASE}/planejamento`);
  await shot("16-planejamento", { wait: 900 });

  // 10. Protocolos
  await page.goto(`${BASE}/protocolos`);
  await shot("17-protocolos");

  // 11. Usuários
  await page.goto(`${BASE}/pessoal/usuarios`);
  await page.waitForTimeout(500);
  await shot("18-usuarios-lista");

  await page.locator('button:has-text("✎ Editar")').first().click();
  await page.waitForTimeout(500);
  await shot("19-usuarios-editar", { fullPage: true });

  // 12. Grupos
  await page.goto(`${BASE}/pessoal/grupos`);
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Gerenciar")').first().click();
  await page.waitForTimeout(400);
  await shot("20-usuarios-grupos", { fullPage: true });

  // 13. Cadastros auxiliares
  await page.goto(`${BASE}/pessoal/cadastros`);
  await shot("21-cadastros-auxiliares");

  // 14. Meu perfil
  await page.goto(`${BASE}/perfil`);
  await shot("22-meu-perfil");

  // 15. Auditoria
  await page.goto(`${BASE}/auditoria`);
  await page.waitForTimeout(500);
  await shot("23-auditoria");

  // 16. Tablet-ish view of dashboard (bottom nav)
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  await shot("24-painel-tablet");

} catch (err) {
  console.error("ERROR during capture:", err);
} finally {
  await browser.close();
}
