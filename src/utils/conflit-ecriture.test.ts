import { describe, expect, it, vi } from 'vitest';
import { enregistrerAvecReconciliation } from './conflit-ecriture';
import { ecritureTest, livreTest, parametresTest } from '../test/fixtures';

const initial = livreTest({ revision: 1, parametres: parametresTest(), ecritures: [] });
const ecriture = ecritureTest({ categorie: initial.categories.recette[0] });
const conflit = { code: 'conflit_revision' };

describe('réconciliation des écritures', () => {
  it('recharge et réessaie une nouvelle écriture à la dernière révision', async () => {
    const recent = { ...initial, revision: 2, ecritures: [ecritureTest({ id: 'autre' })] };
    const termine = { ...recent, revision: 3, ecritures: [...recent.ecritures, ecriture] };
    const envoyer = vi.fn().mockRejectedValueOnce(conflit).mockResolvedValueOnce({ livre: termine });
    const charger = vi.fn().mockResolvedValue(recent);
    expect(await enregistrerAvecReconciliation(initial, ecriture, null, envoyer, charger)).toEqual(termine);
    expect(envoyer.mock.calls.map(c => c[0])).toEqual([1, 2]);
    expect(charger).toHaveBeenCalledOnce();
  });
  it('réessaie une édition seulement si la pièce originale est intacte', async () => {
    const avant = { ...initial, ecritures: [ecriture] };
    const recent = { ...avant, revision: 2 };
    const envoyer = vi.fn().mockRejectedValueOnce(conflit).mockResolvedValueOnce({ livre: { ...recent, revision: 3 } });
    await enregistrerAvecReconciliation(avant, { ...ecriture, libelle: 'MODIFIÉ' }, ecriture, envoyer, vi.fn().mockResolvedValue(recent));
    expect(envoyer).toHaveBeenCalledTimes(2);
  });
  it.each(['modifiée', 'supprimée'])("ne réécrit pas une pièce %s par un tiers", async type => {
    const avant = { ...initial, ecritures: [ecriture] };
    const recent = { ...avant, revision: 2, ecritures: type === 'modifiée' ? [{ ...ecriture, montant: 123 }] : [] };
    const envoyer = vi.fn().mockRejectedValue(conflit);
    await expect(enregistrerAvecReconciliation(avant, ecriture, ecriture, envoyer, vi.fn().mockResolvedValue(recent))).rejects.toThrow(/modifiée ou supprimée/);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
  it('bloque une écriture déjà changée dans le livre local avant même l’envoi', async () => {
    const recent = { ...initial, ecritures: [{ ...ecriture, montant: 123 }] };
    const envoyer = vi.fn();
    await expect(enregistrerAvecReconciliation(recent, ecriture, ecriture, envoyer, vi.fn())).rejects.toThrow(/modifiée ou supprimée/);
    expect(envoyer).not.toHaveBeenCalled();
  });
  it('refuse le réessai si l’exercice est clôturé ou la catégorie retirée', async () => {
    const envoyer = vi.fn().mockRejectedValue(conflit);
    await expect(enregistrerAvecReconciliation(initial, ecriture, null, envoyer, vi.fn().mockResolvedValue({ ...initial, revision: 2, parametres: parametresTest({ exercice: 2027 }) }))).rejects.toThrow(/exercice a changé/i);
    await expect(enregistrerAvecReconciliation(initial, ecriture, null, envoyer, vi.fn().mockResolvedValue({ ...initial, revision: 2, categories: { ...initial.categories, recette: [] } }))).rejects.toThrow(/catégorie/);
  });
  it('ne réessaie jamais une erreur réseau et limite les conflits répétés', async () => {
    const reseau = vi.fn().mockRejectedValue(new Error('Réseau'));
    const charger = vi.fn().mockResolvedValue({ ...initial, revision: 2 });
    await expect(enregistrerAvecReconciliation(initial, ecriture, null, reseau, charger)).rejects.toThrow('Réseau');
    expect(charger).not.toHaveBeenCalled();
    const envoyer = vi.fn().mockRejectedValue(conflit);
    await expect(enregistrerAvecReconciliation(initial, ecriture, null, envoyer, charger)).rejects.toEqual(conflit);
    expect(envoyer).toHaveBeenCalledTimes(3);
  });
});
