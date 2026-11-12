import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
describe('messagerie en conversations', () => {
  it('envoie et reçoit des messages, et répond au bon correspondant', async () => {
    const vue = render(<Messagerie utilisateur={admin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Messages privés' }));
    expect(screen.queryByLabelText('Destinataire')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Caisse.*caisse/ }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bonjour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await screen.findByLabelText('Conversation avec Caisse');
    vue.unmount();
    const vue2 = render(<Messagerie utilisateur={autre} />);
    fireEvent.click(screen.getByRole('button', { name: 'Messages privés' }));
    await screen.findByText(/Sélectionnez un utilisateur/);
    expect(screen.queryByText('Bonjour')).not.toBeInTheDocument();
    vue2.unmount();
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Admin.*Bonjour/ }));
    expect(screen.getByLabelText('Conversation avec Admin')).toHaveTextContent('Bonjour');
    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(screen.queryByLabelText('Destinataire')).not.toBeInTheDocument();
    expect(screen.getByText(/Réponse à Admin/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bien reçu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await screen.findByText('Bien reçu');
    expect(JSON.parse(localStorage.getItem('salfa_messages_prives')!)[0]).toMatchObject({ auteurId: '2', destinataireId: '1', contenu: 'Bien reçu' });
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme lu' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marquer comme lu' })).not.toBeInTheDocument());
  });
  it('regroupe par personne et affiche les bulles dans l’ordre chronologique', async () => {
    const base = { destinataireId: '2', destinataireNom: 'Caisse', creeLe: '2026-01-01T12:00:00Z', luLe: null };
    localStorage.setItem('salfa_messages_prives', JSON.stringify([
      { ...base, id: 2, auteurId: '2', auteurNom: 'Caisse', destinataireId: '1', destinataireNom: 'Admin', contenu: 'Réponse envoyée' },
      { ...base, id: 1, auteurId: '1', auteurNom: 'Admin', contenu: 'Message reçu' },
      { ...base, id: 3, auteurId: '3', auteurNom: 'Autre', contenu: 'Autre discussion' },
    ]));
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 2 non lus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Admin.*Réponse envoyée/ }));
    const conversation = screen.getByLabelText('Conversation avec Admin');
    expect(within(conversation).getAllByRole('article').map(a => a.textContent)).toEqual([expect.stringContaining('Message reçu'), expect.stringContaining('Réponse envoyée')]);
    expect(within(conversation).queryByText('Autre discussion')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Brouillon important' } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /Autre.*Autre discussion/ }));
    expect(screen.getByLabelText('Message')).toHaveValue('Brouillon important');
  });
  it('désactive la réponse lorsque l’expéditeur n’est plus actif', async () => {
    localStorage.setItem('salfa_messages_prives', JSON.stringify([{ id: 1, auteurId: '99', destinataireId: '2', auteurNom: 'Ancien', destinataireNom: 'Caisse', contenu: 'Bonjour', creeLe: new Date().toISOString(), luLe: null }]));
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ancien.*Bonjour/ }));
    expect(screen.getByRole('button', { name: 'Répondre' })).toBeDisabled();
    expect(screen.getByText(/correspondant est désactivé/)).toBeInTheDocument();
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
      expect(notifier).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('suppression individuelle', () => {
  it('ne supprime que pour son utilisateur, par message puis conversation entière', async () => {
    const messages = [
      { id: 11, auteurId: '1', destinataireId: '2', auteurNom: 'Admin', destinataireNom: 'Caisse', contenu: 'Premier', creeLe: '2026-01-01T10:00:00Z', luLe: null },
      { id: 12, auteurId: '2', destinataireId: '1', auteurNom: 'Caisse', destinataireNom: 'Admin', contenu: 'Second', creeLe: '2026-01-01T11:00:00Z', luLe: null },
    ];
    localStorage.setItem('salfa_messages_prives', JSON.stringify(messages));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const vue = render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Admin.*Second/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le message 11' }));
    await waitFor(() => expect(screen.queryByText('Premier')).not.toBeInTheDocument());
    expect(screen.getByText('Second')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer toute la conversation' }));
    await waitFor(() => expect(screen.queryByText('Second')).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('salfa_messages_prives')!)).toHaveLength(2);
    vue.unmount();
    render(<Messagerie utilisateur={admin} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Caisse.*Second/ }));
    expect(screen.getByText('Premier')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
  it('ne supprime rien si la confirmation est annulée', async () => {
    localStorage.setItem('salfa_messages_prives', JSON.stringify([{ id: 1, auteurId: '1', destinataireId: '2', auteurNom: 'Admin', destinataireNom: 'Caisse', contenu: 'Bonjour', creeLe: new Date().toISOString(), luLe: null }]));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Messagerie utilisateur={caisse} />);
    fireEvent.click(await screen.findByRole('button', { name: /Messages privés, 1 non lus/ }));
    fireEvent.click(screen.getByRole('button', { name: /Admin.*Bonjour/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer toute la conversation' }));
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    expect(localStorage.getItem('salfa_messages_suppressions')).toBeNull();
  });
});
