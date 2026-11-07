import { expect, test, type Page } from '@playwright/test';

async function ouvrirSession(page: Page) {
  await page.locator('#identifiant').fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
}

/** Le PDF généré par Chromium expose un objet /Page par page imprimée. */
function nombrePages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
}

async function ouvrirBordereau(page: Page, sens: 'dépense' | 'recette', postes: number) {
  // Pas de jeu de démonstration : le bordereau ouvert est celui du test.
  await page.goto('/?demo=0');
  await ouvrirSession(page);
  await page.getByRole('button', { name: `Nouvelle ${sens}`, exact: true }).click();
  const saisie = page.getByRole('dialog', { name: `Nouvelle ${sens}` });
  await saisie.getByLabel(/Libellé de l’écriture/).fill('TEST IMPRESSION');
  await saisie.getByLabel(/Montant total/).fill(String(postes * 1000));
  await saisie.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  // Composer une pièce détaillée et un en-tête légèrement plus grand, puis
  // recharger pour passer par les mêmes validations que le livre enregistré.
  await page.evaluate(n => {
    const cle = 'salfa_tresorerie_livre_v2';
    const livre = JSON.parse(localStorage.getItem(cle)!);
    livre.ecritures[0].lignesDetail = Array.from({ length: n }, (_, i) => ({ id: `poste-${i}`, libelle: `POSTE ${String(i + 1).padStart(2, '0')}`, montant: 1000 }));
    livre.entetes.lignes[0].taille = 15;
    localStorage.setItem(cle, JSON.stringify(livre));
  }, postes);
  await page.reload();
  await ouvrirSession(page);
  await page.getByRole('button', { name: new RegExp(`^Imprimer le bordereau ${sens === 'dépense' ? 'DP' : 'RC'}-`) }).first().click();
  await expect(page.getByRole('dialog', { name: 'Bordereau imprimable' })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const feuille = page.locator('.print-bordereau .bordereau-document');
  await expect(feuille).toBeVisible();
  await expect(feuille.getByText(`POSTE ${String(postes).padStart(2, '0')}`, { exact: true })).toBeVisible();
  await expect(feuille.getByText('Médecin Chef')).toBeVisible();
}

for (const sens of ['dépense', 'recette'] as const) {
  for (const postes of [1, 12]) {
    test(`imprime la ${sens} avec ${postes} poste(s) sans page supplémentaire`, async ({ page }, info) => {
      await ouvrirBordereau(page, sens, postes);
      const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
      await info.attach('bordereau.pdf', { body: pdf, contentType: 'application/pdf' });
      expect(nombrePages(pdf)).toBe(1);
    });
  }
}

test('un bordereau long peut continuer sur plusieurs pages', async ({ page }, info) => {
  await ouvrirBordereau(page, 'dépense', 30);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  await info.attach('bordereau-long.pdf', { body: pdf, contentType: 'application/pdf' });
  expect(nombrePages(pdf)).toBeGreaterThan(1);
});
