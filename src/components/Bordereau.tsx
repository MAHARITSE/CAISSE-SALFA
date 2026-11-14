import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LigneJournal } from '../types';
import { dateFr } from '../utils/format';
import { sommeAriaryEnLettres } from '../utils/nombreEnLettres';
import { TITRE_DOCUMENT, type EnteteDocument } from '../utils/entete';
import { styleLigneEntete } from '../utils/style-entete';
import { formaterCompteBancaire } from './ChampCompteBancaire';

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
 * l'imprimé A4 fourni : 11,1 mm par ligne remplie. L'ensemble des lignes
 * remplies et du bloc vide mesure 130 mm (85 mm de réserve minimale pour un
 * virement, qui ajoute la ligne de banque et dont le tableau s'étire ensuite
 * en flex pour ancrer le pied au bas de la première page sans déborder). Le
 * bloc vide se réduit jusqu'à zéro sur les pièces détaillées pour préserver
 * la place des signatures et la marge inférieure de 15 mm, sans réduire ni
 * masquer les lignes remplies.
 */
const TABLEAU = { hauteurLigne: 11.1, lignesTotal: 130, lignesTotalVirement: 85, blocVideMinimum: 0 };

/**
 * Bandeau d'en-tête : sa hauteur suit les lignes de texte. Les images, elles,
 * se placent librement sur toute la feuille et ne pèsent pas sur la mise en page.
 */

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
      style={styleLigneEntete(ligne)}
    ><span>{ligne.texte}</span></p>)}
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
export function BordereauDocument({ ligne, entete, compteVirement }: { ligne: LigneJournal; entete: EnteteDocument; compteVirement?: { banque: string; numeroCompte: string } }) {
  const recette = ligne.sens === 'RECETTE';
  const details = ligne.lignesDetail?.length
    ? ligne.lignesDetail.map(d => ({ id: d.id, libelle: d.libelle, montant: d.montant, observation: d.reference ?? '' }))
    // Une pièce en montant unique occupe une seule ligne récapitulative.
    : [{ id: 'unique', libelle: ligne.libelle, montant: ligne.montant, observation: ligne.reference ?? '' }];
  const hauteurTableau = compteVirement ? TABLEAU.lignesTotalVirement : TABLEAU.lignesTotal;

  return <article className={`bordereau-document${compteVirement ? ' bordereau-document--virement' : ''} border border-slate-300 bg-white text-black`}>
    <div className="bordereau-contenu">
      <div className="bordereau-introduction">
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

        {/* Les deux documents portent leur titre, comme les états officiels :
            AUTORISATION DE RECETTES, DEMANDE D’ENGAGEMENT DE DÉPENSES (DED). */}
        <h3 className="bordereau-titre">{TITRE_DOCUMENT[recette ? 'recette' : 'depense']}</h3>

        <p className="bordereau-piece"><strong>Pièce n°{compteVirement ? ` ${ligne.numero}` : ""}</strong></p>
        {compteVirement && <p className="bordereau-ligne bordereau-ligne--virement"><strong>Virement bancaire :</strong> <span>{compteVirement.banque} · Compte {formaterCompteBancaire(compteVirement.numeroCompte) || 'non renseigné'}</span></p>}

        <p className="bordereau-ligne"><span className="bordereau-etiquette">DATE :</span>{' '}{dateFr(ligne.date)}</p>
        <p className="bordereau-ligne">
          <span className="bordereau-etiquette">Objet :</span>{' '}{ligne.libelle}{ligne.tiers ? ` — ${ligne.tiers}` : ''}
        </p>
      </div>

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
          {details.map((d, i) => <tr key={d.id} className="bordereau-ligne-poste">
            <td className="bordereau-cellule-numero">{i + 1}</td>
            <td className="bordereau-cellule-libelle">{d.libelle}</td>
            <td />
            <td className="bordereau-cellule-montant">{montantModele(d.montant)}</td>
            <td className="bordereau-cellule-observation">{d.observation}</td>
          </tr>)}
          {(() => {
            const hauteurVide = Math.max(TABLEAU.blocVideMinimum, hauteurTableau - details.length * TABLEAU.hauteurLigne);
            return <tr
              className={`bordereau-ligne-vide${hauteurVide === 0 ? ' bordereau-ligne-vide--nulle' : ''}`}
              aria-hidden="true"
            >
              <td><div className="bordereau-ligne-vide__reserve" style={{ height: `${hauteurVide}mm` }} /></td>
              <td />
              <td />
              <td />
              <td />
            </tr>;
          })()}
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
    </div>

    <footer className="bordereau-pied">
      <p className="bordereau-lettres"><span>Arrêté à la somme de{' '}
        <strong className="bordereau-lettres__montant">{sommeAriaryEnLettres(ligne.montant)}</strong>
      </span></p>

      <div
        className="bordereau-signatures"
        style={{ gridTemplateColumns: `repeat(${SIGNATURES[ligne.sens].length}, minmax(0, 1fr))` }}
      >
        {SIGNATURES[ligne.sens].map(titre => <div key={titre} className="bordereau-signature">
          <p className="bordereau-signature__titre">{titre}</p>
        </div>)}
      </div>
    </footer>
  </article>;
}

interface ModaleBordereauProps {
  ligne: LigneJournal;
  entete: EnteteDocument;
  onFermer: () => void;
  onErreur?: () => void;
  compteVirement?: { banque: string; numeroCompte: string };
}

/** Copie uniquement imprimable, sans écran d'aperçu intermédiaire. */
export function ModaleBordereau({ ligne, entete, onFermer, onErreur, compteVirement }: ModaleBordereauProps) {
  const callbacks = useRef({ onFermer, onErreur });
  callbacks.current = { onFermer, onErreur };
  useEffect(() => {
    document.body.classList.add('has-print-bordereau');
    let termine = false;
    let secours: ReturnType<typeof setTimeout> | undefined;
    const finir = (erreur: boolean) => {
      if (termine) return;
      termine = true;
      if (secours) clearTimeout(secours);
      if (erreur) callbacks.current.onErreur?.();
      callbacks.current.onFermer();
    };
    const apresImpression = () => finir(false);
    window.addEventListener('afterprint', apresImpression);
    const lancement = setTimeout(() => {
      try {
        window.print();
        // Certains navigateurs ne déclenchent pas afterprint quand ils bloquent
        // l'impression. Libérer le document pour ne pas bloquer le journal.
        if (!termine) secours = setTimeout(() => finir(true), 30000);
      } catch { finir(true); }
    }, 50);
    return () => {
      clearTimeout(lancement);
      if (secours) clearTimeout(secours);
      window.removeEventListener('afterprint', apresImpression);
      document.body.classList.remove('has-print-bordereau');
    };
  }, []);

  return createPortal(
    <div className="print-only print-bordereau">
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      <BordereauDocument ligne={ligne} entete={entete} compteVirement={compteVirement} />
    </div>, document.body,
  );
}
