import { expect, test, type Page } from '@playwright/test';

/**
 * L'ordre de virement remis à la banque est une demi-feuille A4. La feuille
 * porte deux fois le même ordre, séparés par un trait de découpe : la banque
 * reçoit une pièce complète et le dossier garde sa souche, quelle que soit la
 * moitié détachée.
 *
 * Ces vérifications portent sur la géométrie réelle de la feuille et sur le PDF
 * produit par Chromium : une régression de cote sortirait soit une page de plus,
 * soit un ordre tronqué au moment de la découpe.
 */

async function ouvrirSession(page: Page) {
  // Le compte et son RIB se règlent dans Administration, réservée à l'administrateur.
  await page.locator('#identifiant').fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
}

/** Le PDF généré par Chromium expose un objet /Page par page imprimée. */
function nombrePages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
}

function formatsPages(pdf: Buffer): number[][] {
  return [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)]
    .map(([, dimensions]) => dimensions.trim().split(/\s+/).map(Number));
}

/** Enregistre une DED par virement : son ordre de virement s'imprime aussitôt. */
async function ouvrirOrdreVirement(page: Page) {
  // L'impression native est neutralisée : le document reste monté pour la mesure.
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto('/?demo=0');
  await ouvrirSession(page);
  await page.getByRole('button', { name: 'Administration' }).click();
  const section = page.getByRole('region', { name: 'Comptes bancaires et RIB' });
  await section.getByRole('button', { name: 'Ajouter un compte' }).click();
  const compte = page.getByRole('dialog', { name: 'Ajouter un compte bancaire' });
  await compte.getByLabel('Banque').fill('BNI/C');
  await compte.getByLabel('Numéro de compte / RIB').fill('00005 12345678901');
  await compte.getByLabel(/Titulaire du compte/).fill('SALFA TOLIARA');
  await compte.getByLabel(/Adresse du titulaire/).fill('BP 99 Toliara');
  await compte.getByLabel(/Code banque du RIB/).fill('00005');
  await compte.getByRole('button', { name: 'Ajouter le compte' }).click();

  await page.getByRole('button', { name: 'Livre des virements' }).click();
  await page.getByRole('button', { name: /Nouvelle DED/ }).click();
  const saisie = page.getByRole('dialog', { name: 'Nouvelle DED par virement' });
  await saisie.getByLabel('Libellé').fill('ACHAT OXYGENE');
  await saisie.getByLabel('Tiers / bénéficiaire').fill('SOCIETE OXYGENE MADA');
  await saisie.getByLabel(/Établissement bancaire du bénéficiaire/).fill('BOA');
  await saisie.getByLabel('Montant (Ar)').fill('5000');
  await saisie.getByRole('button', { name: 'Enregistrer' }).click();

  await page.emulateMedia({ media: 'print' });
  const feuille = page.locator('.print-ordre-virement .ordre-virement-feuille');
  await expect(feuille).toBeVisible();
  return feuille;
}

test('imprime l’ordre de virement sur une seule A4, en deux moitiés égales', async ({ page }, info) => {
  const feuille = await ouvrirOrdreVirement(page);
  const mesures = await feuille.evaluate(el => {
    const mm = (px: number) => px * 25.4 / 96;
    const r = el.getBoundingClientRect();
    const moities = [...el.querySelectorAll('.ordre-virement-feuille__moitie')]
      .map(m => mm(m.getBoundingClientRect().height));
    const ordres = [...el.querySelectorAll('.ordre-virement')] as HTMLElement[];
    return {
      largeur: mm(r.width),
      hauteur: mm(r.height),
      moities,
      // Débordement interne de chaque ordre : aucun contenu ne doit être masqué.
      debordements: ordres.map(ordre => ordre.scrollHeight - ordre.clientHeight),
      // Débordement interne de chaque bande à cote fixe : le contenu doit tenir.
      debordementBandes: ordres.map(ordre => [...ordre.querySelectorAll<HTMLElement>(
        '.ordre-virement__entete, .ordre-virement__beneficiaire, .ordre-virement__total, .ordre-virement__date',
      )].map(bande => bande.scrollHeight - bande.clientHeight)).flat(),
      // Bas du second ordre par rapport au haut de la feuille.
      basSecondOrdre: mm(ordres[1].getBoundingClientRect().bottom - r.top),
      basSignatures: mm(ordres[1].querySelector('.ordre-virement__date')!.getBoundingClientRect().bottom - r.top),
    };
  });

  expect(mesures.largeur).toBeCloseTo(210, 0);
  expect(mesures.hauteur).toBeCloseTo(297, 0);
  // Deux moitiés égales de 135 mm, environ une demi-feuille A4 chacune.
  expect(mesures.moities).toHaveLength(2);
  for (const hauteur of mesures.moities) expect(hauteur).toBeCloseTo(135, 0);
  for (const debordement of mesures.debordements) expect(debordement).toBeLessThanOrEqual(1);
  // Aucune bande à cote fixe n'est tronquée : son contenu tient dans sa cote.
  expect(mesures.debordementBandes).toHaveLength(8);
  for (const debordement of mesures.debordementBandes) expect(debordement).toBeLessThanOrEqual(1);
  // Le second ordre est entièrement contenu dans la feuille, avec une marge.
  expect(mesures.basSecondOrdre).toBeLessThanOrEqual(297);
  expect(mesures.basSignatures).toBeLessThanOrEqual(295);

  // Deux exemplaires identiques : la banque et la souche portent le même ordre.
  await expect(feuille.locator('.ordre-virement')).toHaveCount(2);
  await expect(feuille).toContainText('EXEMPLAIRE BANQUE');
  await expect(feuille).toContainText('SOUCHE — à conserver');
  await expect(feuille.locator('.ordre-virement__piece').first()).toHaveText(/Pièce VD-\d{4}-0001/);
  await expect(feuille).toContainText('cinq mille Ariary');
  await expect(feuille).toContainText('5 000,00');

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await info.attach('ordre-virement.pdf', { body: pdf, contentType: 'application/pdf' });
  expect(nombrePages(pdf)).toBe(1);
  for (const [, , largeur, hauteur] of formatsPages(pdf)) expect(largeur).toBeLessThan(hauteur);
});

test('le registre retrouve son affichage à l’écran après l’impression', async ({ page }) => {
  await ouvrirOrdreVirement(page);
  // L'ordre reste monté tant que le navigateur n'a pas signalé la fin.
  await expect(page.locator('.print-ordre-virement')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-ordre-virement')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/has-print-ordre-virement/);
  // Le registre est de nouveau visible et l'ordre reste réimprimable.
  await expect(page.getByRole('heading', { name: /virement/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Imprimer l’ordre de virement VD-/ })).toBeVisible();
});
