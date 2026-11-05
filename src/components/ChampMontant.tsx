import { useId, useState, type ChangeEvent } from 'react';
import { formatAr, parserMontant } from '../utils/format';

/** Espace insécable étroite : séparateur de milliers à la française. */
const SEPARATEUR = '\u202f';

/**
 * Met un montant saisi sous forme lisible : 1 234 567.
 * Les caractères non numériques sont ignorés, comme dans un masque de saisie.
 */
export function formaterSaisieMontant(saisie: string, autoriserNegatif = false): string {
  const negatif = autoriserNegatif && saisie.trimStart().startsWith('-');
  const chiffres = saisie.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const groupes = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR);
  return `${negatif ? '-' : ''}${groupes}`;
}

/** Position du curseur, exprimée en nombre de chiffres avant lui. */
function chiffresAvant(element: HTMLInputElement): number {
  const position = element.selectionStart ?? 0;
  return element.value.slice(0, position).replace(/\D/g, '').length;
}

/**
 * Champ monétaire en ariary : séparation des milliers pendant la frappe,
 * curseur stable, valeur exploitable par `parserMontant`.
 */
export function ChampMontant({ valeur, onChange, label, id, placeholder, obligatoire, autoFocus, className = '', aide, etiquetteSeule }: {
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
  className?: string;
  aide?: string;
}) {
  const auto = useId();
  const champId = id ?? auto;
  const [curseur, setCurseur] = useState<number | null>(null);

  const modifier = (e: ChangeEvent<HTMLInputElement>) => {
    const element = e.target;
    const avant = chiffresAvant(element);
    const formate = formaterSaisieMontant(element.value, false);
    onChange(formate);
    // Replace le curseur après le même nombre de chiffres, une fois la valeur rendue.
    if (formate.replace(/\D/g, '').length !== avant) setCurseur(avant);
  };

  return <>
    {label ? <label className="label" htmlFor={champId}>{label}</label> : null}
    <input
      id={champId}
      aria-label={label ? undefined : etiquetteSeule}
      className={`field text-right tabular-nums ${className}`}
      inputMode="numeric"
      autoComplete="off"
      value={valeur}
      placeholder={placeholder}
      required={obligatoire}
      autoFocus={autoFocus}
      onChange={modifier}
      ref={element => {
        if (!element || curseur === null) return;
        let position = 0;
        let chiffres = 0;
        while (position < element.value.length && chiffres < curseur) {
          if (/\d/.test(element.value[position])) chiffres++;
          position++;
        }
        element.setSelectionRange(position, position);
        setCurseur(null);
      }}
    />
    {aide && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]">{aide}</p>}
  </>;
}

/** Aperçu en toutes lettres du montant saisi, pour éviter les erreurs de zéro. */
export function apercuMontant(valeur: string): string {
  const montant = parserMontant(valeur);
  return montant === null ? '' : formatAr(montant);
}
