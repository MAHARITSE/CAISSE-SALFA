import { createPortal } from 'react-dom';
import { Printer, Settings2 } from 'lucide-react';
import type { LigneJournal } from '../types';
import { dateFr, formatAr } from '../utils/format';
import { montantEnLettres } from '../utils/nombreEnLettres';
import { numeroDocument, TITRE_DOCUMENT, type EnteteDocument } from '../utils/entete';
import { ApercuEntete } from './EnteteBordereauModal';
import { Modale } from './Modale';

/** Cases de signature, propres à chaque document. */
const SIGNATURES: Record<'RECETTE' | 'DEPENSE', string[]> = {
  RECETTE: ['Caissier(e)', 'Gestionnaire', 'Médecin Chef'],
  DEPENSE: ['Demandeur', 'Caissier(e)', 'Gestionnaire', 'Médecin Chef'],
};

/** Nombre de lignes du tableau, comme sur les imprimés à remplir à la main. */
const LIGNES_MINIMUM = 8;

/**
 * Document officiel imprimable : en-tête de l'hôpital, date, objet, tableau à
 * cinq colonnes (n°, libellé, n° compte, montant, observation), total, somme
 * en toutes lettres et cases de signature.
 */
export function BordereauDocument({ ligne, entete }: { ligne: LigneJournal; entete: EnteteDocument }) {
  const recette = ligne.sens === 'RECETTE';
  const details = ligne.lignesDetail?.length
    ? ligne.lignesDetail.map(d => ({ id: d.id, libelle: d.libelle, montant: d.montant, observation: d.reference ?? '' }))
    // Une pièce en montant unique occupe une seule ligne récapitulative.
    : [{ id: 'unique', libelle: ligne.libelle, montant: ligne.montant, observation: ligne.reference ?? '' }];
  const vides = Math.max(0, LIGNES_MINIMUM - details.length);

  return <article className="bordereau-document w-full max-w-full bg-white text-slate-900">
    <ApercuEntete entete={entete} compact />

    <h3 className="mb-6 mt-4 text-center text-sm font-bold uppercase tracking-wide underline">
      {TITRE_DOCUMENT[recette ? 'recette' : 'depense']}
    </h3>

    <div className="flex items-start justify-between gap-6 text-xs">
      <p><strong>DATE :</strong> {dateFr(ligne.date)}</p>
      <p className="text-right"><strong>Pièce n°</strong></p>
    </div>
    <p className="mb-3 mt-1 text-xs"><strong>Objet :</strong> {ligne.libelle}{ligne.tiers ? ` — ${ligne.tiers}` : ''}</p>

    <table className="w-full table-fixed border-collapse text-[11px]">
      <thead>
        <tr className="text-center align-middle">
          <th className="w-[7%] border border-slate-900 p-1 font-semibold">N°</th>
          <th className="border border-slate-900 p-1 font-semibold">Libellé</th>
          <th className="w-[15%] border border-slate-900 p-1 font-semibold">N° Compte</th>
          <th className="w-[17%] border border-slate-900 p-1 font-semibold">Montant</th>
          <th className="w-[17%] border border-slate-900 p-1 font-semibold">Observation</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => <tr key={d.id}>
          <td className="border border-slate-900 p-1 text-center align-top">{i + 1}</td>
          <td className="border border-slate-900 p-1 align-top font-medium">{d.libelle}</td>
          <td className="border border-slate-900 p-1 align-top" />
          <td className="border border-slate-900 p-1 text-right align-top tabular-nums">{formatAr(d.montant)}</td>
          <td className="border border-slate-900 p-1 align-top">{d.observation}</td>
        </tr>)}
        {Array.from({ length: vides }, (_, i) => <tr key={`vide-${i}`} className="bordereau-ligne-vide">
          <td className="border border-slate-900 p-1 text-center">&nbsp;</td>
          <td className="border border-slate-900 p-1" />
          <td className="border border-slate-900 p-1" />
          <td className="border border-slate-900 p-1" />
          <td className="border border-slate-900 p-1" />
        </tr>)}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="border border-slate-900 p-1 text-center font-bold uppercase">
            Total {recette ? 'des recettes' : 'des dépenses'}
          </td>
          <td className="border border-slate-900 p-1 text-right font-bold tabular-nums">{formatAr(ligne.montant)}</td>
          <td className="border border-slate-900 p-1" />
        </tr>
      </tfoot>
    </table>

    <p className="mt-4 text-[11px] italic">{montantEnLettres(ligne.montant)}</p>

    <div
      className="bordereau-signatures mt-6 border border-slate-900 text-center text-[11px]"
      style={{ gridTemplateColumns: `repeat(${SIGNATURES[ligne.sens].length}, minmax(0, 1fr))` }}
    >
      {SIGNATURES[ligne.sens].map(titre => <div key={titre} className="px-2 py-1">
        <p className="font-semibold underline">{titre}</p>
        <div className="h-16" />
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
      largeur="large"
      icone={<Printer size={21} />}
      onFermer={onFermer}
      pied={<div className="flex flex-wrap justify-end gap-2">
        {onModifierEntete && <button className="btn-secondary" onClick={onModifierEntete}><Settings2 size={16} />Modifier l’en-tête</button>}
        <button className="btn-secondary" onClick={onFermer}>Fermer</button>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} />Imprimer ce bordereau</button>
      </div>}
    >
      {imprimerDirectement && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        Écriture enregistrée. Vérifiez le bordereau puis cliquez sur « Imprimer ce bordereau ».
      </p>}
      <BordereauDocument ligne={ligne} entete={entete} />
    </Modale>
    {createPortal(<div className="print-only print-bordereau"><BordereauDocument ligne={ligne} entete={entete} /></div>, document.body)}
  </>;
}
