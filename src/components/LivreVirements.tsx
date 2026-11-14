import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Landmark, Pencil, Plus, Printer,
  Search, SlidersHorizontal, Sparkles, X,
} from 'lucide-react';
import type { Categories, LigneJournal, Sens } from '../types';
import type { ActionVirement } from '../utils/api';
import type { EnteteDocument } from '../utils/entete';
import { aujourdHui, dateFr, formatAr, masqueMajuscules, moisCourant, montantAffiche, parserMontantDecimal } from '../utils/format';
import { identifiant } from '../utils/ledger';
import type { CompteVirement, RegistreVirements, Virement } from '../utils/virements';
import { ajouterVirement, ribComplet } from '../utils/virements';
import { Modale } from './Modale';
import { ChampMontant, formaterMontantDecimal } from './ChampMontant';
import { ChampCompteBancaire, formaterCompteBancaire } from './ChampCompteBancaire';
import { ModaleBordereau } from './Bordereau';
import { ModaleOrdreVirement } from './OrdreVirement';
import { GestionTiersVirements } from './GestionTiersVirements';
import { fichesExempleManquantes, virementsExempleManquants } from '../utils/demonstration';

interface Props {
  registre: RegistreVirements;
  categories: Categories;
  entete: EnteteDocument;
  onMutation: (action: ActionVirement) => Promise<boolean>;
  erreurExterne: string | null;
  hauteurEntete?: number;
}

type Formulaire = {
  date: string; sens: Sens; compteId: string; libelle: string; categorie: string; tiers: string;
  reference: string; observation: string; montant: string;
  /** Mentions de l'ordre de virement remis à la banque (facultatives). */
  beneficiaireAdresse: string; beneficiaireBanque: string; beneficiaireCompte: string;
  permanent: boolean;
  /** Fiche client (recette) ou fournisseur (DED) du bénéficiaire. */
  tiersId: string;
};


export function LivreVirements({ registre, categories, entete, onMutation, erreurExterne, hauteurEntete }: Props) {
  const [edition, setEdition] = useState<Virement | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [filtreCompte, setFiltreCompte] = useState('');
  const [filtreTiers, setFiltreTiers] = useState('');
  const [filtreSens, setFiltreSens] = useState<'TOUS' | Sens>('TOUS');
  /** Période affichée : un mois précis, ou tout l'historique du registre. */
  const [toutAfficher, setToutAfficher] = useState(true);
  const [filtreMois, setFiltreMois] = useState(moisCourant());
  const [recherche, setRecherche] = useState('');
  /** Les cartes de synthèse se replient, comme celles du livre journal. */
  const [afficherSynthese, setAfficherSynthese] = useState(true);
  /** Exemples proposés : fiches manquantes, et virements tant que le registre est vide. */
  const [exemplesOuverts, setExemplesOuverts] = useState(false);
  const [exemplesEnCours, setExemplesEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const soumission = useRef(false);
  const [impression, setImpression] = useState<{ ligne: LigneJournal; compte: CompteVirement } | null>(null);
  /** Impression déclenchée pour l'ordre de virement (seul en réimpression, avec l'état DED à la validation). */
  const [ordre, setOrdre] = useState<{ virement: Virement; compte: CompteVirement; inclureEtat?: boolean } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const prevLignesRef = useRef<Virement[]>([]);
  const derniereLigneRef = useRef<HTMLTableRowElement | null>(null);
  const doitDefilerVersDerniere = useRef(true);
  const comptes = useMemo(() => new Map(registre.comptes.map(c => [c.id, c])), [registre.comptes]);
  const fiches = useMemo(() => new Map(registre.tiers.map(t => [t.id, t])), [registre.tiers]);
  const fournisseursFiltres = useMemo(
    () => registre.tiers.filter(t => t.type === 'FOURNISSEUR').slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [registre.tiers],
  );
  const clientsFiltres = useMemo(
    () => registre.tiers.filter(t => t.type === 'CLIENT').slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [registre.tiers],
  );
  const autresTiersLibres = useMemo(() => {
    const nomsConnus = new Set(registre.tiers.map(t => t.nom.trim().toLocaleLowerCase('fr')));
    const vus = new Set<string>();
    const resultat: string[] = [];
    for (const v of registre.ecritures) {
      if (filtreSens !== 'TOUS' && v.sens !== filtreSens) continue;
      if (v.tiersId && fiches.has(v.tiersId)) continue;
      const nom = v.tiers.trim();
      const cle = nom.toLocaleLowerCase('fr');
      if (!nom || nomsConnus.has(cle) || vus.has(cle)) continue;
      vus.add(cle);
      resultat.push(nom);
    }
    return resultat.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [registre.ecritures, registre.tiers, fiches, filtreSens]);
  const lignes = useMemo(() => registre.ecritures.filter(v => {
    if (filtreCompte && v.compteId !== filtreCompte) return false;
    if (filtreSens !== 'TOUS' && v.sens !== filtreSens) return false;
    if (filtreTiers) {
      if (filtreTiers.startsWith('nom:')) {
        const nomCible = filtreTiers.slice(4).trim().toLocaleLowerCase('fr');
        if (v.tiers.trim().toLocaleLowerCase('fr') !== nomCible) return false;
      } else {
        const ficheFiltre = fiches.get(filtreTiers);
        const correspondId = v.tiersId === filtreTiers;
        const correspondNomAncien = !v.tiersId && ficheFiltre
          && v.tiers.trim().toLocaleLowerCase('fr') === ficheFiltre.nom.trim().toLocaleLowerCase('fr');
        if (!correspondId && !correspondNomAncien) return false;
      }
    }
    if (!toutAfficher && !v.date.startsWith(filtreMois)) return false;
    const q = recherche.trim().toLocaleLowerCase('fr');
    return !q || [v.numero, v.libelle, v.categorie, v.tiers, v.reference, comptes.get(v.compteId)?.banque, comptes.get(v.compteId)?.numeroCompte].some(t => t?.toLocaleLowerCase('fr').includes(q));
  }).slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.numero.localeCompare(b.numero) || a.id.localeCompare(b.id)), [registre, filtreCompte, filtreTiers, filtreSens, toutAfficher, filtreMois, recherche, comptes, fiches]);

  useEffect(() => {
    const prevLignes = prevLignesRef.current;
    prevLignesRef.current = lignes;

    if (!lignes.length) {
      setActiveId(null);
      return;
    }

    if (prevLignes.length > 0 && prevLignes.length > lignes.length) {
      setActiveId(actuelle => {
        if (actuelle && !lignes.some(l => l.id === actuelle)) {
          const idxSupprime = prevLignes.findIndex(p => p.id === actuelle);
          const suivante = (idxSupprime !== -1 ? lignes[idxSupprime] : null) || lignes[idxSupprime - 1] || lignes[lignes.length - 1];
          return suivante ? suivante.id : null;
        }
        return actuelle;
      });
      return;
    }

    if (lignes.length > prevLignes.length && prevLignes.length > 0) {
      const ajouts = lignes.filter(l => !prevLignes.some(p => p.id === l.id));
      if (ajouts.length > 0) {
        setActiveId(ajouts[ajouts.length - 1].id);
        return;
      }
    }

    setActiveId(actuelle => {
      if (!actuelle || !lignes.some(l => l.id === actuelle)) {
        return lignes[lignes.length - 1]?.id ?? null;
      }
      return actuelle;
    });
  }, [lignes]);

  useEffect(() => {
    if (!doitDefilerVersDerniere.current || !lignes.length || !derniereLigneRef.current) return;
    doitDefilerVersDerniere.current = false;
    derniereLigneRef.current.scrollIntoView?.({ behavior: 'instant', block: 'end', inline: 'nearest' });
  }, [lignes]);

  /** Totaux de la sélection affichée (calculés en centimes entiers) : ils suivent les filtres, comme au journal. */
  const total = (sens: Sens) => lignes.filter(v => v.sens === sens).reduce((s, v) => s + Math.round(v.montant * 100), 0) / 100;
  const recettes = total('RECETTE');
  const depenses = total('DEPENSE');
  const filtreActif = Boolean(filtreCompte || filtreTiers || filtreSens !== 'TOUS' || recherche.trim() || !toutAfficher);
  const periode = toutAfficher ? 'Toutes périodes' : moisLisible(filtreMois);

  function moisLisible(mois: string): string {
    const [annee, moisNum] = mois.split('-').map(Number);
    if (!annee || !moisNum) return 'Toutes périodes';
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(annee, moisNum - 1, 1));
  }
  /** Mois voisin : la barre de période se parcourt comme celle du livre journal. */
  function decalerMois(valeur: string, pas: number): string {
    const [annee, moisNum] = valeur.split('-').map(Number);
    if (!annee || !moisNum) return valeur;
    const d = new Date(annee, moisNum - 1 + pas, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function changerMois(valeur: string) {
    if (!valeur) return;
    setFiltreMois(valeur);
    setToutAfficher(false);
  }
  function changerSens(sens: 'TOUS' | Sens) {
    setFiltreSens(sens);
    if (sens !== 'TOUS' && filtreTiers) {
      if (filtreTiers.startsWith('nom:')) {
        setFiltreTiers('');
      } else {
        const fiche = fiches.get(filtreTiers);
        const typeAttendu = sens === 'RECETTE' ? 'CLIENT' : 'FOURNISSEUR';
        if (fiche && fiche.type !== typeAttendu) setFiltreTiers('');
      }
    }
  }
  function reinitialiser() {
    setFiltreCompte(''); setFiltreTiers(''); setFiltreSens('TOUS'); setRecherche(''); setToutAfficher(true);
  }
  /** La saisie reste fermée tant qu'aucun compte n'est réglé (Administration). */
  const saisiePossible = registre.comptes.length > 0;

  /**
   * Exemples : les comptes et fiches manquants peuvent toujours être ajoutés,
   * les virements seulement si le registre n'en porte encore aucun — ils ne
   * doivent jamais modifier un historique réel.
   */
  const fichesExemple = fichesExempleManquantes(registre);
  const virementsExemple = virementsExempleManquants(registre);
  const exemplesDisponibles = fichesExemple.comptes.length + fichesExemple.tiers.length + virementsExemple.length > 0;

  async function chargerExemples() {
    if (exemplesEnCours) return;
    setExemplesEnCours(true); setErreur('');
    try {
      const exemple = {
        ...(fichesExemple.comptes.length ? { comptes: fichesExemple.comptes } : {}),
        ...(fichesExemple.tiers.length ? { tiers: fichesExemple.tiers } : {}),
        ...(virementsExemple.length ? { virements: virementsExemple } : {}),
      };
      if (await onMutation({ operation: 'charger_exemples', exemple })) {
        if (virementsExemple.length > 0) doitDefilerVersDerniere.current = true;
        setExemplesOuverts(false);
      }
      else setErreur('Les exemples n’ont pas été enregistrés. Vérifiez le message et réessayez.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Exemples non enregistrés.');
    } finally { setExemplesEnCours(false); }
  }

  function nouveau(sens: Sens) {
    setEdition(null); setErreur('');
    setFormulaire({
      date: aujourdHui(), sens, compteId: registre.comptes[0]?.id ?? '', libelle: '',
      categorie: (sens === 'RECETTE' ? categories.recette : categories.depense)[0] ?? '',
      tiers: '', reference: '', observation: '', montant: '',
      beneficiaireAdresse: '', beneficiaireBanque: '', beneficiaireCompte: '', permanent: false,
      tiersId: '',
    });
  }
  function modifier(v: Virement) {
    setEdition(v); setErreur('');
    setFormulaire({
      date: v.date, sens: v.sens, compteId: v.compteId, libelle: v.libelle, categorie: v.categorie,
      tiers: v.tiers, reference: v.reference, observation: v.observation, montant: formaterMontantDecimal(v.montant),
      beneficiaireAdresse: v.beneficiaireAdresse ?? '', beneficiaireBanque: v.beneficiaireBanque ?? '',
      beneficiaireCompte: formaterCompteBancaire(v.beneficiaireCompte), permanent: v.permanent === true,
      tiersId: v.tiersId ?? '',
    });
  }
  function champ<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) { setFormulaire(f => f ? { ...f, [cle]: valeur } : f); }
  /** Fiches proposées : les clients pour une recette, les fournisseurs pour une DED. */
  const fichesDuSens = formulaire ? registre.tiers.filter(t => t.type === (formulaire.sens === 'RECETTE' ? 'CLIENT' : 'FOURNISSEUR')) : [];
  const ficheChoisie = formulaire?.tiersId ? fiches.get(formulaire.tiersId) : undefined;
  /**
   * Choisir la fiche remplit d'un coup le nom, l'adresse et le RIB : l'ordre de
   * virement doit porter exactement ce que la fiche dit, sans double saisie.
   */
  function choisirTiers(tiersId: string) {
    const fiche = fiches.get(tiersId);
    setFormulaire(f => f ? {
      ...f, tiersId,
      tiers: fiche?.nom ?? '',
      beneficiaireAdresse: fiche?.adresse ?? '',
      beneficiaireBanque: fiche?.banque ?? '',
      beneficiaireCompte: formaterCompteBancaire(fiche?.numeroCompte),
    } : f);
  }
  async function enregistrerVirement(event: FormEvent) {
    event.preventDefault();
    if (!formulaire || soumission.current) return;
    const montant = parserMontantDecimal(formulaire.montant);
    if (montant === null || montant <= 0) { setErreur('Saisissez un montant supérieur à zéro (jusqu’à deux chiffres après la virgule).'); return; }
    // Le bénéficiaire est obligatoire : c'est son nom et son RIB que la banque
    // lit sur l'ordre de virement. Les pièces d'avant les fiches, elles, gardent
    // leur tiers écrit à la main.
    if (!formulaire.tiersId && !edition) {
      setErreur(formulaire.sens === 'RECETTE'
        ? 'Choisissez le client qui règle la recette : son nom figure sur le bordereau.'
        : 'Choisissez le fournisseur à payer : son nom et son RIB figurent sur l’ordre de virement.');
      return;
    }
    const fiche = formulaire.tiersId ? fiches.get(formulaire.tiersId) : undefined;
    if (formulaire.tiersId && !fiche) { setErreur('Le client ou le fournisseur choisi est introuvable.'); return; }
    soumission.current = true; setOccupe(true); setErreur('');
    const { beneficiaireAdresse, beneficiaireBanque, beneficiaireCompte, permanent, ...commun } = formulaire;
    // La fiche fait foi : elle fournit le nom, l'adresse et le RIB du bénéficiaire.
    // Les champs restent modifiables pour une mention propre à ce virement.
    const adresse = beneficiaireAdresse.trim() || fiche?.adresse || '';
    const banque = beneficiaireBanque.trim() || fiche?.banque || '';
    const compteBeneficiaire = beneficiaireCompte.trim() || fiche?.numeroCompte || '';
    const base = {
      ...commun,
      libelle: masqueMajuscules(commun.libelle.trim()),
      montant,
      tiers: fiche?.nom ?? formulaire.tiers,
      ...(fiche?.id ? { tiersId: fiche.id } : {}),
      ...(adresse ? { beneficiaireAdresse: adresse } : {}),
      ...(banque ? { beneficiaireBanque: banque } : {}),
      ...(compteBeneficiaire ? { beneficiaireCompte: compteBeneficiaire } : {}),
      ...(permanent ? { permanent: true } : {}),
      id: edition?.id ?? identifiant('virement'), createdAt: edition?.createdAt ?? new Date().toISOString(),
    };
    const action: ActionVirement = edition
      ? { operation: 'modifier', virement: { ...base, numero: edition.numero, updatedAt: new Date().toISOString() } }
      : { operation: 'ajouter', virement: base };
    // Numéro définitif prévisible : le serveur applique exactement la même règle,
    // ce qui permet de préparer l'ordre de virement avant la réponse.
    const numero = edition?.numero ?? (() => {
      try {
        const apres = ajouterVirement(registre, base as Virement);
        return apres.ecritures[apres.ecritures.length - 1]?.numero ?? '';
      } catch { return ''; }
    })();
    try {
      if (await onMutation(action)) {
        if (!edition) doitDefilerVersDerniere.current = true;
        setFormulaire(null); setEdition(null);
        // Toute validation de DED par virement imprime aussitôt l'état DED (page 1)
        // suivi de l'ordre de virement bancaire (page 2), sans action supplémentaire.
        const compte = comptes.get(base.compteId);
        if (!edition && base.sens === 'DEPENSE' && compte && numero) {
          setOrdre({ virement: { ...base, numero } as Virement, compte, inclureEtat: true });
        }
      }
      else setErreur('Virement non enregistré. Vérifiez le message et réessayez.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Virement non enregistré.'); }
    finally { soumission.current = false; setOccupe(false); }
  }
  /** Réimpression de l'ordre de virement depuis le registre. */
  function imprimerOrdre(v: Virement) {
    const compte = comptes.get(v.compteId);
    if (!compte) { setErreur('Compte bancaire introuvable.'); return; }
    setOrdre({ virement: v, compte });
  }
  function imprimerPiece(v: Virement) {
    const compte = comptes.get(v.compteId);
    if (!compte) { setErreur('Compte bancaire introuvable.'); return; }
    setImpression({ ligne: { ...v, solde: 0 }, compte });
  }
  async function imprimerEtat() {
    if (!lignes.length) return;
    const fenetre = window.open('', '_blank');
    if (!fenetre) { setErreur('Autorisez les fenêtres contextuelles pour imprimer l’état.'); return; }
    try {
      const { ouvrirEtatPourImpression } = await import('../utils/export-pdf');
      const selection: LigneJournal[] = lignes.map(v => {
        const compte = comptes.get(v.compteId);
        if (!compte) throw new Error('Un compte bancaire est introuvable.');
        return { ...v, libelle: `${v.libelle}\nBanque : ${compte.banque} · Compte : ${formaterCompteBancaire(compte.numeroCompte, compte.codeBanque) || 'non renseigné'}`, solde: 0 };
      });
      // La période imprimée est celle de la sélection, pas un mois par défaut.
      ouvrirEtatPourImpression(selection, entete, periode, fenetre, true);
    } catch (e) { fenetre.close(); setErreur(e instanceof Error ? e.message : 'Impression impossible.'); }
  }
  const libelleCompte = (c: CompteVirement) => `${c.banque} — ${formaterCompteBancaire(c.numeroCompte, c.codeBanque) || 'numéro non renseigné'}`;
  const listeCategories = formulaire ? (formulaire.sens === 'RECETTE' ? categories.recette : categories.depense) : [];

  return <section className="space-y-5" aria-label="Livre des virements">
    {/* Barre d'action : les mêmes gestes que le livre journal, à la même place. */}
    <div className="no-print flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Recettes et dépenses par virement, sur les comptes réglés dans Administration.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn-secondary ${!afficherSynthese ? '!border-slate-300 dark:!border-slate-700' : ''}`} aria-expanded={afficherSynthese} aria-label={afficherSynthese ? 'Masquer la synthèse' : 'Afficher la synthèse'} title={afficherSynthese ? 'Masquer les cartes de synthèse' : 'Afficher les cartes de synthèse'} onClick={() => setAfficherSynthese(v => !v)}>
          {afficherSynthese ? <EyeOff size={16} /> : <Eye size={16} />}<span>{afficherSynthese ? 'Masquer la synthèse' : 'Afficher la synthèse'}</span>
        </button>
        {exemplesDisponibles && <button type="button" className="btn-secondary" onClick={() => setExemplesOuverts(true)} title="Ajouter des comptes, des clients, des fournisseurs et des virements d’exemple"><Sparkles size={16} />Charger des exemples</button>}
        <button type="button" className="btn-secondary" disabled={!lignes.length} title={lignes.length ? 'Imprimer les virements affichés' : 'Aucun virement à imprimer'} onClick={() => void imprimerEtat()}><Printer size={16} />Imprimer</button>
      </div>
    </div>

    {/* Synthèse de la période : recettes, dépenses, mouvement net, comptes bancaires. */}
    {afficherSynthese && <section className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Synthèse des virements · ${periode}`}>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Recettes par virement</span><span className="summary-icon bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"><ArrowDownLeft size={19} /></span></div><p className="summary-value text-emerald-700 dark:text-emerald-400">{formatAr(recettes)}</p><p className="summary-note">Encaissements bancaires · {periode}</p></article>
      <article className="summary-card"><div className="flex items-center justify-between"><span className="summary-label">Dépenses par virement</span><span className="summary-icon bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><ArrowUpRight size={19} /></span></div><p className="summary-value text-rose-700 dark:text-rose-400">{formatAr(depenses)}</p><p className="summary-note">DED payées par virement · {periode}</p></article>
      <article className="summary-card border-brand-200/80 bg-brand-50/40 dark:border-brand-900/60 dark:bg-brand-950/40"><div className="flex items-center justify-between"><span className="summary-label">Comptes bancaires</span><span className="summary-icon bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"><Landmark size={19} /></span></div>
        <p className="summary-value">{registre.comptes.length}</p>
        <p className="summary-note">{[...new Set(registre.comptes.map(c => c.banque))].join(' · ') || 'Aucun compte réglé'} · {lignes.length} virement(s)</p></article>
    </section>}

    {/* Période, filtres et nouvelles pièces, dans une barre épinglée comme au journal. */}
    <div className="no-print sticky z-10 bg-slate-100/90 py-1 backdrop-blur-md dark:bg-slate-950/90" style={{ top: hauteurEntete || 88 }}>
      <section className="card space-y-3 border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Période, filtres et nouvelles pièces">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <button type="button" className="icon-button" aria-label="Mois précédent" disabled={toutAfficher} onClick={() => changerMois(decalerMois(filtreMois, -1))}><ChevronLeft size={16} /></button>
              <input type="month" className="w-40 bg-transparent px-2 py-2 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200" aria-label="Mois des virements" value={filtreMois} onChange={e => changerMois(e.target.value)} />
              <button type="button" className="icon-button" aria-label="Mois suivant" disabled={toutAfficher} onClick={() => changerMois(decalerMois(filtreMois, 1))}><ChevronRight size={16} /></button>
            </div>
            <button type="button" className={`btn-secondary ${toutAfficher ? '!border-brand-700 !bg-brand-50 !text-brand-800 dark:!border-brand-500 dark:!bg-brand-950/80 dark:!text-brand-300' : ''}`} aria-pressed={toutAfficher} onClick={() => setToutAfficher(v => !v)}>Tout afficher</button>
          </div>
          {saisiePossible
            ? <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => nouveau('RECETTE')}><Plus size={16} />Nouvelle recette par virement</button>
              <button type="button" className="btn-danger" onClick={() => nouveau('DEPENSE')}><Plus size={16} />Nouvelle DED par virement</button>
            </div>
            : <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">Aucun compte bancaire : un administrateur doit d’abord en créer un dans Administration.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="segmented" aria-label="Filtrer les virements par type">
            {(['TOUS', 'RECETTE', 'DEPENSE'] as const).map(sens => <button key={sens} type="button" aria-pressed={filtreSens === sens} onClick={() => changerSens(sens)}>{sens === 'TOUS' ? 'Tous' : sens === 'RECETTE' ? 'Recettes' : 'DED / dépenses'}</button>)}
          </div>
          <select className="field !w-auto max-w-56 !py-2 !text-sm" aria-label="Filtrer par compte" value={filtreCompte} onChange={e => setFiltreCompte(e.target.value)}>
            <option value="">Tous les comptes</option>
            {registre.comptes.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}
          </select>
          <select className="field !w-auto max-w-60 !py-2 !text-sm" aria-label="Filtrer par fournisseur ou client" value={filtreTiers} onChange={e => setFiltreTiers(e.target.value)}>
            <option value="">
              {filtreSens === 'DEPENSE'
                ? 'Tous les fournisseurs'
                : filtreSens === 'RECETTE'
                  ? 'Tous les clients'
                  : 'Tous les fournisseurs / clients'}
            </option>
            {filtreSens !== 'RECETTE' && fournisseursFiltres.length > 0 && (
              <optgroup label="Fournisseurs (DED)">
                {fournisseursFiltres.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </optgroup>
            )}
            {filtreSens !== 'DEPENSE' && clientsFiltres.length > 0 && (
              <optgroup label="Clients (recettes)">
                {clientsFiltres.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </optgroup>
            )}
            {autresTiersLibres.length > 0 && (
              <optgroup label="Autres bénéficiaires">
                {autresTiersLibres.map(nom => <option key={`nom:${nom}`} value={`nom:${nom}`}>{nom}</option>)}
              </optgroup>
            )}
          </select>
          <div className="relative min-w-44 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input type="search" className="field !py-2 !pl-9 !text-sm" aria-label="Rechercher dans les virements" placeholder="Rechercher une pièce, un libellé, un bénéficiaire…" value={recherche} onChange={e => setRecherche(e.target.value)} />
          </div>
          {filtreActif && <button type="button" className="icon-button" title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres" onClick={reinitialiser}><X size={16} /></button>}
          <span className="hidden items-center gap-1 text-xs text-slate-400 dark:text-slate-500 xl:flex"><SlidersHorizontal size={14} />{filtreActif ? 'Filtres actifs' : 'Aucun filtre'}</span>
        </div>
      </section>
    </div>

    {erreur && !formulaire && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">{erreur}</p>}
    <section className="card overflow-hidden" aria-label="Registre des virements">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <Landmark size={18} className="text-brand-700 dark:text-brand-400" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Registre des virements</h2>
            <p aria-live="polite" className="mt-0.5 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {periode} · {lignes.length} virement{lignes.length > 1 ? 's' : ''}{filtreActif ? ' affiché(s) sur la sélection' : ''}
            </p>
          </div>
        </div>
        <span className="badge badge-neutral">MGA · ariary</span>
      </div>
      {filtreActif && <p className="border-b border-amber-100 bg-amber-50/70 px-5 py-2 text-xs text-amber-900 sm:text-sm dark:border-amber-950/60 dark:bg-amber-950/40 dark:text-amber-200">Vue filtrée : les totaux portent sur la sélection.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm" aria-label="Virements enregistrés">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">N°</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Compte bancaire</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Type</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Libellé & bénéficiaire</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Catégorie</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Montant (Ar)</th>
              <th scope="col" className="px-3 py-2.5 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center">
                  <Landmark size={30} className="mx-auto mb-2.5 text-slate-300 dark:text-slate-600" />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Aucun virement pour cette sélection.</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {filtreActif
                      ? 'Essayez une autre période ou réinitialisez les filtres.'
                      : saisiePossible
                        ? 'Enregistrez une recette ou une DED par virement ci-dessus.'
                        : exemplesDisponibles
                          ? 'Chargez les données d’exemple (comptes BNI, clients, fournisseurs et virements) pour découvrir ce module.'
                          : 'Configurez d’abord un compte bancaire dans Administration.'}
                  </p>
                  {filtreActif ? (
                    <button type="button" className="btn-secondary mt-3" onClick={reinitialiser}>Réinitialiser les filtres</button>
                  ) : exemplesDisponibles ? (
                    <button type="button" className="btn-secondary mt-3" onClick={() => setExemplesOuverts(true)}>
                      <Sparkles size={15} />Découvrir avec des exemples
                    </button>
                  ) : null}
                </td>
              </tr>
            )}
            {lignes.map(v => {
              const compte = comptes.get(v.compteId);
              const meta = [v.tiers, v.reference, v.observation].filter((val, idx, arr) => val && arr.indexOf(val) === idx).join(' · ');
              const estActive = activeId === v.id;
              const estEdition = edition?.id === v.id;
              return (
                <tr
                  key={v.id}
                  ref={v.id === lignes[lignes.length - 1]?.id ? derniereLigneRef : undefined}
                  onClick={() => setActiveId(v.id)}
                  className={`border-b transition-all duration-150 cursor-pointer ${
                    estActive
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-l-4 border-l-emerald-600 dark:border-l-emerald-400 font-medium shadow-xs'
                      : estEdition
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-500'
                        : 'border-l-4 border-l-transparent border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 align-middle">
                    <div className="flex items-center gap-2">
                      {estActive && <span className="size-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-xs" title="Ligne active" />}
                      <span className="tabular-nums text-slate-700 dark:text-slate-300">{dateFr(v.date)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-xs font-medium text-slate-600 dark:text-slate-400 sm:text-sm">{v.numero}</td>
                  <td className="px-3 py-2.5 align-middle text-slate-700 dark:text-slate-300">{compte ? libelleCompte(compte) : 'Compte introuvable'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <span className={`badge ${v.sens === 'RECETTE' ? 'badge-green' : 'badge-red'}`}>
                      {v.sens === 'RECETTE' ? 'Recette' : 'DED'}
                    </span>
                  </td>
                  <td className="max-w-80 px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{v.libelle}</p>
                      {v.permanent && <span className="badge badge-neutral shrink-0 !px-1.5 !py-0 text-[10px]">Permanent</span>}
                    </div>
                    {meta && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>}
                  </td>
                  <td className="max-w-44 truncate px-3 py-2.5 align-middle text-slate-700 dark:text-slate-300">{v.categorie}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${v.sens === 'RECETTE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {montantAffiche(v.montant)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center align-middle" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-center gap-0.5">
                      <button type="button" className="icon-button" title="Modifier" aria-label={`Modifier ${v.numero}`} onClick={() => { setActiveId(v.id); modifier(v); }}><Pencil size={16} /></button>
                      <button type="button" className="icon-button" title="Imprimer le bordereau" aria-label={`Imprimer le bordereau ${v.numero}`} onClick={() => imprimerPiece(v)}><Printer size={16} /></button>
                      {v.sens === 'DEPENSE' && <button type="button" className="icon-button" title="Réimprimer l’ordre de virement" aria-label={`Imprimer l’ordre de virement ${v.numero}`} onClick={() => imprimerOrdre(v)}><Landmark size={16} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {lignes.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100">
                <td colSpan={6} className="px-4 py-2.5 text-xs sm:text-sm">
                  {filtreActif ? 'Totaux de la sélection' : 'Totaux de la période'}
                  <span className="ml-3 font-normal text-slate-500 dark:text-slate-400">
                    Recettes : <strong className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatAr(recettes)}</strong> · DED : <strong className="tabular-nums text-rose-700 dark:text-rose-400">{formatAr(depenses)}</strong>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{lignes.length} pièce(s)</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
    {formulaire && <Modale titre={edition ? `Modifier ${edition.numero}` : formulaire.sens === 'RECETTE' ? 'Nouvelle recette par virement' : 'Nouvelle DED par virement'} onFermer={() => { if (!occupe) { setFormulaire(null); setErreur(''); } }}><form className="space-y-3" onSubmit={e => void enregistrerVirement(e)}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Date du virement<input className="field" type="date" required value={formulaire.date} onChange={e => champ('date', e.target.value)} /></label><label className="label">Compte bancaire<select className="field" required value={formulaire.compteId} onChange={e => champ('compteId', e.target.value)}>{registre.comptes.map(c => <option value={c.id} key={c.id}>{libelleCompte(c)}</option>)}</select></label></div>
      <label className="label">Libellé<input className="field saisie-majuscules" required maxLength={200} placeholder={formulaire.sens === 'RECETTE' ? 'Ex. SUBVENTION SANTÉ COMMUNAUTAIRE' : 'Ex. RÈGLEMENT FACTURE OXYGÈNE MÉDICAL'} value={formulaire.libelle} onChange={e => champ('libelle', e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="virement-categorie">Catégorie</label><select id="virement-categorie" className="field" required value={formulaire.categorie} onChange={e => champ('categorie', e.target.value)}>{[...new Set([...listeCategories, ...(edition ? [edition.categorie] : [])])].map(c => <option key={c}>{c}</option>)}</select></div><div><ChampMontant label="Montant (Ar)" valeur={formulaire.montant} onChange={val => champ('montant', val)} placeholder="0,00" autoriserDecimales obligatoire /></div></div>
      <label className="label">{formulaire.sens === 'RECETTE' ? 'Client qui règle la recette' : 'Fournisseur à payer'}
        <select className="field" required value={formulaire.tiersId} onChange={e => choisirTiers(e.target.value)}>
          <option value="">{formulaire.sens === 'RECETTE' ? 'Choisir un client…' : 'Choisir un fournisseur…'}</option>
          {fichesDuSens.map(t => <option key={t.id} value={t.id}>{t.nom}{t.type === 'FOURNISSEUR' && !ribComplet(t) ? ' — RIB à compléter' : ''}</option>)}
        </select>
        {fichesDuSens.length === 0 && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {formulaire.sens === 'RECETTE'
            ? 'Aucun client enregistré : créez sa fiche dans « Clients et fournisseurs », en bas de cette page.'
            : 'Aucun fournisseur enregistré : créez sa fiche, RIB compris, dans « Clients et fournisseurs ». '}
        </span>}
        {ficheChoisie && formulaire.sens === 'RECETTE' && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Téléphone : {ficheChoisie.telephone || 'non renseigné'} · Adresse : {ficheChoisie.adresse || 'non renseignée'}</span>}
      </label>
      <label className="label">Référence du virement<input className="field" maxLength={200} placeholder="N° facture, avis de crédit ou bordereau…" value={formulaire.reference} onChange={e => champ('reference', e.target.value)} /></label>
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Ordre de virement remis à la banque</legend>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Ces mentions viennent de la fiche du bénéficiaire et figurent sur l’ordre de virement 114018. Une mention laissée vide reste en blanc sur le papier.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Adresse du bénéficiaire<input className="field" maxLength={200} value={formulaire.beneficiaireAdresse} onChange={e => champ('beneficiaireAdresse', e.target.value)} /></label>
          <label className="label">Établissement bancaire du bénéficiaire<input className="field" maxLength={200} value={formulaire.beneficiaireBanque} onChange={e => champ('beneficiaireBanque', e.target.value)} placeholder="BNI, BOA, CCP…" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><ChampCompteBancaire label="Compte ou RIB du bénéficiaire" valeur={formulaire.beneficiaireCompte} onChange={v => champ('beneficiaireCompte', v)} /></div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={formulaire.permanent} onChange={e => champ('permanent', e.target.checked)} />Virement permanent</label>
        </div>
      </fieldset>
      <label className="label">Observation<textarea className="field" maxLength={500} value={formulaire.observation} onChange={e => champ('observation', e.target.value)} /></label>
      {(erreur || erreurExterne) && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{erreurExterne || erreur}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={occupe} onClick={() => setFormulaire(null)}>Annuler</button><button className="btn-primary" disabled={occupe}>Enregistrer</button></div>
    </form></Modale>}
    {/* Clients et fournisseurs : le bénéficiaire de chaque virement vient d'ici. */}
    <div className="card p-5" role="region" aria-label="Clients et fournisseurs">
      <GestionTiersVirements registre={registre} onMutation={onMutation} erreurExterne={erreurExterne} />
    </div>
    {exemplesOuverts && <Modale titre="Charger des exemples de virements" sousTitre="Des données de démonstration, ajoutées à ce registre." icone={<Sparkles size={22} />} largeur="petite" onFermer={() => { if (!exemplesEnCours) setExemplesOuverts(false); }}>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <p>Rien n’est remplacé : les exemples s’ajoutent à ce qui existe déjà, et tout ce qui porte le même nom est ignoré.</p>
        <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
          <li>Comptes bancaires à ajouter : <strong>{fichesExemple.comptes.length}</strong> (BNI/C et BNI/D avec leur RIB)</li>
          <li>Clients et fournisseurs à ajouter : <strong>{fichesExemple.tiers.length}</strong></li>
          <li>Virements d’exemple : {virementsExemple.length
            ? <strong>{virementsExemple.length} ({virementsExemple.filter(v => v.sens === 'RECETTE').length} recette(s) reçue(s) et {virementsExemple.filter(v => v.sens === 'DEPENSE').length} DED payée(s))</strong>
            : <span>non proposés, car ce registre contient déjà des virements</span>}</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400">Vous pourrez corriger ou supprimer chaque fiche et chaque virement depuis ce livre.</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={exemplesEnCours} onClick={() => setExemplesOuverts(false)}>Annuler</button>
        <button type="button" className="btn-primary" disabled={exemplesEnCours} onClick={() => void chargerExemples()}>{exemplesEnCours ? 'Chargement…' : 'Charger les exemples'}</button>
      </div>
    </Modale>}
    {impression && <ModaleBordereau ligne={impression.ligne} entete={entete} compteVirement={impression.compte} onFermer={() => setImpression(null)} onErreur={() => setErreur('Impossible d’ouvrir l’impression du bordereau.')} />}
    {ordre && <ModaleOrdreVirement virement={ordre.virement} compte={ordre.compte} entete={entete} inclureEtat={ordre.inclureEtat} onFermer={() => setOrdre(null)} onErreur={() => setErreur("Impossible de confirmer l’ouverture de l’impression de l’ordre de virement. Réessayez depuis la ligne du virement.")} />}
  </section>;
}
