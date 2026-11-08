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

function formatsPages(pdf: Buffer): number[][] {
  return [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)]
    .map(([, dimensions]) => dimensions.trim().split(/\s+/).map(Number));
}

async function verifierDocumentNonTronque(page: Page) {
  const dimensions = await page.locator('.print-bordereau .bordereau-document').evaluate(feuille => {
    const signatures = feuille.querySelector('.bordereau-signatures')!;
    return {
      basFeuille: feuille.getBoundingClientRect().bottom,
      basSignatures: signatures.getBoundingClientRect().bottom,
      debordementFeuille: getComputedStyle(feuille).overflowY,
      debordementCorps: getComputedStyle(document.body).overflowY,
    };
  });
  expect(dimensions.basSignatures).toBeLessThanOrEqual(dimensions.basFeuille);
  expect(dimensions.debordementFeuille).toBe('visible');
  expect(dimensions.debordementCorps).toBe('visible');
}

async function ouvrirBordereau(page: Page, sens: 'dépense' | 'recette', postes: number) {
  // Le PDF est généré explicitement ci-dessous : l'impression native en mode
  // headless déclencherait afterprint et démonterait le document avant le test.
  await page.addInitScript(() => { window.print = () => {}; });
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
      await verifierDocumentNonTronque(page);
      const zoneLettres = await page.locator('.bordereau-document').evaluate(feuille => {
        const tableau = feuille.querySelector('.bordereau-table')!.getBoundingClientRect();
        const lettres = feuille.querySelector('.bordereau-lettres')!;
        const signatures = feuille.querySelector('.bordereau-signatures')!.getBoundingClientRect();
        const montant = lettres.querySelector('.bordereau-lettres__montant')!;
        return {
          espace: (signatures.top - tableau.bottom) * 25.4 / 96,
          hauteur: lettres.getBoundingClientRect().height * 25.4 / 96,
          graisse: getComputedStyle(montant).fontWeight,
          capitales: getComputedStyle(montant).textTransform,
          graisseIntroduction: getComputedStyle(lettres.querySelector('span')!).fontWeight,
          capitalesIntroduction: getComputedStyle(lettres.querySelector('span')!).textTransform,
        };
      });
      expect(zoneLettres.espace).toBeCloseTo(15, 1);
      expect(zoneLettres.hauteur).toBeCloseTo(15, 1);
      expect(zoneLettres.graisse).toBe('700');
      expect(zoneLettres.capitales).toBe('capitalize');
      expect(zoneLettres.graisseIntroduction).toBe('400');
      expect(zoneLettres.capitalesIntroduction).toBe('none');
      if (postes === 1) {
        const dimensions = await page.locator('.print-bordereau .bordereau-document').evaluate(feuille => ({
          corpsTableau: feuille.querySelector('tbody')!.getBoundingClientRect().height,
          basSignatures: feuille.querySelector('.bordereau-signatures')!.getBoundingClientRect().bottom - feuille.getBoundingClientRect().top,
        }));
        const pxParMm = 96 / 25.4;
        expect(dimensions.corpsTableau).toBeGreaterThanOrEqual(130 * pxParMm - 1);
        // Marge de 15 mm : 1 mm de sécurité + 14 mm de marge intérieure.
        expect(dimensions.basSignatures / pxParMm).toBeCloseTo(282, 0);
      }
      // Même si le dernier réglage du journal était paysage, le bordereau
      // impose son propre format pour l'ensemble des pages.
      const pdf = await page.pdf({ format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true });
      await info.attach('bordereau.pdf', { body: pdf, contentType: 'application/pdf' });
      expect(nombrePages(pdf)).toBe(1);
      expect(formatsPages(pdf)).not.toHaveLength(0);
      for (const [, , largeur, hauteur] of formatsPages(pdf)) expect(largeur).toBeLessThan(hauteur);
    });
  }
}

test('un bordereau long peut continuer sur plusieurs pages', async ({ page }, info) => {
  await ouvrirBordereau(page, 'dépense', 30);
  await verifierDocumentNonTronque(page);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  await info.attach('bordereau-long.pdf', { body: pdf, contentType: 'application/pdf' });
  expect(nombrePages(pdf)).toBeGreaterThan(1);
  for (const [, , largeur, hauteur] of formatsPages(pdf)) expect(largeur).toBeLessThan(hauteur);
});

// L'ancienne limite à 270 mm masquait les signatures de certaines pièces
// considérées comme « courtes ». Ne jamais supprimer du contenu pour tenir.
test('les 15 postes et les signatures restent entiers', async ({ page }) => {
  await ouvrirBordereau(page, 'dépense', 15);
  await verifierDocumentNonTronque(page);
});

test('le journal retrouve son format paysage après fermeture du bordereau', async ({ page }) => {
  await ouvrirBordereau(page, 'dépense', 1);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-bordereau')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/has-print-bordereau/);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(formatsPages(pdf)).not.toHaveLength(0);
  for (const [, , largeur, hauteur] of formatsPages(pdf)) expect(largeur).toBeGreaterThan(hauteur);
});
