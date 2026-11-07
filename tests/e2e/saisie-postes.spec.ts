import { expect, test } from '@playwright/test';

for (const sens of ['recette', 'dépense'] as const) {
  test(`Entrée ajoute le poste sans enregistrer prématurément la ${sens}`, async ({ page }) => {
    await page.goto('/?demo=0');
    await page.locator('#identifiant').fill('admin');
    await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
    await page.getByRole('button', { name: /Se connecter/ }).click();
    await page.getByRole('button', { name: `Nouvelle ${sens}`, exact: true }).click();
    const dialogue = page.getByRole('dialog', { name: `Nouvelle ${sens}` });
    const libelle = dialogue.getByLabel(/Libellé de l’écriture/);
    await expect(libelle).not.toHaveAttribute('list');
    await expect(libelle).toHaveAttribute('autocomplete', 'off');
    await libelle.fill('TEST CLAVIER');
    await dialogue.getByRole('button', { name: 'Détail par postes' }).click();
    const poste = dialogue.getByLabel('Poste', { exact: true });
    const montant = dialogue.getByLabel('Montant (Ar)', { exact: true });
    await poste.fill('CONSULTATION');
    await montant.fill('4000');
    await montant.press('Enter');
    await expect(dialogue).toBeVisible();
    await expect(dialogue.getByLabel('Libellé du poste 1')).toHaveValue('CONSULTATION');
    await expect(poste).toHaveValue('');
    await expect(poste).toBeFocused();
    await expect(montant).toHaveValue('');
    expect(await page.evaluate(() => localStorage.getItem('salfa_tresorerie_livre_v2'))).toBeNull();

    await poste.fill('PHARMACIE');
    await montant.fill('6000');
    await dialogue.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialogue.getByRole('alert')).toContainText('Ajoutez le poste en cours');
    await expect(poste).toHaveValue('PHARMACIE');
    await montant.press('Enter');
    await expect(dialogue.getByLabel('Libellé du poste 2')).toHaveValue('PHARMACIE');
    await dialogue.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialogue).toHaveCount(0);
    const livre = await page.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
    expect(livre.ecritures).toHaveLength(1);
    expect(livre.ecritures[0]).toMatchObject({ montant: 10000, lignesDetail: [
      { libelle: 'CONSULTATION', montant: 4000 }, { libelle: 'PHARMACIE', montant: 6000 },
    ] });
  });
}
