export const formatAr = (montant: number): string =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(montant))} Ar`;

export const nombre = (montant: number): string => new Intl.NumberFormat('fr-FR').format(Math.round(montant));

export const aujourdHui = (): string => new Date().toISOString().slice(0, 10);

export const moisCourant = (): string => new Date().toISOString().slice(0, 7);

export const dateFr = (iso: string): string => {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
};

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** '2026-11' -> 'novembre 2026' */
export const libelleMois = (mois: string): string => {
  const [annee, m] = mois.split('-');
  const index = Number(m) - 1;
  return MOIS[index] ? `${MOIS[index]} ${annee}` : mois;
};
