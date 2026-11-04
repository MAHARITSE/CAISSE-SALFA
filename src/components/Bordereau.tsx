import { createPortal } from 'react-dom';
import { Printer, Settings2 } from 'lucide-react';
import type { LigneJournal } from '../types';
import { dateFr } from '../utils/format';
import { montantEnLettres } from '../utils/nombreEnLettres';
import { numeroDocument, TITRE_DOCUMENT, type EnteteDocument } from '../utils/entete';
import { Modale } from './Modale';

/** Cases de signature, propres à chaque document. */
const SIGNATURES: Record<'RECETTE' | 'DEPENSE', string[]> = {
  RECETTE: ['Caissier(e)', 'Gestionnaire', 'Médecin Chef'],
  DEPENSE: ['Demandeur', 'Caissier(e)', 'Gestionnaire', 'Médecin Chef'],
};

/**
 * Le modèle ne découpe pas les lignes laissées vides : elles forment un seul
 * bloc sous les lignes remplies.
 *
 * Le bloc occupe la place restante, de sorte que le tableau garde toujours la
 * même hauteur quelle que soit la taille de la pièce. Cotes relevées sur
 * l'imprimé A4 fourni : 11,5 mm par ligne remplie et 133,6 mm pour l'ensemble
 * des lignes remplies et du bloc vide.
 */
const TABLEAU = { hauteurLigne: 11.1, lignesTotal: 132.9, blocVideMinimum: 12 };

/**
 * Bandeau d'en-tête : sa hauteur suit les lignes de texte. Les images, elles,
 * se placent librement sur toute la feuille et ne pèsent pas sur la mise en page.
 */

/** Alignement du modèle → valeur CSS. */
const ALIGNEMENT_CSS = { gauche: 'left', centre: 'center', droite: 'right' } as const;

/** Montant du modèle officiel : séparateur de milliers insécable et deux décimales. */
function montantModele(montant: number): string {
  const [entier, decimales] = montant.toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')},${decimales}`;
}

/**
 * Groupe typographique de l'en-tête : chaque ligne garde police, taille, style
 * et alignement, comme dans un traitement de texte.
 */
function LignesEntete({ entete }: { entete: EnteteDocument }) {
  const lignes = entete.lignes.filter(ligne => ligne.texte.trim() !== '');
  if (!lignes.length) return <p className="entete-bordereau__vide">Aucune ligne renseignée.</p>;
  return <>
    {lignes.map((ligne, index) => <p
      key={index}
      className="bordereau-ligne-entete"
      style={{
        fontFamily: `'${ligne.police}', sans-serif`,
        fontSize: `${ligne.taille}pt`,
        fontWeight: ligne.gras ? 700 : 400,
        fontStyle: ligne.italique ? 'italic' : 'normal',
        textDecoration: ligne.souligne ? 'underline' : 'none',
        textAlign: ALIGNEMENT_CSS[ligne.alignement],
      }}
    >{ligne.texte}</p>)}
  </>;
}

/**
 * Document officiel imprimable : page A4 portrait, en-tête de l'hôpital, titre,
 * date, objet, tableau à cinq colonnes, total, somme en toutes lettres et cases
 * de signature.
 *
 * Les proportions sont celles relevées sur les imprimés fournis, mesurées en
 * millimètres sur une page A4 : marges de 7,6 mm, colonnes du tableau
 * 11,2 / 87,0 / 22,0 / 35,9 / 41,5 mm, lignes de 11,6 mm, cases de signature
 * pleine largeur (65,5 mm pour trois signataires, 49,4 mm pour quatre).
 */
export function BordereauDocument({ ligne, entete }: { ligne: LigneJournal; entete: EnteteDocument }) {
  const recette = ligne.sens === 'RECETTE';
  const details = ligne.lignesDetail?.length
    ? ligne.lignesDetail.map(d => ({ id: d.id, libelle: d.libelle, montant: d.montant, observation: d.reference ?? '' }))
    // Une pièce en montant unique occupe une seule ligne récapitulative.
    : [{ id: 'unique', libelle: ligne.libelle, montant: ligne.montant, observation: ligne.reference ?? '' }];

  return <article className="bordereau-document border border-slate-300 bg-white text-black">
    {/* Les images se posent sur la feuille entière, hors du flux du document. */}
    <header className="bordereau-entete">
      {entete.mode === 'image' && entete.image
        ? <img src={entete.image} alt="En-tête fourni" className="bordereau-entete__image" />
        : <>
          <div className="bordereau-entete__textes"><LignesEntete entete={entete} /></div>
          {entete.images.filter(image => image.source).map(image => <img
            key={image.id}
            src={image.source}
            alt={image.alt}
            className="bordereau-entete__image-libre"
            /* Coordonnées converties depuis le haut de la feuille vers le bandeau. */
            style={{
              left: `${image.x}mm`,
              top: `${image.y}mm`,
              width: `${image.largeur}mm`,
            }}
          />)}
        </>}
    </header>

    {/* Sur les imprimés fournis, l'autorisation de recette porte un titre et la
        demande d'engagement n'en a pas : l'objet la désigne déjà. */}
    {recette && <h3 className="bordereau-titre">{TITRE_DOCUMENT.recette}</h3>}

    <p className="bordereau-piece"><strong>Pièce n°</strong></p>

    <p className="bordereau-ligne"><span className="bordereau-etiquette">DATE :</span>{' '}{dateFr(ligne.date)}</p>
    <p className="bordereau-ligne">
      <span className="bordereau-etiquette">Objet :</span>{' '}{ligne.libelle}{ligne.tiers ? ` — ${ligne.tiers}` : ''}
    </p>

    <table className="bordereau-table">
      <colgroup>
        <col className="col-numero" />
        <col className="col-libelle" />
        <col className="col-compte" />
        <col className="col-montant" />
        <col className="col-observation" />
      </colgroup>
      <thead>
        <tr>
          <th>N°</th>
          <th>Libellé</th>
          <th>N° Compte</th>
          <th>Montant</th>
          <th>Observation</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => <tr key={d.id}>
          <td className="bordereau-cellule-numero">{i + 1}</td>
          <td className="bordereau-cellule-libelle">{d.libelle}</td>
          <td />
          <td className="bordereau-cellule-montant">{montantModele(d.montant)}</td>
          <td className="bordereau-cellule-observation">{d.observation}</td>
        </tr>)}
        <tr
          className="bordereau-ligne-vide"
          aria-hidden="true"
          style={{ height: `${Math.max(TABLEAU.blocVideMinimum, TABLEAU.lignesTotal - details.length * TABLEAU.hauteurLigne)}mm` }}
        >
          <td />
          <td />
          <td />
          <td />
          <td />
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="bordereau-total-libelle">
            TOTAL DES {recette ? 'RECETTES' : 'DEPENSES'}
          </td>
          <td className="bordereau-cellule-montant bordereau-total-montant">{montantModele(ligne.montant)}</td>
          <td />
        </tr>
      </tfoot>
    </table>

    <p className="bordereau-lettres">{montantEnLettres(ligne.montant)}</p>

    <div
      className="bordereau-signatures"
      style={{ gridTemplateColumns: `repeat(${SIGNATURES[ligne.sens].length}, minmax(0, 1fr))` }}
    >
      {SIGNATURES[ligne.sens].map(titre => <div key={titre} className="bordereau-signature">
        <p className="bordereau-signature__titre">{titre}</p>
      </div>)}
    </div>
  </article>;
}

interface ModaleBordereauProps {
  ligne: LigneJournal;
  entete: EnteteDocument;
  /** Absent : le bouton « Modifier l'en-tête » est masqué. */
  onModifierEntete?: () => void;
  onFermer: () => void;
  /** Juste après un enregistrement : l'intention d'imprimer est annoncée. */
  imprimerDirectement?: boolean;
}

/**
 * Bordereau dans une boîte de dialogue, avec une copie réservée à l'impression.
 * La copie n'est montée qu'à l'ouverture de la modale : `window.print()`
 * n'imprime donc que ce bordereau, jamais le journal affiché derrière.
 */
export function ModaleBordereau({ ligne, entete, onModifierEntete, onFermer, imprimerDirectement = false }: ModaleBordereauProps) {
  return <>
    <Modale
      titre="Bordereau imprimable"
      sousTitre={`${numeroDocument(ligne.numero) ?? ligne.numero} · Pièce ${ligne.numero} · ${dateFr(ligne.date)}`}
      largeur="document"
      icone={<Printer size={21} />}
      onFermer={onFermer}
      pied={<div className="flex flex-wrap justify-end gap-2">
        {onModifierEntete && <button className="btn-secondary" onClick={onModifierEntete}><Settings2 size={16} />Modifier l’en-tête</button>}
        <button className="btn-secondary" onClick={onFermer}>Fermer</button>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} />Imprimer ce bordereau</button>
      </div>}
    >
      {imprimerDirectement && <p role="status" className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 print:hidden">
        Écriture enregistrée. Vérifiez le bordereau puis cliquez sur « Imprimer ce bordereau ».
      </p>}
      {/* À l'écran : une feuille A4 réellement au format, réduite si la fenêtre est étroite. */}
      <div className="bordereau-apercu">
        <BordereauDocument ligne={ligne} entete={entete} />
      </div>
    </Modale>

    {createPortal(
      <div className="print-only print-bordereau">
        <BordereauDocument ligne={ligne} entete={entete} />
      </div>,
      document.body,
    )}
  </>;
}
