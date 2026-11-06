import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { livreTest } from '../test/fixtures';
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
});
