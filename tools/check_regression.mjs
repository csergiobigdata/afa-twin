import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errors = [];
page.on('response', res => { if (res.status() >= 400) errors.push(res.status() + ' ' + res.url()); });

await page.goto('https://afa-twin.netlify.app/login', { waitUntil: 'networkidle' });
await page.fill('#username', 'gestor');
await page.fill('#password', 'AfaTwin@2026');
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

await page.goto('https://afa-twin.netlify.app/aeronaves/1/editar', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const text = await page.locator('body').innerText();
console.log('Tem "kcas"?', text.includes('kcas'));
console.log('Tem "Altitude (pés)"?', text.includes('Altitude (pés)'));
console.log('Tem "Milhas Náuticas"?', text.includes('Milhas Náuticas'));
console.log('Tem "km/h"?', text.includes('km/h'));
await page.screenshot({ path: 'regr_form.png', fullPage: false });

console.log('ISSUES:', JSON.stringify(errors));
await browser.close();
