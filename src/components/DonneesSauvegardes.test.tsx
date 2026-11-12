import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ecritureTest, livreTest } from '../test/fixtures';
import { preparerSqlLivre } from '../utils/backup';

vi.mock('../utils/api', () => ({ MODE_API: true, exporterSql: vi.fn() }));
import { DonneesSauvegardes } from './DonneesSauvegardes';

describe('sauvegarde et restauration SQL', () => {
  it('vérifie le fichier, demande une confirmation et restaure uniquement après accord', async () => {
    const user = userEvent.setup();
    const livre = livreTest();
    const restaurer = vi.fn().mockResolvedValue(true);
    render(<DonneesSauvegardes livre={livre} administrateur erreur={null} onRestaurer={restaurer} onRecharger={vi.fn()} />);
    expect(screen.queryByText(/sauvegarde JSON/i)).not.toBeInTheDocument();
    const fichier = new File([preparerSqlLivre(livre)], 'sauvegarde.sql', { type: 'application/sql' });
    await user.upload(screen.getByLabelText('Fichier de sauvegarde SQL'), fichier);
    await user.click(await screen.findByRole('button', { name: 'Restaurer cette sauvegarde' }));
    const dialogue = screen.getByRole('dialog', { name: 'Remplacer le livre actuel ?' });
    expect(dialogue).toHaveTextContent('Les comptes et mots de passe ne seront pas modifiés');
    expect(restaurer).not.toHaveBeenCalled();
    expect(within(dialogue).getByRole('button', { name: 'Restaurer et remplacer' })).toBeDisabled();
    await user.click(within(dialogue).getByRole('checkbox'));
    await user.click(within(dialogue).getByRole('button', { name: 'Restaurer et remplacer' }));
    expect(restaurer).toHaveBeenCalledWith(expect.objectContaining({ format: 'CAISSE-SALFA' }));
    expect(await screen.findByText(/Restauration enregistrée/)).toBeInTheDocument();
  });

  it('ne présente pas les actions de sauvegarde et restauration aux non-administrateurs', () => {
    render(<DonneesSauvegardes livre={livreTest()} erreur={null} onRestaurer={vi.fn()} onRecharger={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sauvegarde SQL/i })).not.toBeInTheDocument();
    expect(screen.getByText(/réservées à l’administrateur/)).toBeInTheDocument();
  });

  it('propose des exemples sur un livre vide, et seulement après confirmation', async () => {
    const user = userEvent.setup();
    const restaurer = vi.fn().mockResolvedValue(true);
    render(<DonneesSauvegardes livre={livreTest()} administrateur erreur={null} onRestaurer={restaurer} onRecharger={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'Exemples de démonstration' });
    expect(within(section).getByText(/Le livre est vide/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Charger les exemples' }));
    const dialogue = screen.getByRole('dialog', { name: 'Charger les exemples ?' });
    expect(restaurer).not.toHaveBeenCalled();
    await user.click(within(dialogue).getByRole('button', { name: 'Charger les exemples' }));
    expect(restaurer).toHaveBeenCalledWith(expect.objectContaining({
      format: 'CAISSE-SALFA',
      ecritures: expect.arrayContaining([expect.objectContaining({ numero: 'RC-2026-0001' })]),
      virements: expect.objectContaining({ comptes: expect.any(Array) }),
    }));
    expect(await screen.findByText(/Exemples chargés/)).toBeInTheDocument();
  });

  it('ne propose plus les exemples dès que le livre contient une pièce', () => {
    render(<DonneesSauvegardes livre={livreTest({ ecritures: [ecritureTest()] })} administrateur erreur={null} onRestaurer={vi.fn()} onRecharger={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'Exemples de démonstration' })).toBeNull();
  });
});
