import { expect, test } from '@playwright/test';

for (const sens of ['recette', 'dépense'] as const) {
  test(`une suggestion remplace le mot sans doublon dans la ${sens}`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.addInitScript(() => { window.print = () => {}; });
    await page.goto('/?demo=0');
    await page.locator('#identifiant').fill('admin');
    await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
    await page.getByRole('button', { name: /Se connecter/ }).click();
    await page.getByRole('button', { name: `Nouvelle ${sens}`, exact: true }).click();
    const dialogue = page.getByRole('dialog', { name: `Nouvelle ${sens}` });
    const libelle = dialogue.getByLabel(/Libellé de l’écriture/);
    await libelle.fill('achat de carb');
    // L'affichage est en capitales, pas la valeur native gérée par le clavier.
    await expect(libelle).toHaveCSS('text-transform', 'uppercase');
    await expect(libelle).toHaveValue('achat de carb');
    await libelle.evaluate((el: HTMLInputElement) => el.setSelectionRange(9, 13));
    await page.keyboard.insertText('carburant');
    await expect(libelle).toHaveValue('achat de carburant');
    await expect(libelle).toBeFocused();
    await page.keyboard.insertText(' groupe');
    await expect(libelle).toHaveValue('achat de carburant groupe');

    await dialogue.getByRole('button', { name: 'Détail par postes' }).click();
    const poste = dialogue.getByLabel('Poste', { exact: true });
    await poste.fill('médicam');
    await poste.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, el.value.length));
    await page.keyboard.insertText('médicaments');
    await expect(poste).toHaveValue('médicaments');
    await dialogue.getByLabel('Montant (Ar)', { exact: true }).fill('1500');
    await dialogue.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const ajoute = dialogue.getByLabel('Libellé du poste 1');
    await expect(ajoute).toHaveValue('MÉDICAMENTS');
    await ajoute.fill('médicaments extern');
    await ajoute.evaluate((el: HTMLInputElement) => el.setSelectionRange(12, el.value.length));
    await page.keyboard.insertText('externes');
    await expect(ajoute).toHaveValue('médicaments externes');
    await dialogue.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialogue).toHaveCount(0);
    const livre = await page.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
    expect(livre.ecritures).toHaveLength(1);
    expect(livre.ecritures[0]).toMatchObject({
      libelle: 'ACHAT DE CARBURANT GROUPE', montant: 1500,
      lignesDetail: [{ libelle: 'MÉDICAMENTS EXTERNES', montant: 1500 }],
    });
    expect(erreurs).toEqual([]);
  });
}
