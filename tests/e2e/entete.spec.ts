import { expect, test, type Page } from '@playwright/test';

/** Dimensions relatives au coin de la feuille, sans l'échelle de l'aperçu. */
async function mesurer(page: Page, feuille: string, lignes: string, image: string) {
  return page.evaluate(({ feuille, lignes, image }) => {
    const racine = document.querySelector<HTMLElement>(feuille)!;
    const cadre = racine.getBoundingClientRect();
    const echelle = cadre.width / racine.offsetWidth;
    const position = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: (rect.x - cadre.x) / echelle, y: (rect.y - cadre.y) / echelle, width: rect.width / echelle, height: rect.height / echelle };
    };
    return {
      lignes: [...racine.querySelectorAll(lignes)].map(position),
      image: position(racine.querySelector(image)!),
    };
  }, { feuille, lignes, image });
}

function positionsProches(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  for (const cle of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(a[cle] - b[cle]), `${cle} : ${a[cle]} / ${b[cle]}`).toBeLessThan(1.5);
}

test('le bordereau reprend la casse, la mise en forme et les positions de l’éditeur', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => {}; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.locator('#identifiant').fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.getByRole('button', { name: 'Nouvelle dépense', exact: true }).click();
  const saisie = page.getByRole('dialog', { name: 'Nouvelle dépense' });
  await saisie.getByLabel(/Libellé de l’écriture/).fill('FRAIS');
  await saisie.getByLabel(/Montant total/).fill('10000');
  await saisie.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await page.getByRole('button', { name: 'Administration' }).click();
  await page.getByRole('button', { name: /En-tête des bordereaux/ }).click();
  const editeur = page.getByRole('dialog', { name: 'En-tête des bordereaux' });
  await editeur.getByLabel(/^Ligne 7/).click();
  await editeur.getByLabel('Texte de la ligne 7').fill('E-mail : Contact.Salfa@example.org');
  await editeur.getByLabel('Police').selectOption('Georgia');
  await editeur.getByLabel('Taille en points').fill('12.5');
  await editeur.getByRole('button', { name: 'Gras', exact: true }).click();
  await editeur.getByRole('button', { name: 'Italique', exact: true }).click();
  await editeur.getByRole('button', { name: 'Souligné', exact: true }).click();
  await editeur.getByRole('button', { name: 'Aligner à droite' }).click();
  await editeur.getByLabel(/^Ligne 1/).click();
  const apercuLigne = editeur.getByLabel(/^Ligne 7/);
  await expect(apercuLigne).toHaveText('E-mail : Contact.Salfa@example.org');
  const styleEditeur = await apercuLigne.evaluate(el => {
    const c = getComputedStyle(el);
    return { fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, fontStyle: c.fontStyle, textAlign: c.textAlign, textDecorationLine: c.textDecorationLine, fontVariant: c.fontVariant, textTransform: c.textTransform };
  });
  const positionsEditeur = await mesurer(page, '.entete-feuille', '.entete-ligne', '.entete-feuille__image');
  await editeur.getByRole('button', { name: 'Enregistrer l’en-tête' }).click();
  await page.getByRole('button', { name: 'Livre journal' }).click();
  await page.getByRole('button', { name: /^Imprimer le bordereau DP-/ }).first().click();
  await page.emulateMedia({ media: 'print' });
  const imprime = page.locator('.print-bordereau .bordereau-ligne-entete').nth(6);
  await expect(imprime).toBeVisible();
  await expect(imprime).toHaveText('E-mail : Contact.Salfa@example.org');
  const styleBordereau = await imprime.evaluate(el => { const c = getComputedStyle(el); return { fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, fontStyle: c.fontStyle, textAlign: c.textAlign, textDecorationLine: c.textDecorationLine, fontVariant: c.fontVariant, textTransform: c.textTransform }; });
  expect(styleBordereau).toEqual(styleEditeur);
  await expect(imprime).toHaveCSS('text-transform', 'none');
  await expect(imprime).toHaveCSS('font-variant', 'normal');
  const positionsImprimees = await mesurer(page, '.print-bordereau .bordereau-document', '.bordereau-ligne-entete', '.bordereau-entete__image-libre');
  positionsEditeur.lignes.forEach((position, index) => positionsProches(position, positionsImprimees.lignes[index]));
  positionsProches(positionsEditeur.image, positionsImprimees.image);
});
