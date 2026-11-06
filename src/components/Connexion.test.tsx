import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Ces tests forcent le mode serveur (`MODE_API`) pour éprouver l'écran de
 * connexion d'un dossier WAMP fraîchement recopié dans `www` : soit l'accès
 * MySQL par défaut est refusé (il faut saisir les accès, sans installation),
 * soit le serveur ne répond pas du tout. L'écran doit guider au lieu de laisser
 * essayer des identifiants qui ne peuvent pas aboutir.
 */
const { sante, connexion, configurerServeur, ErreurApi } = vi.hoisted(() => {
  class ErreurApi extends Error {
    readonly code: string;
    readonly statut: number;
    constructor(message: string, code: string, statut: number) {
      super(message);
      this.name = 'ErreurApi';
      this.code = code;
      this.statut = statut;
    }
  }
  return { sante: vi.fn(), connexion: vi.fn(), configurerServeur: vi.fn(), ErreurApi };
});

vi.mock('../utils/api', () => ({ MODE_API: true, ErreurApi, sante, connexion, configurerServeur }));

// eslint-disable-next-line import/first
import { Connexion } from './Connexion';

describe('connexion en mode serveur', () => {
  it('demande les accès MySQL quand l’accès par défaut de WAMP est refusé', async () => {
    sante.mockRejectedValue(new ErreurApi('Accès refusé par MySQL.', 'mysql_injoignable', 503));
    render(<Connexion onConnecte={vi.fn()} />);

    expect(await screen.findByText('Connexion MySQL à préciser')).toBeInTheDocument();
    // Aucune installation : les accès se saisissent dans l'écran de connexion.
    expect(screen.queryByRole('link', { name: /installation/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hôte')).toHaveValue('127.0.0.1');
    expect(screen.getByLabelText('Port')).toHaveValue('3306');
    expect(screen.getByLabelText('Base')).toHaveValue('caisse_salfa');
    expect(screen.getByLabelText('Utilisateur')).toHaveValue('root');
    expect(screen.getByRole('button', { name: 'Préparer le serveur' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le diagnostic du serveur' }))
      .toHaveAttribute('href', 'api/index.php?action=verifier');
    // Le panneau remplace l'erreur rouge : un seul message à lire.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prépare le serveur avec les accès saisis et laisse se connecter', async () => {
    const user = userEvent.setup();
    sante.mockRejectedValueOnce(new ErreurApi('Accès refusé par MySQL.', 'mysql_injoignable', 503));
    configurerServeur.mockResolvedValue({
      message: 'Serveur préparé : base « caisse_salfa », 14 tables.',
      base: 'caisse_salfa',
      tables: 14,
      comptes: { administrateur: 'admin', comptable: 'comptable' },
    });
    render(<Connexion onConnecte={vi.fn()} />);
    await screen.findByText('Connexion MySQL à préciser');

    await user.clear(screen.getByLabelText('Mot de passe MySQL (vide sur un WampServer standard)'));
    await user.type(screen.getByLabelText('Mot de passe MySQL (vide sur un WampServer standard)'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Préparer le serveur' }));

    await waitFor(() => expect(configurerServeur).toHaveBeenCalledWith(
      expect.objectContaining({ utilisateur: 'root', motDePasse: 'secret', base: 'caisse_salfa' }),
    ));
    expect(await screen.findByText(/14 tables/)).toBeInTheDocument();
    // Le panneau disparaît : le serveur est prêt, le formulaire de connexion reste.
    await waitFor(() => expect(screen.queryByText('Connexion MySQL à préciser')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Identifiant')).toBeInTheDocument();
  });

  it('affiche le message du serveur si la préparation échoue', async () => {
    const user = userEvent.setup();
    sante.mockRejectedValueOnce(new ErreurApi('Accès refusé par MySQL.', 'mysql_injoignable', 503));
    configurerServeur.mockRejectedValue(new ErreurApi('Accès refusé par MySQL : l’utilisateur ou le mot de passe est incorrect.', 'mysql_injoignable', 503));
    render(<Connexion onConnecte={vi.fn()} />);
    await screen.findByText('Connexion MySQL à préciser');

    await user.click(screen.getByRole('button', { name: 'Préparer le serveur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé par MySQL');
  });

  it('retire le panneau dès que le serveur répond, après « Réessayer »', async () => {
    const user = userEvent.setup();
    sante.mockRejectedValueOnce(new ErreurApi('Accès refusé par MySQL.', 'mysql_injoignable', 503));
    render(<Connexion onConnecte={vi.fn()} />);
    await screen.findByText('Connexion MySQL à préciser');

    sante.mockResolvedValueOnce({ revision: 1, exercice: 2026, versionApi: '1.2.0' });
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(screen.queryByText('Connexion MySQL à préciser')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Identifiant')).toBeInTheDocument();
  });

  it('signale un serveur muet et propose le diagnostic', async () => {
    sante.mockRejectedValue(new Error('Failed to fetch'));
    render(<Connexion onConnecte={vi.fn()} />);

    expect(await screen.findByText('Serveur injoignable')).toBeInTheDocument();
    expect(screen.getByText(/Apache et MySQL sont démarrés/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le diagnostic du serveur' })).toBeInTheDocument();
  });
});
