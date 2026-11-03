import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('parcours desktop : saisie détaillée, persistance, CSV, bordereau et dialogue accessible', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
  await page.getByRole('button', { name: 'Nouvelle recette', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle recette', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Libellé de l’écriture/).fill('Recettes journalières');
  await dialog.getByLabel('Référence de la pièce').fill('Bordereau F-1');
  await dialog.getByLabel('Observation', { exact: true }).fill('Contrôle navigateur');
  await dialog.getByRole('button', { name: 'Détail par postes' }).click();
  await dialog.getByLabel('Poste', { exact: true }).fill('CONSULTATION');
  await dialog.getByLabel('Référence / quittance').fill('Q-1');
  await dialog.getByLabel('Montant (Ar)', { exact: true }).fill('4000');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await dialog.getByLabel('Poste', { exact: true }).fill('PHARMACIE');
  await dialog.getByLabel('Montant (Ar)', { exact: true }).fill('6000');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  // Le focus reste dans la vraie boîte de dialogue native.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Recettes journalières', exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.locator('#journal').getByText('Recettes journalières', { exact: true }).first()).toBeVisible();
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
  expect(stocke.ecritures[0]).toMatchObject({ montant: 10000, mode: 'Espèces', reference: 'Bordereau F-1', observation: 'Contrôle navigateur' });
  expect(stocke.ecritures[0].lignesDetail[0].reference).toBe('Q-1');

  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter CSV' }).click();
  const csv = await readFile(await (await telechargement).path()!, 'utf8');
  const lignes = csv.replace(/^\uFEFF/, '').split('\r\n').map(l => l.split(';'));
  const debut = lignes.findIndex(l => l[0] === 'Date') + 2;
  const fin = lignes.findIndex(l => l[2] === 'TOTAUX DE LA PÉRIODE');
  const total = lignes.slice(debut, fin).reduce((s, l) => s + (Number(l[8]) || 0), 0);
  expect(total).toBe(10000);
  expect(csv).toContain('Q-1');

  await page.getByRole('button', { name: /^Bordereau RC-/ }).click();
  const bordereau = page.getByRole('dialog', { name: 'Bordereau imprimable' });
  await expect(bordereau.getByText('Total des recettes', { exact: true })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-bordereau')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  await expect(bordereau).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await bordereau.getByRole('button', { name: 'Fermer', exact: true }).click();

  // Fermer un formulaire modifié demande confirmation.
  await page.getByRole('button', { name: 'Nouvelle dépense', exact: true }).click();
  const depense = page.getByRole('dialog', { name: 'Nouvelle dépense', exact: true });
  await depense.getByLabel(/Libellé de l’écriture/).fill('Brouillon');
  await page.keyboard.press('Escape');
  const abandon = page.getByRole('dialog', { name: 'Abandonner la saisie ?' });
  await expect(abandon).toBeVisible();
  await abandon.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(depense.getByLabel(/Libellé de l’écriture/)).toHaveValue('Brouillon');
  expect(erreurs).toEqual([]);
});

test('mobile : aucun débordement de page et saisie utilisable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Nouvelle recette', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle recette', exact: true });
  await expect(dialog).toBeVisible();
  const boite = await dialog.boundingBox();
  expect(boite!.width).toBeLessThanOrEqual(390);
  await dialog.getByLabel(/Libellé de l’écriture/).fill('Recette mobile');
  await dialog.getByLabel(/Montant total/).fill('2500');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Recette mobile', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('deux onglets : les numéros restent uniques après actualisation inter-onglets', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/'); await b.goto('/');
  for (const [page, libelle] of [[a, 'Onglet A'], [b, 'Onglet B']] as const) {
    await page.getByRole('button', { name: 'Nouvelle recette', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouvelle recette', exact: true });
    await dialog.getByLabel(/Libellé de l’écriture/).fill(libelle);
    await dialog.getByLabel(/Montant total/).fill('1000');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await a.reload();
  const stocke = await a.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
  expect(stocke.ecritures).toHaveLength(2);
  expect(new Set(stocke.ecritures.map((e: { numero: string }) => e.numero)).size).toBe(2);
});
