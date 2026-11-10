import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemandesPrecision } from './DemandesPrecision';
import { ecritureTest } from '../test/fixtures';

const admin = { id: '1', identifiant: 'admin', nomComplet: 'Admin', role: 'admin' as const };
const caissier = { id: '2', identifiant: 'caisse', nomComplet: 'Caisse', role: 'caissier' as const };
const ecriture = ecritureTest();
beforeEach(() => localStorage.clear());
describe('demandes de précision', () => {
  it('enregistre une demande puis permet au caissier de la consulter et la compléter', async () => {
    const fermer = vi.fn();
    const vue = render(<DemandesPrecision utilisateur={admin} ecritures={[ecriture]} cible={ecriture} fermer={fermer} editer={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Que faut-il préciser ?'), { target: { value: 'Préciser la dépense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(fermer).toHaveBeenCalled());
    vue.unmount();
    const editer = vi.fn();
    render(<DemandesPrecision utilisateur={caissier} ecritures={[ecriture]} cible={null} fermer={vi.fn()} editer={editer} />);
    expect(await screen.findByText('Préciser la dépense')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier l’écriture' }));
    expect(editer).toHaveBeenCalledWith(ecriture);
    fireEvent.click(screen.getByRole('button', { name: 'Marquer complétée' }));
    await screen.findByText('Aucune demande en attente.');
    fireEvent.click(screen.getByRole('button', { name: 'Voir toutes les demandes' }));
    expect(screen.getByText(/Complétée par Caisse/)).toBeInTheDocument();
  });
  it('ne permet pas de compléter une demande dont la pièce est indisponible', async () => {
    localStorage.setItem('salfa_demandes_precision', JSON.stringify([{ id: 1, ecritureId: 'absent', numero: 'DP-1', message: 'Préciser', auteur: 'Admin', creeLe: new Date().toISOString(), completeLe: null }]));
    render(<DemandesPrecision utilisateur={caissier} ecritures={[]} cible={null} fermer={vi.fn()} editer={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Marquer complétée' })).toBeDisabled();
  });
});
