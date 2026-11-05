import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, FileImage, ImageMinus, ImagePlus,
  Italic, Plus, RotateCcw, Trash2, Underline, Type,
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

/**
 * La feuille de l'éditeur est une vraie A4, dessinée en millimètres et réduite
 * d'un seul bloc : ce qu'on tape est exactement ce qui s'imprime, aux mêmes
 * cotes que le bordereau (marges de 4,6 / 6,5 mm, colonne de texte à 26 mm).
 */
const FEUILLE = { largeur: 210, hauteur: 297 };
/** 1 mm à l'écran : 96 pixels par pouce. Sert à calculer la réduction. */
const PX_PAR_MM = 96 / 25.4;

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

/** Mise en forme d'une ligne : la même à l'écran et sur le papier. */
function styleLigne(ligne: LigneEntete): CSSProperties {
  return {
    fontFamily: `'${ligne.police}', sans-serif`,
    // La feuille est dessinée en millimètres : les points typographiques
    // tombent donc exactement à la taille de l'impression.
    fontSize: `${ligne.taille}pt`,
    fontWeight: ligne.gras ? 700 : 400,
    fontStyle: ligne.italique ? 'italic' : 'normal',
    textDecoration: ligne.souligne ? 'underline' : 'none',
    textAlign: ALIGNEMENT_CSS[ligne.alignement],
    lineHeight: 1.3,
  };
}

/** Bouton de la barre de mise en forme. */
function BoutonFormat({ actif, titre, onClick, children, desactive }: {
  actif?: boolean; titre: string; onClick: () => void; children: React.ReactNode; desactive?: boolean;
}) {
  return <button
    type="button"
    title={titre}
    aria-label={titre}
    aria-pressed={actif ? true : undefined}
    disabled={desactive}
    // Le bouton ne prend pas le focus : la saisie reste dans la feuille.
    onMouseDown={evenement => evenement.preventDefault()}
    onClick={onClick}
    className={`inline-flex size-7 items-center justify-center rounded border text-slate-700 disabled:opacity-40 dark:text-slate-200 ${actif ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/60 dark:text-brand-300' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
  >{children}</button>;
}

/**
 * Éditeur d'en-tête : la feuille A4 est le formulaire. On clique une ligne et
 * on tape dedans, on la met en forme depuis la barre, on glisse les images
 * directement sur la page. Aucune liste intermédiaire.
 */
export function EnteteBordereauModal({ entetes, onEnregistrer, onFermer }: EnteteBordereauModalProps) {
  const [brouillon, setBrouillon] = useState<EnteteDocument>(() => normaliserEntetes(entetes));
  const [erreur, setErreur] = useState('');
  const [ligneActive, setLigneActive] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const champImage = useRef<HTMLInputElement>(null);
  const champFond = useRef<HTMLInputElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  /* Réduction de la feuille : elle tient dans la colonne, sans jamais dépasser. */
  const [echelle, setEchelle] = useState(1);
  const champsLignes = useRef<Array<HTMLInputElement | null>>([]);
  const televersement = useTeleversement();

  const modifier = (changements: Partial<EnteteDocument>) => {
    setErreur('');
    setBrouillon(etat => ({ ...etat, ...changements }));
  };

  const modifierLigne = (index: number, changements: Partial<LigneEntete>) => {
    modifier({ lignes: brouillon.lignes.map((l, i) => i === index ? { ...l, ...changements } : l) });
  };

  /** Nouvelle ligne : à la suite, ou juste après celle qu'on est en train d'écrire. */
  const ajouterLigne = (apres?: number) => {
    if (brouillon.lignes.length >= MAX_LIGNES_ENTETE) return;
    const rang = apres === undefined ? brouillon.lignes.length : apres + 1;
    const voisine = brouillon.lignes[Math.min(Math.max(rang - 1, 0), brouillon.lignes.length - 1)];
    const lignes = [...brouillon.lignes];
    lignes.splice(rang, 0, {
      texte: '',
      gras: false,
      taille: voisine?.taille ?? 9,
      police: voisine?.police ?? 'Arial',
      italique: false,
      souligne: false,
      alignement: voisine?.alignement ?? 'centre',
    });
    modifier({ lignes });
    setLigneActive(rang);
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

  /**
   * La feuille garde ses cotes A4 exactes : ce qu'on tape ici s'imprime pareil.
   * Seule la réduction change, calculée sur la place réellement visible sous la
   * barre de mise en forme — pas sur la fenêtre entière, qui inclut le pied.
   */
  const mesurerEchelle = () => {
    const colonne = cadre.current?.parentElement;
    const largeur = colonne?.clientWidth ?? 0;
    if (!largeur) return;
    const parLargeur = (largeur - 2) / (FEUILLE.largeur * PX_PAR_MM);
    // L'aperçu est une bande : seule la largeur fixe la réduction.
    const cible = Math.max(0.35, Math.min(0.95, parLargeur));
    setEchelle(actuelle => Math.abs(actuelle - cible) > 0.005 ? cible : actuelle);
  };

  /* La réduction suit la place disponible, recalculée à chaque rendu utile. */
  useEffect(() => {
    const mesurer = () => mesurerEchelle();
    mesurer();
    const observateur = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    // On observe la zone de défilement, pas la feuille : sa hauteur est fixe.
    const zone = cadre.current?.closest('.overflow-y-auto');
    if (observateur && zone) observateur.observe(zone);
    window.addEventListener('resize', mesurer);
    return () => {
      observateur?.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  });

  /**
   * La ligne qu'on vient de choisir reçoit le curseur, son texte est
   * sélectionné : on tape par-dessus, ou on clique dans le mot à corriger.
   */
  useEffect(() => {
    const champ = champsLignes.current[ligneActive];
    if (!champ) return;
    champ.focus();
    champ.select();
  }, [ligneActive]);

  const ajouterImage = useCallback((source: string, alt: string) => {
    setBrouillon(etat => {
      if (etat.images.length >= MAX_IMAGES_ENTETE) return etat;
      const rang = etat.images.length;
      const image: ImageEntete = {
        id: `image-${Date.now()}-${rang}`,
        source,
        alt,
        // Déposée près du coin haut-gauche, l'utilisateur la glisse ensuite.
        x: arrondi(12 + rang * 4),
        y: arrondi(12 + rang * 4),
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

  /**
   * Hauteur visible de la feuille, en millimètres.
   *
   * L'en-tête ne vit que dans le haut de la page : on n'affiche donc que cette
   * bande, courte, pour garder la mise en forme et les images sous les yeux.
   * Une image posée plus bas étire la bande jusqu'à elle, jamais au-delà de A4.
   */
  const hauteurBande = Math.min(FEUILLE.hauteur, Math.max(
    62,
    ...brouillon.images.map(image => image.y + image.largeur + 12),
  ));

  const messageErreur = erreur || televersement.erreur;
  const courante = brouillon.lignes[ligneActive];
  const imageSelectionnee = brouillon.images.find(image => image.id === selection);
  const roleLigne = LIBELLES_LIGNES[ligneActive] ?? `Ligne ${ligneActive + 1}`;

  return <Modale
    titre="En-tête des bordereaux"
    sousTitre="Un seul en-tête pour la demande d’engagement de dépense et l’autorisation de recette. Cliquez une ligne de la feuille et tapez : vous écrivez directement sur la page."
    largeur="document"
    icone={<FileImage size={21} />}
    onFermer={onFermer}
    pied={<div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={restaurer}><RotateCcw size={15} />Restaurer l’en-tête fourni</button>
      <span className="flex-1" />
      <button type="button" className="btn-secondary" onClick={onFermer}>Annuler</button>
      <button type="button" className="btn-primary" onClick={enregistrer} disabled={televersement.charge}>Enregistrer l’en-tête</button>
    </div>}
  >
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {([['textes', 'Textes et images', <Type key="t" size={14} />], ['image', 'Image complète', <FileImage key="i" size={14} />]] as const).map(([cle, libelle, icone]) => <button
          key={cle}
          type="button"
          aria-pressed={brouillon.mode === cle}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${brouillon.mode === cle ? 'bg-white text-brand-800 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-600 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300'}`}
          onClick={() => modifier({ mode: cle })}
        >{icone}{libelle}</button>)}
      </div>

      {brouillon.mode === 'image'
        ? <section className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-[1fr_240px]">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Image de l’en-tête</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              PNG ou JPEG, 1 Mo maximum. Prévoyez une image large : elle occupe toute la largeur de la page.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={champImage} type="file" accept="image/png,image/jpeg" className="sr-only" id="entete-image" onChange={async e => {
                const data = await televersement.lire(e.target.files?.[0], MAX_IMAGE_OCTETS);
                if (data) modifier({ image: data });
              }} />
              <label htmlFor="entete-image" className="btn-secondary cursor-pointer"><ImagePlus size={15} />{brouillon.image ? 'Remplacer l’image' : 'Choisir une image'}</label>
              {brouillon.image && <button type="button" className="btn-secondary" onClick={() => { modifier({ image: '' }); if (champImage.current) champImage.current.value = ''; }}><ImageMinus size={15} />Retirer</button>}
            </div>
          </div>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
            {brouillon.image
              ? <img src={brouillon.image} alt="En-tête complet" className="max-h-40 w-full object-contain" />
              : <p className="text-[11px] text-slate-400 dark:text-slate-500">Aperçu de l’image</p>}
          </div>
        </section>
        : <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">

          <section className="min-w-0 space-y-3">
            {/* Barre de mise en forme : elle agit sur la ligne ouverte. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ligne ouverte</p>
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{ligneActive + 1} sur {brouillon.lignes.length} — {roleLigne}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Police"
                  className="field !h-8 !w-36 !py-0 !text-xs"
                  value={courante?.police ?? 'Arial'}
                  onChange={e => modifierLigne(ligneActive, { police: e.target.value })}
                >{POLICES.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}</select>

                <input
                  aria-label="Taille en points"
                  type="number"
                  min={6}
                  max={40}
                  step={0.5}
                  className="field !h-8 !w-16 !py-0 !text-xs"
                  value={courante?.taille ?? 9}
                  /* La frappe reste libre ; la borne s'applique quand on quitte le champ. */
                  onChange={e => {
                    const valeur = Number(e.target.value);
                    if (Number.isFinite(valeur)) modifierLigne(ligneActive, { taille: valeur });
                  }}
                  onBlur={e => modifierLigne(ligneActive, { taille: borner(Number(e.target.value) || 9, 6, 40) })}
                />

                <BoutonFormat titre="Gras" actif={courante?.gras} onClick={() => courante && modifierLigne(ligneActive, { gras: !courante.gras })}><Bold size={13} /></BoutonFormat>
                <BoutonFormat titre="Italique" actif={courante?.italique} onClick={() => courante && modifierLigne(ligneActive, { italique: !courante.italique })}><Italic size={13} /></BoutonFormat>
                <BoutonFormat titre="Souligné" actif={courante?.souligne} onClick={() => courante && modifierLigne(ligneActive, { souligne: !courante.souligne })}><Underline size={13} /></BoutonFormat>

                <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
                {([['gauche', AlignLeft, 'Aligner à gauche'], ['centre', AlignCenter, 'Centrer'], ['droite', AlignRight, 'Aligner à droite']] as const).map(([valeur, Icone, titre]) => <BoutonFormat
                  key={valeur}
                  titre={titre}
                  actif={courante?.alignement === valeur}
                  onClick={() => modifierLigne(ligneActive, { alignement: valeur })}
                ><Icone size={13} /></BoutonFormat>)}

                <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
                {/* Noms distincts de ceux de la poignée, posée sur la feuille. */}
                <BoutonFormat titre="Remonter la ligne ouverte" desactive={ligneActive === 0} onClick={() => deplacerLigne(ligneActive, -1)}><ArrowUp size={13} /></BoutonFormat>
                <BoutonFormat titre="Descendre la ligne ouverte" desactive={ligneActive >= brouillon.lignes.length - 1} onClick={() => deplacerLigne(ligneActive, 1)}><ArrowDown size={13} /></BoutonFormat>
                <BoutonFormat titre="Supprimer la ligne ouverte" desactive={brouillon.lignes.length <= 1} onClick={() => supprimerLigne(ligneActive)}><Trash2 size={13} /></BoutonFormat>
              </div>
            </div>

            {/* La feuille : c'est le formulaire. Cadre volontairement bas :
                on garde la barre de mise en forme et les images sous les yeux. */}
            <div
              ref={cadre}
              className="entete-cadre"
              style={{
                width: `${FEUILLE.largeur * PX_PAR_MM * echelle}px`,
                height: `${hauteurBande * PX_PAR_MM * echelle}px`,
              }}
            >
            <div
              ref={feuille}
              className="entete-feuille"
              style={{ transform: `scale(${echelle})` }}
              onDragOver={e => e.preventDefault()}
              onDrop={surDepot}
              onPointerDown={() => setSelection(null)}
            >
              <div className="entete-feuille__lignes">
                {brouillon.lignes.map((ligne, index) => {
                  const active = index === ligneActive;
                  const vide = ligne.texte.trim() === '';
                  const libelle = `Ligne ${index + 1} : ${LIBELLES_LIGNES[index] ?? `ligne libre`}`;
                  return <div
                    key={index}
                    className={`entete-ligne ${active ? 'is-active' : ''} ${vide ? 'is-vide' : ''}`}
                    style={styleLigne(ligne)}
                  >
                    {active
                      ? <input
                        ref={el => { champsLignes.current[index] = el; }}
                        aria-label={`Texte de la ligne ${index + 1}`}
                        className="entete-ligne__champ"
                        style={styleLigne(ligne)}
                        value={ligne.texte}
                        maxLength={200}
                        placeholder="Tapez ici le texte imprimé"
                        onChange={e => modifierLigne(index, { texte: e.target.value })}
                        onKeyDown={e => {
                          // Entrée ouvre la ligne suivante, comme dans un traitement de texte.
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            ajouterLigne(index);
                          }
                        }}
                      />
                      : <button
                        type="button"
                        className="entete-ligne__apercu"
                        style={styleLigne(ligne)}
                        aria-label={libelle}
                        title={`${libelle} — cliquez pour écrire`}
                        onClick={() => setLigneActive(index)}
                      >{vide ? <span className="entete-ligne__vide">ligne vide, non imprimée</span> : ligne.texte}</button>}

                    <span className="entete-ligne__actions" aria-hidden={false}>
                      <button type="button" tabIndex={-1} aria-label={`Monter la ligne ${index + 1}`} title="Monter" disabled={index === 0} onClick={() => deplacerLigne(index, -1)}><ArrowUp size={11} /></button>
                      <button type="button" tabIndex={-1} aria-label={`Descendre la ligne ${index + 1}`} title="Descendre" disabled={index >= brouillon.lignes.length - 1} onClick={() => deplacerLigne(index, 1)}><ArrowDown size={11} /></button>
                      <button type="button" tabIndex={-1} aria-label={`Supprimer la ligne ${index + 1}`} title="Supprimer" disabled={brouillon.lignes.length <= 1} onClick={() => supprimerLigne(index)}><Trash2 size={11} /></button>
                    </span>
                  </div>;
                })}

                <button
                  type="button"
                  className="entete-feuille__ajout"
                  onClick={() => ajouterLigne()}
                  disabled={brouillon.lignes.length >= MAX_LIGNES_ENTETE}
                ><Plus size={11} />Ajouter une ligne</button>
              </div>

              {brouillon.images.map(image => <div
                key={image.id}
                className={`entete-feuille__image ${selection === image.id ? 'entete-feuille__image--active' : ''}`}
                style={{ left: `${image.x}mm`, top: `${image.y}mm`, width: `${image.largeur}mm` }}
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


            </div>
            </div>
          </section>

          {/* Colonne des images : réglage au millimètre. */}
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Images</p>
                <input ref={champFond} type="file" accept="image/png,image/jpeg" className="sr-only" id="entete-image-libre" onChange={async e => {
                  const fichier = e.target.files?.[0];
                  const data = await televersement.lire(fichier, MAX_LOGO_OCTETS);
                  if (data) ajouterImage(data, fichier?.name.slice(0, 80) ?? 'Image de l’en-tête');
                }} />
                <label htmlFor="entete-image-libre" className="btn-secondary cursor-pointer text-[11px]"><ImagePlus size={13} />Ajouter une image</label>
              </div>

              {brouillon.images.length > 0
                ? <ul className="mt-3 grid grid-cols-3 gap-2">
                  {brouillon.images.map(image => <li key={image.id}>
                    <button
                      type="button"
                      aria-label={`Sélectionner ${image.alt}`}
                      aria-pressed={selection === image.id}
                      onClick={() => setSelection(image.id)}
                      className={`flex h-16 w-full items-center justify-center rounded-lg border bg-white p-1 dark:bg-slate-800 ${selection === image.id ? 'border-brand-400 ring-2 ring-brand-100 dark:border-brand-500 dark:ring-brand-900' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}
                    >
                      <img src={image.source} alt="" className="max-h-full max-w-full object-contain" />
                    </button>
                  </li>)}
                </ul>
                : <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Aucune image. Ajoutez le logo, ou déposez un fichier directement sur la feuille.</p>}

              {imageSelectionnee && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Position au millimètre</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['x', 'Gauche (mm)', -10, FEUILLE.largeur - 5], ['y', 'Haut (mm)', -10, FEUILLE.hauteur - 5], ['largeur', 'Largeur (mm)', 3, 120]] as const).map(([cle, libelle, min, max]) => <label key={cle} className="block text-[11px]">
                    <span className="block text-slate-500 dark:text-slate-400">{libelle}</span>
                    <input
                      type="number"
                      step={0.5}
                      min={min}
                      max={max}
                      aria-label={libelle}
                      className="field !h-8 !w-full !py-0 !text-xs"
                      value={imageSelectionnee[cle]}
                      onChange={e => {
                        const valeur = Number(e.target.value);
                        if (Number.isFinite(valeur)) modifierImage(imageSelectionnee.id, { [cle]: valeur });
                      }}
                      onBlur={e => modifierImage(imageSelectionnee.id, { [cle]: borner(Number(e.target.value) || 0, min, max) })}
                    />
                  </label>)}
                </div>
                <button type="button" className="btn-secondary w-full justify-center text-[11px]" onClick={() => retirerImage(imageSelectionnee.id)}><Trash2 size={13} />Retirer</button>
              </div>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Comment faire</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Cliquez une ligne de la feuille, puis tapez : <span className="font-semibold">Entrée</span> ouvre la suivante.</li>
                <li>La barre du haut règle la police, la taille, le gras, l’italique, le souligné et l’alignement.</li>
                <li>Glissez une image pour la poser, ou saisissez ses cotes en millimètres.</li>
                <li>Une ligne vide ne s’imprime pas.</li>
              </ul>
            </div>
          </section>
        </div>}

      {messageErreur && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">{messageErreur}</p>}
    </div>
  </Modale>;
}
