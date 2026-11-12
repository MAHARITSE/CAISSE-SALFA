import { expect, test } from '@playwright/test';

test('le son des messages intégré peut être décodé et joué dans le navigateur', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Identifiant').fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin1234');
  await page.getByRole('button', { name: /Se connecter/ }).click();
  await page.getByRole('button', { name: 'Messages privés', exact: true }).click();
  const messagerie = page.getByRole('dialog', { name: 'Messages privés' });
  await messagerie.getByRole('button', { name: 'Tester le son des messages' }).click();
  await expect(messagerie.getByText(/Son de test joué/)).toBeVisible();
});
