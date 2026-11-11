import type { DonneesCaisse, Ecriture, Sauvegarde } from '../types';

/** Compare les champs persistés, sans le solde calculé du journal. */
function contenu(e: Ecriture): string {
  return JSON.stringify({
    id: e.id, numero: e.numero, date: e.date, sens: e.sens, libelle: e.libelle,
    categorie: e.categorie, tiers: e.tiers || '', reference: e.reference || '',
    observation: e.observation || '', montant: e.montant,
    lignesDetail: (e.lignesDetail ?? []).map(l => ({ id: l.id, libelle: l.libelle, reference: l.reference || '', montant: l.montant })),
    createdAt: e.createdAt, updatedAt: e.updatedAt || '',
  });
}

/** Empêche la réécriture d'une pièce qui a changé ou disparu pendant la saisie. */
export function verifierContexteEcriture(actuel: DonneesCaisse, ecriture: Ecriture, originale: Ecriture | null): void {
  if (actuel.parametres.exercice !== Number(ecriture.date.slice(0, 4))) {
    throw new Error('L’exercice a changé depuis l’ouverture du formulaire. Votre saisie est conservée ; copiez-la si nécessaire puis rechargez le livre.');
  }
  const courante = actuel.ecritures.find(e => e.id === ecriture.id);
  if (originale) {
    if (!courante || contenu(courante) !== contenu(originale)) {
      throw new Error('Cette écriture a été modifiée ou supprimée par un autre utilisateur. Votre saisie est conservée : copiez-la si nécessaire, fermez le formulaire et rechargez le livre avant de comparer les changements.');
    }
  } else {
    if (courante || actuel.exercicesClotures.some(a => a.ecritures.some(e => e.id === ecriture.id))) {
      throw new Error('Une écriture avec cet identifiant existe déjà. Votre saisie est conservée ; rechargez le livre avant de continuer.');
    }
    const categories = ecriture.sens === 'RECETTE' ? actuel.categories.recette : actuel.categories.depense;
    if (!categories.includes(ecriture.categorie)) {
      throw new Error('La catégorie sélectionnée a changé. Votre saisie est conservée ; rechargez le livre et vérifiez la catégorie.');
    }
  }
}

/** Réessaie uniquement un conflit de révision confirmé, jamais une erreur réseau. */
export async function enregistrerAvecReconciliation(
  initial: Sauvegarde,
  ecriture: Ecriture,
  originale: Ecriture | null,
  envoyer: (revision: number, ecriture: Ecriture) => Promise<{ livre: Sauvegarde }>,
  charger: () => Promise<Sauvegarde>,
): Promise<Sauvegarde> {
  let revision = initial.revision;
  verifierContexteEcriture(initial, ecriture, originale);
  for (let tentative = 0; ; tentative++) {
    try { return (await envoyer(revision, ecriture)).livre; }
    catch (erreur) {
      if (!(erreur && typeof erreur === 'object' && 'code' in erreur && erreur.code === 'conflit_revision') || tentative >= 2) throw erreur;
      const actuel = await charger();
      verifierContexteEcriture(actuel, ecriture, originale);
      revision = actuel.revision;
    }
  }
}
