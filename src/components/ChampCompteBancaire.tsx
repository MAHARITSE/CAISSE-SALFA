import { useId, useState, type ChangeEvent } from 'react';

/** Masque de référence d'un RIB malgache : code banque (5), guichet (5), compte (11), clé (2). */
export const MASQUE_COMPTE_BANCAIRE = '00005 00041 43200100200 85';

/** Taille des quatre compartiments d'un RIB : 5 + 5 + 11 + 2 = 23 chiffres. */
export const GROUPES_COMPTE_BANCAIRE = [5, 5, 11, 2] as const;

const LONGUEUR_CHIFFRES_MAX = 23;
const LONGUEUR_MASQUE_MAX = 26;

/**
 * Applique le masque `00005 00041 43200100200 85` pendant la frappe ou le collage :
 * seuls les chiffres sont retenus (jusqu'à 23) et groupés en 5 - 5 - 11 - 2.
 */
export function formaterSaisieCompteBancaire(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, '').slice(0, LONGUEUR_CHIFFRES_MAX);
  if (!chiffres) return '';
  const morceaux: string[] = [];
  let debut = 0;
  for (const taille of GROUPES_COMPTE_BANCAIRE) {
    if (debut >= chiffres.length) break;
    morceaux.push(chiffres.slice(debut, debut + taille));
    debut += taille;
  }
  return morceaux.join(' ');
}

/**
 * Met en forme un numéro de compte ou RIB enregistré selon le masque
 * `00005 00041 43200100200 85`, tout en conservant intacte une ancienne référence libre.
 */
export function formaterCompteBancaire(texte?: string, codeBanqueDefaut?: string): string {
  const brut = (texte ?? '').trim();
  if (!brut) return '';
  if (!/^[\d\s.-]+$/.test(brut)) return brut;
  const compact = brut.replace(/\D/g, '');
  if (!compact) return '';
  const codeDefaut = (codeBanqueDefaut ?? '').trim();
  if (compact.length === 18 && /^\d{5}$/.test(codeDefaut)) {
    return formaterSaisieCompteBancaire(`${codeDefaut}${compact}`);
  }
  if (compact.length <= LONGUEUR_CHIFFRES_MAX) {
    return formaterSaisieCompteBancaire(compact);
  }
  return brut;
}

/** Position du curseur, exprimée en nombre de chiffres avant lui. */
function chiffresAvant(element: HTMLInputElement): number {
  const position = element.selectionStart ?? 0;
  return element.value.slice(0, position).replace(/\D/g, '').length;
}

/**
 * Champ de saisie d'un numéro de compte bancaire / RIB au format
 * `00005 00041 43200100200 85`, avec maintien de la position du curseur.
 */
export function ChampCompteBancaire({
  valeur,
  onChange,
  label,
  id,
  placeholder = MASQUE_COMPTE_BANCAIRE,
  obligatoire,
  autoFocus,
  className = '',
  aide,
  etiquetteSeule,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  label: string;
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
    const avant = Math.min(chiffresAvant(element), LONGUEUR_CHIFFRES_MAX);
    const formate = formaterSaisieCompteBancaire(element.value);
    onChange(formate);
    if (formate !== element.value) setCurseur(avant);
  };

  return <>
    {label ? <label className="label" htmlFor={champId}>{label}</label> : null}
    <input
      id={champId}
      aria-label={label ? undefined : etiquetteSeule}
      className={`field tabular-nums tracking-wide ${className}`}
      inputMode="numeric"
      autoComplete="off"
      maxLength={LONGUEUR_MASQUE_MAX}
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
