import { useCallback, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, FileImage, GripVertical, ImageMinus, ImagePlus,
  Italic, RotateCcw, Trash2, Underline, Type,
} from 'lucide-react';
import { Modale } from './Modale';
import {
  LIBELLES_LIGNES, MAX_IMAGE_OCTETS, MAX_IMAGES_ENTETE, MAX_LIGNES_ENTETE, MAX_LOGO_OCTETS, POLICES,
  enteteParDefaut, lireImageEntete, normaliserEntetes,
  type EnteteDocument, type EntetesDocuments, type ImageEntete, type LigneEntete,
} from '../utils/entete';

interface EnteteBordereauModalProps {
  /** En-tête commun aux deux imprimés. */
  entetes: EntetesDocuments;
  onEnregistrer: (entete: EnteteDocument) => void;
  onFermer: () => void;
}

/** Feuille A4 en millimètres : référence des positions des images. */
const FEUILLE = { largeur: 210, hauteur: 297 };
const BANDEAU = { hauteur: 38 };
/** Position du bandeau dans l'aperçu, en mm, depuis le haut de la feuille. */
const HAUT_BANDEAU = 6;

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

const arrondi = (valeur: number): number => Math.round(valeur * 10) / 10;

/** Alignement du modèle → valeur CSS. */
const ALIGNEMENT_CSS = { gauche: 'left', centre: 'center', droite: 'right' } as const;
const borner = (valeur: number, min: number, max: number): number => Math.min(max, Math.max(min, valeur));

/** Bouton de la barre de mise en forme. */
function BoutonFormat({ actif, titre, onClick, children }: {
  actif?: boolean; titre: string; onClick: () => void; children: React.ReactNode;
}) {
  return <button
    type="button"
    title={titre}
    aria-label={titre}
    aria-pressed={actif ? true : undefined}
    onClick={onClick}
    className={`inline-flex size-7 items-center justify-center rounded border text-slate-700 ${actif ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
  >{children}</button>;
}

export function EnteteBordereauModal({ entetes, onEnregistrer, onFermer }: EnteteBordereauModalProps) {
  const [brouillon, setBrouillon] = useState<EnteteDocument>(() => normaliserEntetes(entetes));
  const [erreur, setErreur] = useState('');
  const [ligneActive, setLigneActive] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const champImage = useRef<HTMLInputElement>(null);
  const champFond = useRef<HTMLInputElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const televersement = useTeleversement();

  const modifier = (changements: Partial<EnteteDocument>) => {
    setErreur('');
    setBrouillon(etat => ({ ...etat, ...changements }));
  };

  const modifierLigne = (index: number, changements: Partial<LigneEntete>) => {
    modifier({ lignes: brouillon.lignes.map((l, i) => i === index ? { ...l, ...changements } : l) });
  };

  const ajouterLigne = () => {
    if (brouillon.lignes.length >= MAX_LIGNES_ENTETE) return;
    const precedente = brouillon.lignes[brouillon.lignes.length - 1];
    modifier({
      lignes: [...brouillon.lignes, {
        texte: '', gras: false, taille: precedente?.taille ?? 9, police: precedente?.police ?? 'Arial',
        italique: false, souligne: false, alignement: precedente?.alignement ?? 'centre',
      }],
    });
    setLigneActive(brouillon.lignes.length);
  };

  const supprimerLigne = (index: number) => {
    if (brouillon.lignes.length <= 1) return;
    modifier({ lignes: brouillon.lignes.filter((_, i) => i !== index) });
    setLigneActive(Math.max(0, index - 1));
  };

  const deplacerLigne = (index: number, sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= brouillon.lignes.length) return;
    const lignes = [...brouillon.lignes];
    [lignes[index], lignes[cible]] = [lignes[cible], lignes[index]];
    modifier({ lignes });
    setLigneActive(cible);
  };

  const ajouterImage = useCallback((source: string, alt: string) => {
    setBrouillon(etat => {
      if (etat.images.length >= MAX_IMAGES_ENTETE) return etat;
      const rang = etat.images.length;
      const image: ImageEntete = {
        id: `image-${Date.now()}-${rang}`,
        source,
        alt,
        // Déposée au centre du bandeau, l'utilisateur la glisse ensuite où il veut.
        x: arrondi(90),
        y: arrondi(HAUT_BANDEAU + 8 + rang * 4),
        largeur: 18,
      };
      return { ...etat, images: [...etat.images, image] };
    });
  }, []);

  const modifierImage = (id: string, changements: Partial<ImageEntete>) => {
    setBrouillon(etat => ({
      ...etat,
      images: etat.images.map(image => image.id === id ? { ...image, ...changements } : image),
    }));
  };

  const retirerImage = (id: string) => {
    setBrouillon(etat => ({ ...etat, images: etat.images.filter(image => image.id !== id) }));
    setSelection(null);
  };

  /** Glisser une image au doigt ou à la souris : la position suit le curseur. */
  const deplacerImage = (id: string) => (evenement: React.PointerEvent<HTMLImageElement>) => {
    evenement.preventDefault();
    evenement.stopPropagation();
    // La sélection est immédiate : elle ouvre le réglage au millimètre.
    setSelection(id);
    const cadre = feuille.current?.getBoundingClientRect();
    const image = brouillon.images.find(i => i.id === id);
    // Sans mesure (feuille non montée), on garde la sélection sans déplacement.
    if (!cadre || !image || cadre.width === 0) return;
    const mmParPixel = FEUILLE.largeur / cadre.width;
    const depart = { x: evenement.clientX, y: evenement.clientY, ox: image.x, oy: image.y };
    try {
      evenement.currentTarget.setPointerCapture(evenement.pointerId);
    } catch {
      // Certains navigateurs (et les tests) n'implémentent pas la capture :
      // le suivi par `window` suffit alors au déplacement.
    }

    const suivre = (e: PointerEvent) => {
      const dx = (e.clientX - depart.x) * mmParPixel;
      const dy = (e.clientY - depart.y) * mmParPixel;
      // Bornes larges : une image peut déborder un peu, jamais se perdre.
      modifierImage(id, {
        x: arrondi(borner(depart.ox + dx, -10, FEUILLE.largeur - 5)),
        y: arrondi(borner(depart.oy + dy, -10, FEUILLE.hauteur - 5)),
      });
    };
    const finir = () => {
      window.removeEventListener('pointermove', suivre);
      window.removeEventListener('pointerup', finir);
    };
    window.addEventListener('pointermove', suivre);
    window.addEventListener('pointerup', finir);
  };

  /** Dépôt d'un fichier sur la feuille : il devient une image libre. */
  const surDepot = async (evenement: React.DragEvent) => {
    evenement.preventDefault();
    const fichier = evenement.dataTransfer.files?.[0];
    if (!fichier) return;
    const data = await televersement.lire(fichier, MAX_LOGO_OCTETS);
    if (data) ajouterImage(data, fichier.name.slice(0, 80));
  };

  const restaurer = () => {
    setErreur('');
    setBrouillon(enteteParDefaut());
    setLigneActive(0);
    setSelection(null);
    if (champImage.current) champImage.current.value = '';
    if (champFond.current) champFond.current.value = '';
  };

  const enregistrer = () => {
    const vide = brouillon.mode === 'image'
      ? brouillon.image === ''
      : !brouillon.lignes.some(ligne => ligne.texte.trim() !== '');
    if (vide) {
      setErreur(brouillon.mode === 'image'
        ? 'Choisissez l’image de l’en-tête avant d’enregistrer.'
        : 'Renseignez au moins une ligne de texte avant d’enregistrer.');
      return;
    }
    onEnregistrer(brouillon);
  };

  const messageErreur = erreur || televersement.erreur;
  const courante = brouillon.lignes[ligneActive];
  const imageSelectionnee = brouillon.images.find(image => image.id === selection);

  /** Échelle de l'aperçu : la feuille garde ses proportions A4, 1 mm = 96/25,4 px. */
  const largeurApercu = 520;
  const echelle = largeurApercu / FEUILLE.largeur;
  /** Points typographiques → pixels de l'aperçu : 1 pt = 0,3528 mm, puis l'échelle. */
  const ptVersPx = (25.4 / 72) * echelle;

  return <Modale
    titre="En-tête des bordereaux"
    sousTitre="Un seul en-tête pour la demande d’engagement de dépense et l’autorisation de recette."
    largeur="document"
    icone={<FileImage size={21} />}
    onFermer={onFermer}
    pied={<div className="flex flex-wrap justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onFermer}>Annuler</button>
      <button type="button" className="btn-primary" onClick={enregistrer} disabled={televersement.charge}>Enregistrer l’en-tête</button>
    </div>}
  >
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
        {([['textes', 'Textes et images', <Type key="t" size={14} />], ['image', 'Image complète', <FileImage key="i" size={14} />]] as const).map(([cle, libelle, icone]) => <button
          key={cle}
          type="button"
          aria-pressed={brouillon.mode === cle}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${brouillon.mode === cle ? 'bg-white text-brand-800 shadow-xs' : 'text-slate-600 hover:text-brand-700'}`}
          onClick={() => modifier({ mode: cle })}
        >{icone}{libelle}</button>)}
      </div>

      {brouillon.mode === 'image'
        ? <section className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700">Image de l’en-tête</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">PNG ou JPEG, 1 Mo maximum. Prévoyez une image large : elle occupe toute la largeur de la page.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={champImage} type="file" accept="image/png,image/jpeg" className="sr-only" id="entete-image" onChange={async e => {
              const data = await televersement.lire(e.target.files?.[0], MAX_IMAGE_OCTETS);
              if (data) modifier({ image: data });
            }} />
            <label htmlFor="entete-image" className="btn-secondary cursor-pointer"><ImagePlus size={15} />{brouillon.image ? 'Remplacer l’image' : 'Choisir une image'}</label>
            {brouillon.image && <button type="button" className="btn-secondary" onClick={() => { modifier({ image: '' }); if (champImage.current) champImage.current.value = ''; }}><ImageMinus size={15} />Retirer</button>}
          </div>
        </section>
        : <div className="grid gap-4 lg:grid-cols-[1fr_auto]">

          {/* Colonne de saisie : une ligne à la fois, avec sa mise en forme. */}
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Lignes de l’en-tête</p>
              <button type="button" className="btn-secondary text-[11px]" onClick={ajouterLigne} disabled={brouillon.lignes.length >= MAX_LIGNES_ENTETE}>
                <ImagePlus size={13} />Ajouter une ligne
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Les lignes vides ne sont pas imprimées. Sélectionnez une ligne pour régler sa police, puis glissez les images directement sur l’aperçu.
            </p>

            {/* Chaque ligne : repère du modèle, aperçu fidèle et boutons d'ordre. */}
            <ul className="space-y-1">
              {brouillon.lignes.map((ligne, index) => <li key={index}>
                <div
                  className={`flex items-start gap-1 rounded-lg border px-2 py-1.5 ${index === ligneActive ? 'border-brand-300 bg-brand-50/60' : 'border-transparent hover:bg-slate-50'}`}
                >
                  <button type="button" className="mt-0.5 text-slate-300 hover:text-slate-500" title="Monter" aria-label={`Monter la ligne ${index + 1}`} onClick={() => deplacerLigne(index, -1)} disabled={index === 0}>
                    <GripVertical size={14} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="block w-full text-left" onClick={() => setLigneActive(index)}>
                      <span className="block truncate text-[10px] uppercase tracking-wide text-slate-400">{LIBELLES_LIGNES[index] ?? `Ligne ${index + 1}`}</span>
                      <span
                        className="block truncate"
                        style={{
                          fontFamily: `'${ligne.police}', sans-serif`,
                          fontSize: `${Math.min(15, Math.max(10, ligne.taille + 2))}px`,
                          fontWeight: ligne.gras ? 700 : 400,
                          fontStyle: ligne.italique ? 'italic' : 'normal',
                          textDecoration: ligne.souligne ? 'underline' : 'none',
                          textAlign: ALIGNEMENT_CSS[ligne.alignement],
                        }}
                      >{ligne.texte.trim() || <span className="text-slate-400">(ligne vide)</span>}</span>
                    </button>
                  </div>
                  <button type="button" className="text-slate-300 hover:text-rose-600" title="Supprimer" aria-label={`Supprimer la ligne ${index + 1}`} onClick={() => supprimerLigne(index)} disabled={brouillon.lignes.length <= 1}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>)}
            </ul>

            {courante && <>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="texte-ligne">
                  Texte de la ligne {ligneActive + 1}
                </label>
                <input
                  id="texte-ligne"
                  className="input"
                  value={courante.texte}
                  maxLength={200}
                  onChange={e => modifierLigne(ligneActive, { texte: e.target.value })}
                  placeholder="Laisser vide pour ne rien imprimer"
                />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mise en forme de cette ligne</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Police"
                    className="input h-8 w-40 py-0 text-xs"
                    value={courante.police}
                    onChange={e => modifierLigne(ligneActive, { police: e.target.value })}
                  >{POLICES.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}</select>

                  <input
                    aria-label="Taille en points"
                    type="number"
                    min={6}
                    max={40}
                    step={0.5}
                    className="input h-8 w-16 py-0 text-xs"
                    value={courante.taille}
                    /* La frappe reste libre ; la borne s'applique quand on quitte le champ. */
                    onChange={e => {
                      const valeur = Number(e.target.value);
                      if (Number.isFinite(valeur)) modifierLigne(ligneActive, { taille: valeur });
                    }}
                    onBlur={e => modifierLigne(ligneActive, { taille: borner(Number(e.target.value) || 9, 6, 40) })}
                  />

                  <BoutonFormat titre="Gras" actif={courante.gras} onClick={() => modifierLigne(ligneActive, { gras: !courante.gras })}><Bold size={13} /></BoutonFormat>
                  <BoutonFormat titre="Italique" actif={courante.italique} onClick={() => modifierLigne(ligneActive, { italique: !courante.italique })}><Italic size={13} /></BoutonFormat>
                  <BoutonFormat titre="Souligné" actif={courante.souligne} onClick={() => modifierLigne(ligneActive, { souligne: !courante.souligne })}><Underline size={13} /></BoutonFormat>

                  <span className="mx-1 h-5 w-px bg-slate-200" />
                  {([['gauche', AlignLeft], ['centre', AlignCenter], ['droite', AlignRight]] as const).map(([valeur, Icone]) => <BoutonFormat
                    key={valeur}
                    titre={valeur === 'centre' ? 'Centrer' : valeur === 'droite' ? 'Aligner à droite' : 'Aligner à gauche'}
                    actif={courante.alignement === valeur}
                    onClick={() => modifierLigne(ligneActive, { alignement: valeur })}
                  ><Icone size={13} /></BoutonFormat>)}
                </div>
              </div>
            </>}
          </section>

          {/* Aperçu A4 : dépôt de fichiers et déplacement des images. */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Aperçu de la feuille</p>
              <div className="flex items-center gap-2">
                <input ref={champFond} type="file" accept="image/png,image/jpeg" className="sr-only" id="entete-image-libre" onChange={async e => {
                  const fichier = e.target.files?.[0];
                  const data = await televersement.lire(fichier, MAX_LOGO_OCTETS);
                  if (data) ajouterImage(data, fichier?.name.slice(0, 80) ?? 'Image de l’en-tête');
                }} />
                <label htmlFor="entete-image-libre" className="btn-secondary cursor-pointer text-[11px]"><ImagePlus size={13} />Ajouter une image</label>
              </div>
            </div>

            <div
              ref={feuille}
              className="entete-feuille"
              style={{ width: `${largeurApercu}px`, height: `${FEUILLE.hauteur * echelle}px` }}
              onDragOver={e => e.preventDefault()}
              onDrop={surDepot}
              onPointerDown={() => setSelection(null)}
            >
              <div
                className="entete-feuille__bandeau"
                style={{ top: `${HAUT_BANDEAU * echelle}px`, height: `${BANDEAU.hauteur * echelle}px` }}
              >
                <div className="entete-feuille__textes" style={{ padding: `0 ${7.6 * echelle}px` }}>
                  {brouillon.lignes.filter(l => l.texte.trim() !== '').map((ligne, index) => <p
                    key={index}
                    style={{
                      fontFamily: `'${ligne.police}', sans-serif`,
                      fontSize: `${ligne.taille * ptVersPx}px`,
                      lineHeight: 1.3,
                      fontWeight: ligne.gras ? 700 : 400,
                      fontStyle: ligne.italique ? 'italic' : 'normal',
                      textDecoration: ligne.souligne ? 'underline' : 'none',
                      textAlign: ALIGNEMENT_CSS[ligne.alignement],
                    }}
                  >{ligne.texte}</p>)}
                </div>
              </div>

              {brouillon.images.map(image => <div
                key={image.id}
                className={`entete-feuille__image ${selection === image.id ? 'entete-feuille__image--active' : ''}`}
                style={{ left: `${image.x * echelle}px`, top: `${image.y * echelle}px`, width: `${image.largeur * echelle}px` }}
                onPointerDown={deplacerImage(image.id)}
              >
                <img
                  src={image.source}
                  alt={image.alt}
                  draggable={false}
                  onPointerDown={deplacerImage(image.id)}
                  style={{ width: '100%', height: 'auto', display: 'block', cursor: 'grab' }}
                />
              </div>)}

              <p className="entete-feuille__aide">Déposez une image ici, puis glissez-la à sa place</p>
            </div>

            {imageSelectionnee
              ? <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Image sélectionnée</p>
                <div className="flex flex-wrap items-end gap-3 text-[11px]">
                  {([['x', 'Gauche (mm)', -10, FEUILLE.largeur - 5], ['y', 'Haut (mm)', -10, FEUILLE.hauteur - 5], ['largeur', 'Largeur (mm)', 3, 120]] as const).map(([cle, libelle, min, max]) => <label key={cle} className="block">
                    <span className="block text-slate-500">{libelle}</span>
                    <input
                      type="number"
                      step={0.5}
                      min={min}
                      max={max}
                      aria-label={libelle}
                      className="input h-8 w-24 py-0 text-xs"
                      value={imageSelectionnee[cle]}
                      onChange={e => {
                        const valeur = Number(e.target.value);
                        if (Number.isFinite(valeur)) modifierImage(imageSelectionnee.id, { [cle]: valeur });
                      }}
                      onBlur={e => modifierImage(imageSelectionnee.id, { [cle]: borner(Number(e.target.value) || 0, min, max) })}
                    />
                  </label>)}
                  <button type="button" className="btn-secondary ml-auto text-[11px]" onClick={() => retirerImage(imageSelectionnee.id)}><Trash2 size={13} />Retirer</button>
                </div>
              </div>
              : <p className="text-[11px] text-slate-500">Cliquez sur une image pour la régler au millimètre, ou glissez-la directement sur la feuille.</p>}
          </section>
        </div>}

      {messageErreur && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{messageErreur}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-500">Le bouton « Restaurer » revient à l’en-tête livré avec la caisse, images comprises.</p>
        <button type="button" className="btn-secondary" onClick={restaurer}><RotateCcw size={15} />Restaurer l’en-tête fourni</button>
      </div>
    </div>
  </Modale>;
}
