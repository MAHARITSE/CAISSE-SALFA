import { useId, useState, type ChangeEvent } from 'react';
import { formatAr, parserMontant, parserMontantDecimal } from '../utils/format';

/** Espace insécable étroite : séparateur de milliers à la française. */
const SEPARATEUR = '\u202f';

/**
 * Met un montant saisi sous forme lisible : `1 234 567` (ou `1 234 567,89`
 * lorsque `autoriserDecimales` est activé pour les virements bancaires).
 */
export function formaterSaisieMontant(
  saisie: string,
  autoriserNegatif = false,
  autoriserDecimales = false,
): string {
  const negatif = autoriserNegatif && saisie.trimStart().startsWith('-');
  if (!autoriserDecimales) {
    const chiffres = saisie.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const groupes = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR);
    return `${negatif ? '-' : ''}${groupes}`;
  }

  const indexSep = saisie.search(/[.,]/);
  const brutEntier = indexSep === -1 ? saisie : saisie.slice(0, indexSep);
  const brutDecimales = indexSep === -1 ? '' : saisie.slice(indexSep + 1);
  const chiffresEntiers = brutEntier.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const chiffresDecimales = brutDecimales.replace(/\D/g, '').slice(0, 2);

  if (indexSep === -1) {
    const groupes = chiffresEntiers.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR);
    return `${negatif ? '-' : ''}${groupes}`;
  }
  const entierAffiche = (chiffresEntiers || '0').replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR);
  return `${negatif ? '-' : ''}${entierAffiche},${chiffresDecimales}`;
}

/** Formate un montant numérique avec exactement deux chiffres après la virgule. */
export function formaterMontantDecimal(montant: number): string {
  const [entier, decimales] = montant.toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR)},${decimales}`;
}

/** Normalise une saisie décimale à deux chiffres après la virgule à la sortie du champ. */
export function normaliserMontantDecimal(saisie: string): string {
  const montant = parserMontantDecimal(saisie);
  return montant === null ? saisie : formaterMontantDecimal(montant);
}

/** Position du curseur exprimée en jetons significatifs (chiffres et virgule décimale). */
function jetonsAvant(element: HTMLInputElement, autoriserDecimales: boolean): number {
  const position = element.selectionStart ?? 0;
  const prefixe = element.value.slice(0, position);
  if (!autoriserDecimales) return prefixe.replace(/\D/g, '').length;

  let jetons = 0;
  let vuSeparateur = false;
  let vuChiffreAvantSep = false;
  for (const ch of prefixe) {
    if (/\d/.test(ch)) {
      jetons++;
      if (!vuSeparateur) vuChiffreAvantSep = true;
    } else if (!vuSeparateur && (ch === ',' || ch === '.')) {
      vuSeparateur = true;
      if (!vuChiffreAvantSep) jetons++;
      jetons++;
    }
  }
  return jetons;
}

/**
 * Champ monétaire en ariary : séparation des milliers pendant la frappe,
 * curseur stable, valeur exploitable par `parserMontant` (ou `parserMontantDecimal`
 * avec deux chiffres après la virgule lorsque `autoriserDecimales` est actif).
 */
export function ChampMontant({
  valeur,
  onChange,
  label,
  id,
  placeholder,
  obligatoire,
  autoFocus,
  autoriserDecimales = false,
  className = '',
  aide,
  etiquetteSeule,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  /** Libellé visible ; vide dans un tableau, où `etiquetteSeule` prend le relais. */
  label: string;
  /** Nom accessible quand aucun libellé visible n'est affiché. */
  etiquetteSeule?: string;
  id?: string;
  placeholder?: string;
  obligatoire?: boolean;
  autoFocus?: boolean;
  /** Autorise jusqu'à deux chiffres après la virgule (virements bancaires). */
  autoriserDecimales?: boolean;
  className?: string;
  aide?: string;
}) {
  const auto = useId();
  const champId = id ?? auto;
  const [curseur, setCurseur] = useState<number | null>(null);

  const modifier = (e: ChangeEvent<HTMLInputElement>) => {
    const element = e.target;
    const avant = jetonsAvant(element, autoriserDecimales);
    const formate = formaterSaisieMontant(element.value, false, autoriserDecimales);
    onChange(formate);
    if (formate !== element.value) setCurseur(avant);
  };

  return <>
    {label ? <label className="label" htmlFor={champId}>{label}</label> : null}
    <input
      id={champId}
      aria-label={label ? undefined : etiquetteSeule}
      className={`field text-right tabular-nums ${className}`}
      inputMode={autoriserDecimales ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={valeur}
      placeholder={placeholder}
      required={obligatoire}
      autoFocus={autoFocus}
      onChange={modifier}
      onBlur={() => {
        if (!autoriserDecimales || !valeur.trim()) return;
        const normalise = normaliserMontantDecimal(valeur);
        if (normalise !== valeur) onChange(normalise);
      }}
      ref={element => {
        if (!element || curseur === null) return;
        let position = 0;
        let jetons = 0;
        while (position < element.value.length && jetons < curseur) {
          const ch = element.value[position];
          if (/\d/.test(ch) || (autoriserDecimales && ch === ',')) jetons++;
          position++;
        }
        element.setSelectionRange(position, position);
        setCurseur(null);
      }}
    />
    {aide && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]">{aide}</p>}
  </>;
}

/** Aperçu formaté du montant saisi, pour éviter les erreurs de zéro. */
export function apercuMontant(valeur: string, autoriserDecimales = false): string {
  const montant = autoriserDecimales ? parserMontantDecimal(valeur) : parserMontant(valeur);
  return montant === null ? '' : formatAr(montant);
}
