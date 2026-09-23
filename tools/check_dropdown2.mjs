import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
await page.goto('https://afa-twin.netlify.app/login', { waitUntil: 'networkidle' });
await page.fill('#username', 'gestor');
await page.fill('#password', 'AfaTwin@2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);
await page.goto('https://afa-twin.netlify.app/disponibilidade', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// O select "Código" do formulario Manual tem largura minWidth 90 e é o unico
// dentro do <form onSubmit=submitManual> antes do de "Configuração"
const manualCodeSelect = page.locator('form').filter({ hasText: 'Adicionar' }).locator('select').first();
console.log('opcoes:', JSON.stringify(await manualCodeSelect.locator('option').allTextContents()));
await page.screenshot({ path: 'dropdown_check.png', fullPage: true });
await browser.close();
