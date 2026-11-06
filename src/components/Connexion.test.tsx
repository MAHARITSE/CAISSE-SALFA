import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Ces tests forcent le mode serveur (`MODE_API`) pour éprouver l'écran de
 * connexion d'un paquet WAMP fraîchement recopié : l'API répond « non installé »
 * ou ne répond pas du tout, et l'écran doit guider l'installation au lieu de
 * laisser essayer des identifiants qui ne peuvent pas aboutir.
 */
const { sante, connexion, ErreurApi } = vi.hoisted(() => {
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
  return { sante: vi.fn(), connexion: vi.fn(), ErreurApi };
});

vi.mock('../utils/api', () => ({ MODE_API: true, ErreurApi, sante, connexion }));

// eslint-disable-next-line import/first
import { Connexion } from './Connexion';

describe('connexion en mode serveur', () => {
  it('explique l’installation quand l’API n’a pas encore sa configuration', async () => {
    sante.mockRejectedValue(new ErreurApi('L’API n’est pas encore configurée.', 'non_installe', 503));
    render(<Connexion onConnecte={vi.fn()} />);

    expect(await screen.findByText('Serveur pas encore installé')).toBeInTheDocument();
    expect(screen.getByText(/outils\\installer\.bat/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le diagnostic du serveur' }))
      .toHaveAttribute('href', 'api/index.php?action=verifier');
    // Le panneau remplace l'erreur rouge : un seul message à lire.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retire le panneau dès que le serveur répond, après « Réessayer »', async () => {
    const user = userEvent.setup();
    sante.mockRejectedValueOnce(new ErreurApi('L’API n’est pas encore configurée.', 'non_installe', 503));
    render(<Connexion onConnecte={vi.fn()} />);
    await screen.findByText('Serveur pas encore installé');

    sante.mockResolvedValueOnce({ revision: 1, exercice: 2026, versionApi: '1.2.0' });
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(screen.queryByText('Serveur pas encore installé')).not.toBeInTheDocument());
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
