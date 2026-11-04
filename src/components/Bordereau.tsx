import { createPortal } from 'react-dom';
import { Printer, Settings2 } from 'lucide-react';
import type { LigneJournal } from '../types';
import { dateFr, formatAr, nombre } from '../utils/format';
import { TITRE_DOCUMENT, type EnteteDocument } from '../utils/entete';
import { ApercuEntete } from './EnteteBordereauModal';
import { Modale } from './Modale';

/** Document imprimable : en-tête personnalisé, postes, total et signatures. */
export function BordereauDocument({ ligne, entete }: { ligne: LigneJournal; entete: EnteteDocument }) {
  const recette = ligne.sens === 'RECETTE';
  return <article className="bordereau-document bg-white text-slate-900">
    <header className="bordereau-entete border-b-2 border-slate-800 pb-3">
      <ApercuEntete entete={entete} compact />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-base font-bold uppercase">{TITRE_DOCUMENT[recette ? 'recette' : 'depense']}</h3>
        <p className="font-mono text-sm">{ligne.numero}</p>
      </div>
    </header>
    <div className="my-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3"><div><span className="label">Date de l’opération</span><p className="font-semibold">{dateFr(ligne.date)}</p></div><div><span className="label">Service / tiers</span><p className="font-semibold break-words">{ligne.tiers || 'Caisse principale'}</p></div><div><span className="label">Mode de paiement</span><p className="font-semibold">Espèces</p></div></div>
    <p className="mb-3 text-sm font-semibold">{ligne.libelle}</p>
    {(ligne.reference || ligne.observation) && <div className="mb-4 space-y-1 text-xs"><p>{ligne.reference && <><strong>Référence : </strong>{ligne.reference}</>}</p><p className="whitespace-pre-wrap">{ligne.observation && <><strong>Observation : </strong>{ligne.observation}</>}</p></div>}
    <table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100 text-left"><th className="border border-slate-400 p-2 w-10">N°</th><th className="border border-slate-400 p-2">Désignation / service</th><th className="border border-slate-400 p-2">Référence / quittance</th><th className="border border-slate-400 p-2 text-right">Montant (MGA)</th></tr></thead><tbody>{ligne.lignesDetail?.map((d, i) => <tr key={d.id}><td className="border border-slate-300 p-2 text-center">{i + 1}</td><td className="border border-slate-300 p-2 font-medium">{d.libelle}</td><td className="border border-slate-300 p-2 font-mono">{d.reference || '—'}</td><td className="border border-slate-300 p-2 text-right tabular-nums">{nombre(d.montant)}</td></tr>)}</tbody><tfoot><tr className="bg-slate-100 font-bold"><td colSpan={3} className="border border-slate-400 p-3 uppercase">Total {recette ? 'des recettes' : 'des dépenses'}</td><td className="border border-slate-400 p-3 text-right tabular-nums">{formatAr(ligne.montant)}</td></tr></tfoot></table>
    <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs"><div className="min-h-24 border border-dashed border-slate-400 p-3"><p className="font-semibold">Le caissier</p><p className="mt-1 text-slate-500">Signature & date</p></div><div className="min-h-24 border border-dashed border-slate-400 p-3"><p className="font-semibold">Le trésorier / responsable</p><p className="mt-1 text-slate-500">Visa & approbation</p></div></div>
    <p className="mt-5 text-[10px] text-slate-500">Document établi depuis le livre journal · {ligne.numero} · Montants en ariary (MGA)</p>
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
      sousTitre={`${ligne.numero} · ${dateFr(ligne.date)}`}
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
