export const formatAr = (montant: number): string =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(montant))} Ar`;

export const aujourdHui = (): string => new Date().toISOString().slice(0, 10);
