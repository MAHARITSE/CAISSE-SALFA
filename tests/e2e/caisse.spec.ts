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
  await expect(dialog.getByLabel('Mode de paiement')).toHaveCount(0);
  await expect(dialog.getByText('Caisse en espèces — aucun autre mode n’est géré')).toBeVisible();
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
  expect(stocke.ecritures[0]).toMatchObject({ montant: 10000, reference: 'Bordereau F-1', observation: 'Contrôle navigateur' });
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

test('clôture annuelle : archive figée, solde reporté et saisie sur le nouvel exercice', async ({ page }) => {
  const annee = new Date().getFullYear();
  await page.addInitScript(() => {
    const an = new Date().getFullYear();
    const ecriture = (id: string, numero: string, sens: string, montant: number, jour: string) => ({
      id, numero, date: `${an - 1}-${jour}`, sens,
      libelle: sens === 'RECETTE' ? 'Recettes de fin d’année' : 'Achat de carburant',
      categorie: sens === 'RECETTE' ? 'Recettes journalières' : 'Divers',
      montant, createdAt: '2025-12-01T08:00:00.000Z',
    });
    localStorage.setItem('salfa_tresorerie_livre_v2', JSON.stringify({
      format: 'CAISSE-SALFA', version: 1, revision: 1, updatedAt: new Date().toISOString(),
      parametres: { soldeInitial: 1000, exercice: an - 1, reportPrecedent: null },
      ecritures: [ecriture('a', `RC-${an - 1}-0001`, 'RECETTE', 5000, '12-24'), ecriture('b', `DP-${an - 1}-0001`, 'DEPENSE', 2000, '12-28')],
      masques: [], compteurs: { [`RC-${an - 1}`]: 1, [`DP-${an - 1}`]: 1 }, exercicesClotures: [],
    }));
  });
  await page.goto('/');
  await expect(page.getByText(`L’exercice ${annee - 1} doit être clôturé.`)).toBeVisible();
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: `Clôturer l’exercice ${annee - 1}` }).first().click();
  const dialogue = page.getByRole('dialog', { name: `Clôturer l’exercice ${annee - 1} ?` });
  await expect(dialogue).toBeVisible();
  await expect(dialogue.getByText('4 000 Ar').first()).toBeVisible();
  await dialogue.getByRole('button', { name: `Clôturer ${annee - 1} et ouvrir ${annee}` }).click();
  const sauvegarde = await telechargement;
  expect(sauvegarde.suggestedFilename()).toContain(`avant_cloture_${annee - 1}`);
  await expect(page.getByText(`Exercice ${annee}`, { exact: false }).first()).toBeVisible();
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
  expect(stocke.parametres.exercice).toBe(annee);
  expect(stocke.parametres.soldeInitial).toBe(4000);
  expect(stocke.ecritures).toHaveLength(0);
  expect(stocke.exercicesClotures[0]).toMatchObject({ annee: annee - 1, soldeCloture: 4000 });
  await page.getByRole('button', { name: 'Exercices & clôtures' }).click();
  await expect(page.getByRole('table').getByText(String(annee - 1), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Télécharger l’archive ${annee - 1}` })).toBeVisible();
  // Une saisie sur l'exercice ouvert reste possible ; la date est bornée à l'exercice.
  await page.getByRole('button', { name: 'Livre journal' }).click();
  await page.getByRole('button', { name: 'Nouvelle recette', exact: true }).click();
  const saisie = page.getByRole('dialog', { name: 'Nouvelle recette' });
  await expect(saisie.getByLabel(/Date de l’opération/)).toHaveAttribute('min', `${annee}-01-01`);
  await saisie.getByLabel(/Libellé de l’écriture/).fill('Recette nouvel exercice');
  await saisie.getByLabel(/Montant total/).fill('2500');
  await saisie.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Recette nouvel exercice', { exact: true })).toBeVisible();
});

test('livre antérieur multi-années : converti sans perte et signalé', async ({ page }) => {
  const annee = new Date().getFullYear();
  await page.addInitScript(() => {
    const an = new Date().getFullYear();
    const e = (id: string, numero: string, sens: string, montant: number, date: string) => ({
      id, numero, date, sens, libelle: sens === 'RECETTE' ? 'Recettes du jour' : 'Achat carburant',
      categorie: sens === 'RECETTE' ? 'Recettes journalières' : 'Divers', montant, createdAt: '2024-01-01T08:00:00.000Z',
    });
    if (localStorage.getItem('salfa_tresorerie_livre_v2')) return;
    localStorage.setItem('salfa_tresorerie_livre_v2', JSON.stringify({
      format: 'CAISSE-SALFA', version: 1, revision: 3, updatedAt: new Date().toISOString(),
      parametres: { soldeInitial: 1000 },
      ecritures: [
        e('a', `RC-${an - 2}-0001`, 'RECETTE', 5000, `${an - 2}-06-10`),
        e('b', `DP-${an - 2}-0001`, 'DEPENSE', 2000, `${an - 2}-07-10`),
        e('c', `RC-${an}-0001`, 'RECETTE', 1500, `${an}-02-10`),
      ],
      masques: [], compteurs: {},
    }));
  });
  await page.goto('/');
  await expect(page.getByText(/clôturés automatiquement et archivés/)).toBeVisible();
  await expect(page.getByText('Stockage à vérifier')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Livre de caisse' })).toBeVisible();
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('salfa_tresorerie_livre_v2')!));
  expect(stocke.parametres.exercice).toBe(annee);
  expect(stocke.parametres.soldeInitial).toBe(4000);
  expect(stocke.ecritures).toHaveLength(1);
  expect(stocke.exercicesClotures.map((c: { annee: number }) => c.annee)).toEqual([annee - 2, annee - 1]);
  await page.getByRole('button', { name: 'Exercices & clôtures' }).click();
  await expect(page.getByRole('table').getByText(String(annee - 2), { exact: true })).toBeVisible();
});

test('clôture refusée tant que l’année est en cours', async ({ page }) => {
  const annee = new Date().getFullYear();
  await page.goto('/');
  await page.getByRole('button', { name: 'Exercices & clôtures' }).click();
  await expect(page.getByText(`À partir du 1er janvier ${annee + 1}`, { exact: true })).toBeVisible();
  // Bouton volontairement désactivé : la clôture ne peut pas être demandée.
  await expect(page.getByRole('button', { name: `Clôturer l’exercice ${annee}` })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: `Clôturer l’exercice ${annee} ?` })).toHaveCount(0);
  await expect(page.getByText(`Clôture possible à partir du 1er janvier ${annee + 1}, une fois l’année révolue.`)).toBeVisible();
  // Aucune clôture n'a été enregistrée (un livre neuf n'est même pas encore écrit).
  const stocke = await page.evaluate(() => localStorage.getItem('salfa_tresorerie_livre_v2'));
  if (stocke) {
    const livre = JSON.parse(stocke);
    expect(livre.parametres.exercice).toBe(annee);
    expect(livre.exercicesClotures).toHaveLength(0);
  }
});
