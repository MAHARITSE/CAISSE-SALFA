import { expect, test, type Page } from '@playwright/test';

async function ouvrirSession(page: Page) {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto('/?demo=0');
  await page.locator('#identifiant').fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
}

async function verifierRoulettePage(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(150, 540);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test('la roulette fonctionne dans la saisie puis sur la page après un abandon confirmé', async ({ page }) => {
  await ouvrirSession(page);
  const overflowInitial = await page.locator('body').evaluate(el => el.style.overflow);
  await verifierRoulettePage(page);

  for (const sens of ['recette', 'dépense']) {
    await page.getByRole('button', { name: `Nouvelle ${sens}`, exact: true }).click();
    const saisie = page.getByRole('dialog', { name: `Nouvelle ${sens}`, exact: true });
    await saisie.getByLabel(/Libellé de l’écriture/).fill('Brouillon à abandonner');
    const zone = saisie.locator('.overflow-y-auto').first();
    await zone.evaluate(el => { el.scrollTop = 0; });
    await zone.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => zone.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    // Annuler la confirmation ne doit pas libérer l'arrière-plan.
    await page.keyboard.press('Escape');
    const confirmation = page.getByRole('dialog', { name: 'Abandonner la saisie ?' });
    await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(saisie).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    // Confirmer démonte les deux fenêtres ensemble : cas qui laissait hidden.
    await page.keyboard.press('Escape');
    await confirmation.getByRole('button', { name: 'Abandonner les modifications' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await page.locator('body').evaluate(el => el.style.overflow)).toBe(overflowInitial);
    await verifierRoulettePage(page);
  }
});

test('fermer la gestion des catégories ne débloque la page qu’après fermeture de la saisie', async ({ page }) => {
  await ouvrirSession(page);
  await page.getByRole('button', { name: 'Nouvelle recette', exact: true }).click();
  const saisie = page.getByRole('dialog', { name: 'Nouvelle recette', exact: true });
  await saisie.getByRole('button', { name: 'Gérer', exact: true }).click();
  const categories = page.getByRole('dialog', { name: 'Catégories de saisie' });
  const zone = categories.locator('.overflow-y-auto').first();
  await zone.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => zone.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await categories.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(saisie).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await saisie.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await verifierRoulettePage(page);
});
