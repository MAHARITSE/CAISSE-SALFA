import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Messagerie } from './Messagerie';
vi.mock('../utils/utilisateurs', () => ({ listerComptes: async () => [
  { id: '1', identifiant: 'admin', nomComplet: 'Admin', actif: true },
  { id: '2', identifiant: 'caisse', nomComplet: 'Caisse', actif: true },
  { id: '3', identifiant: 'autre', nomComplet: 'Autre', actif: true },
] }));
const admin = { id: '1', identifiant: 'admin', nomComplet: 'Admin', role: 'admin' as const };
const caisse = { id: '2', identifiant: 'caisse', nomComplet: 'Caisse', role: 'caissier' as const };
const autre = { id: '3', identifiant: 'autre', nomComplet: 'Autre', role: 'comptable' as const };
beforeEach(() => localStorage.clear());
describe('messages privés', () => {
  it('envoie au destinataire, signale le message et permet de le marquer lu', async () => {
    const vue = render(<Messagerie utilisateur={admin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Messages privés' }));
    expect(screen.queryByLabelText('Destinataire')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau message' }));
    await screen.findByRole('option', { name: 'Caisse (caisse)' });
    fireEvent.change(screen.getByLabelText('Destinataire'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bonjour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await screen.findByText('Bonjour');
    vue.unmount();
    const vue2 = render(<Messagerie utilisateur={autre} />);
    fireEvent.click(screen.getByRole('button', { name: 'Messages privés' }));
    await screen.findByText('Aucun message.');
    expect(screen.queryByText('Bonjour')).not.toBeInTheDocument();
    vue2.unmount();
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    expect(await screen.findByText('Bonjour')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(screen.queryByLabelText('Destinataire')).not.toBeInTheDocument();
    expect(screen.getByText('Réponse à')).toHaveTextContent('Admin');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bien reçu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await screen.findByText('Bien reçu');
    const messages = JSON.parse(localStorage.getItem('salfa_messages_prives')!);
    expect(messages[0]).toMatchObject({ auteurId: '2', destinataireId: '1', contenu: 'Bien reçu' });
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme lu' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marquer comme lu' })).not.toBeInTheDocument());
  });
});

it('notifie uniquement les nouveaux messages reçus après le chargement initial', async () => {
  const notifier = vi.fn();
  class NotificationSimulee {
    static permission: NotificationPermission = 'granted';
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    onclick: (() => void) | null = null;
    constructor(titre: string, options?: NotificationOptions) { notifier(titre, options); }
    close() {}
  }
  vi.stubGlobal('Notification', NotificationSimulee);
  try {
    localStorage.setItem('salfa_messages_prives', JSON.stringify([{ id: 1, auteurId: '1', destinataireId: '2', auteurNom: 'Admin', destinataireNom: 'Caisse', contenu: 'Ancien', creeLe: new Date().toISOString(), luLe: null }]));
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    expect(notifier).not.toHaveBeenCalled();
    const liste = JSON.parse(localStorage.getItem('salfa_messages_prives')!);
    liste.push({ ...liste[0], id: 2, contenu: 'Nouveau' });
    localStorage.setItem('salfa_messages_prives', JSON.stringify(liste));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(notifier).toHaveBeenCalledTimes(1));
    expect(notifier).toHaveBeenCalledWith('Caisse SALFA · Nouveau message', expect.objectContaining({ body: 'Message de Admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(screen.getByText('Nouveau')).toBeInTheDocument());
    expect(notifier).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});

it('désactive la réponse lorsque l’expéditeur n’est plus actif', async () => {
  localStorage.setItem('salfa_messages_prives', JSON.stringify([{ id: 1, auteurId: '99', destinataireId: '2', auteurNom: 'Ancien', destinataireNom: 'Caisse', contenu: 'Bonjour', creeLe: new Date().toISOString(), luLe: null }]));
  render(<Messagerie utilisateur={caisse} />);
  fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
  expect(await screen.findByRole('button', { name: 'Répondre' })).toBeDisabled();
});

it('filtre les messages et protège le brouillon lors du changement de réponse', async () => {
  const base = { destinataireId: '2', destinataireNom: 'Caisse', creeLe: new Date().toISOString(), luLe: null };
  localStorage.setItem('salfa_messages_prives', JSON.stringify([
    { ...base, id: 1, auteurId: '1', auteurNom: 'Admin', contenu: 'Premier message' },
    { ...base, id: 2, auteurId: '3', auteurNom: 'Autre', contenu: 'Second message' },
    { ...base, id: 3, auteurId: '2', auteurNom: 'Caisse', destinataireId: '1', destinataireNom: 'Admin', contenu: 'Message envoyé' },
  ]));
  render(<Messagerie utilisateur={caisse} />);
  fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 2 non lus/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Envoyés' }));
  expect(screen.getByText('Message envoyé')).toBeInTheDocument();
  expect(screen.queryByText('Premier message')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reçus' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Répondre' })[0]);
  expect(screen.getByText('Message de Admin')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Brouillon important' } });
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getAllByRole('button', { name: 'Répondre' })[1]);
  expect(confirmation).toHaveBeenCalled();
  expect(screen.getByLabelText('Message')).toHaveValue('Brouillon important');
  expect(screen.getByText('Réponse à')).toHaveTextContent('Admin');
});
