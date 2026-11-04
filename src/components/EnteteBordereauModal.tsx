import { useMemo, useRef, useState } from 'react';
import { FileImage, ImageMinus, ImagePlus, RotateCcw, Type } from 'lucide-react';
import { Modale } from './Modale';
import {
  LIBELLES_LIGNES, MAX_LOGO_OCTETS, MAX_IMAGE_OCTETS, TITRE_DOCUMENT,
  enteteParDefaut, lireImageEntete, normaliserEntetes,
  type DocumentEntete, type EnteteDocument, type EntetesDocuments,
} from '../utils/entete';

interface EnteteBordereauModalProps {
  entetes: EntetesDocuments;
  /** Document ouvert à l'affichage. */
  document: DocumentEntete;
  onChangerDocument: (document: DocumentEntete) => void;
  onEnregistrer: (document: DocumentEntete, entete: EnteteDocument) => void;
  onFermer: () => void;
}

const ONGLETS: Array<{ cle: DocumentEntete; libelle: string }> = [
  { cle: 'depense', libelle: 'Engagement de dépense' },
  { cle: 'recette', libelle: 'Autorisation de recette' },
];

/** Reçoit un fichier image et renvoie la data URL validée, ou un message lisible. */
function useTeleversement() {
  const [erreur, setErreur] = useState('');
  const [charge, setCharge] = useState(false);
  const lire = async (fichier: File | undefined, limite: number): Promise<string | null> => {
    if (!fichier) return null;
    setErreur('');
    setCharge(true);
    try {
      return await lireImageEntete(fichier, limite);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Image illisible.');
      return null;
    } finally {
      setCharge(false);
    }
  };
  return { erreur, charge, lire, setErreur };
}

export function EnteteBordereauModal({ entetes, document, onChangerDocument, onEnregistrer, onFermer }: EnteteBordereauModalProps) {
  const [brouillon, setBrouillon] = useState<EntetesDocuments>(() => normaliserEntetes(entetes));
  const [erreur, setErreur] = useState('');
  const champImage = useRef<HTMLInputElement>(null);
  const champLogoGauche = useRef<HTMLInputElement>(null);
  const champLogoDroit = useRef<HTMLInputElement>(null);
  const televersement = useTeleversement();
  const courant = brouillon[document];

  const modifier = (changements: Partial<EnteteDocument>) => {
    setErreur('');
    setBrouillon(etat => ({ ...etat, [document]: { ...etat[document], ...changements } }));
  };

  const modifierLigne = (index: number, texte: string) => {
    const lignes = courant.lignes.map((ligne, i) => i === index ? { ...ligne, texte } : ligne);
    modifier({ lignes });
  };

  const restaurer = () => {
    setErreur('');
    setBrouillon(etat => ({ ...etat, [document]: enteteParDefaut(document) }));
    if (champImage.current) champImage.current.value = '';
    if (champLogoGauche.current) champLogoGauche.current.value = '';
    if (champLogoDroit.current) champLogoDroit.current.value = '';
  };

  const enregistrer = () => {
    const propre = brouillon[document];
    const vide = propre.mode === 'image'
      ? propre.image === ''
      : !propre.lignes.some(ligne => ligne.texte.trim() !== '');
    if (vide) {
      setErreur(propre.mode === 'image'
        ? 'Choisissez l’image de l’en-tête avant d’enregistrer.'
        : 'Renseignez au moins une ligne de texte avant d’enregistrer.');
      return;
    }
    onEnregistrer(document, propre);
  };

  const messageErreur = erreur || televersement.erreur;

  return <Modale
    titre="En-tête des bordereaux"
    sousTitre="Chaque document garde son propre en-tête. La modification est enregistrée avec le livre."
    largeur="large"
    icone={<FileImage size={21} />}
    onFermer={onFermer}
    pied={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onFermer}>Annuler</button>
      <button type="button" className="btn-primary" onClick={enregistrer} disabled={televersement.charge}>Enregistrer l’en-tête</button>
    </div>}
  >
    <div className="space-y-5">
      <div role="tablist" aria-label="Document à personnaliser" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {ONGLETS.map(onglet => <button
          key={onglet.cle}
          type="button"
          role="tab"
          aria-selected={onglet.cle === document}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${onglet.cle === document ? 'bg-white text-brand-800 shadow-xs' : 'text-slate-600 hover:text-brand-700'}`}
          onClick={() => { setErreur(''); onChangerDocument(onglet.cle); }}
        >{onglet.libelle}</button>)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-xs ${courant.mode === 'textes' ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200'}`}>
          <input type="radio" name="mode-entete" className="mt-0.5" checked={courant.mode === 'textes'} onChange={() => modifier({ mode: 'textes' })} />
          <span><Type size={15} className="mb-1 text-brand-700" /><strong className="block">Textes et logos</strong><span className="text-slate-500">Titres, coordonnées, NIF et logos, mis en page par la caisse.</span></span>
        </label>
        <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-xs ${courant.mode === 'image' ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200'}`}>
          <input type="radio" name="mode-entete" className="mt-0.5" checked={courant.mode === 'image'} onChange={() => modifier({ mode: 'image' })} />
          <span><FileImage size={15} className="mb-1 text-brand-700" /><strong className="block">Image complète</strong><span className="text-slate-500">Une image PNG ou JPEG préparée à l’avance remplace tout l’en-tête.</span></span>
        </label>
      </div>

      {courant.mode === 'image'
        ? <section className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700">Image de l’en-tête · {TITRE_DOCUMENT[document]}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">PNG ou JPEG, 1 Mo maximum. Prévoyez une image large : elle occupe toute la largeur de la page.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={champImage} type="file" accept="image/png,image/jpeg" className="sr-only" id="entete-image" onChange={async e => {
              const data = await televersement.lire(e.target.files?.[0], MAX_IMAGE_OCTETS);
              if (data) modifier({ image: data });
            }} />
            <label htmlFor="entete-image" className="btn-secondary cursor-pointer"><ImagePlus size={15} />{courant.image ? 'Remplacer l’image' : 'Choisir une image'}</label>
            {courant.image && <button type="button" className="btn-secondary" onClick={() => { modifier({ image: '' }); if (champImage.current) champImage.current.value = ''; }}><ImageMinus size={15} />Retirer</button>}
          </div>
        </section>
        : <section className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold text-slate-700">Lignes de l’en-tête · {TITRE_DOCUMENT[document]}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Les lignes vides ne sont pas imprimées. La première ligne est mise en valeur.</p>
            <div className="mt-3 space-y-2">
              {courant.lignes.map((ligne, index) => <div key={index}>
                <label htmlFor={`ligne-${index}`} className="text-[10px] uppercase tracking-wide text-slate-400">{LIBELLES_LIGNES[index] ?? `Ligne ${index + 1}`}</label>
                <input
                  id={`ligne-${index}`}
                  className="input"
                  value={ligne.texte}
                  maxLength={200}
                  onChange={e => modifierLigne(index, e.target.value)}
                  placeholder="Laisser vide pour ne rien imprimer"
                />
              </div>)}
            </div>
          </div>
          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {([['logoGauche', 'Logo de gauche', champLogoGauche], ['logoDroit', 'Logo de droite', champLogoDroit]] as const).map(([cle, libelle, ref]) => <div key={cle}>
              <p className="text-xs font-semibold text-slate-700">{libelle}</p>
              <p className="text-[10px] text-slate-500">Optionnel · PNG ou JPEG, 300 Ko maximum.</p>
              <div className="mt-2 flex items-center gap-2">
                {courant[cle] && <img src={courant[cle]} alt="" className="h-10 w-10 rounded border border-slate-200 bg-white object-contain p-0.5" />}
                <input ref={ref} type="file" accept="image/png,image/jpeg" className="sr-only" id={`entete-${cle}`} onChange={async e => {
                  const data = await televersement.lire(e.target.files?.[0], MAX_LOGO_OCTETS);
                  if (data) modifier({ [cle]: data });
                }} />
                <label htmlFor={`entete-${cle}`} className="btn-secondary cursor-pointer text-[11px]"><ImagePlus size={14} />{courant[cle] ? 'Remplacer' : 'Choisir'}</label>
                {courant[cle] && <button type="button" className="text-[11px] font-medium text-rose-600 hover:underline" onClick={() => { modifier({ [cle]: '' }); if (ref.current) ref.current.value = ''; }}>Retirer</button>}
              </div>
            </div>)}
          </div>
        </section>}

      {messageErreur && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{messageErreur}</p>}

      <section aria-label="Aperçu de l’en-tête">
        <p className="mb-2 text-xs font-semibold text-slate-700">Aperçu</p>
        <ApercuEntete entete={courant} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-[11px] text-slate-500">Le bouton « Restaurer » revient à l’en-tête livré avec la caisse, pour ce document uniquement.</p>
        <button type="button" className="btn-secondary" onClick={restaurer}><RotateCcw size={15} />Restaurer l’en-tête fourni</button>
      </div>
    </div>
  </Modale>;
}

/** Représentation fidèle de l'en-tête tel qu'il sortira à l'impression. */
export function ApercuEntete({ entete, compact = false }: { entete: EnteteDocument; compact?: boolean }) {
  const lignes = useMemo(() => entete.lignes.filter(ligne => ligne.texte.trim() !== ''), [entete.lignes]);
  return <div className={`entete-bordereau ${compact ? 'entete-bordereau--compact' : ''}`}>
    {entete.mode === 'image'
      ? entete.image
        ? <img src={entete.image} alt="En-tête fourni" className="entete-bordereau__image" />
        : <p className="entete-bordereau__vide">Aucune image choisie : l’en-tête livré reste utilisé jusqu’à l’enregistrement.</p>
      : <>
        <div className="entete-bordereau__logos">
          {entete.logoGauche ? <img src={entete.logoGauche} alt="Logo de gauche" /> : <span aria-hidden="true" />}
          {entete.logoDroit ? <img src={entete.logoDroit} alt="Logo de droite" /> : <span aria-hidden="true" />}
        </div>
        <div className="entete-bordereau__textes">
          {lignes.length
            ? lignes.map((ligne, index) => (
              /* La taille de l'éditeur est en points : elle vaut aussi à l'impression. */
              <p
                key={index}
                className={ligne.gras ? 'entete-bordereau__titre' : ''}
                style={{ fontSize: `${ligne.taille}pt` }}
              >{ligne.texte}</p>
            ))
            : <p className="entete-bordereau__vide">Aucune ligne renseignée.</p>}
        </div>
      </>}
  </div>;
}
