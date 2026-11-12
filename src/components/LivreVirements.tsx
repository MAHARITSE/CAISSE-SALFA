import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Landmark, Pencil, Plus, Printer,
  Search, SlidersHorizontal, X,
} from 'lucide-react';
import type { Categories, LigneJournal, Sens } from '../types';
import type { ActionVirement } from '../utils/api';
import type { EnteteDocument } from '../utils/entete';
import { aujourdHui, dateFr, formatAr, moisCourant, montantAffiche, parserMontant } from '../utils/format';
import { identifiant } from '../utils/ledger';
import type { CompteVirement, RegistreVirements, Virement } from '../utils/virements';
import { ajouterVirement, ribComplet } from '../utils/virements';
import { Modale } from './Modale';
import { ModaleBordereau } from './Bordereau';
import { ModaleOrdreVirement } from './OrdreVirement';
import { GestionTiersVirements } from './GestionTiersVirements';

interface Props {
  registre: RegistreVirements;
  categories: Categories;
  entete: EnteteDocument;
  onMutation: (action: ActionVirement) => Promise<boolean>;
  erreurExterne: string | null;
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


export function LivreVirements({ registre, categories, entete, onMutation, erreurExterne }: Props) {
  const [edition, setEdition] = useState<Virement | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [filtreCompte, setFiltreCompte] = useState('');
  const [filtreSens, setFiltreSens] = useState<'TOUS' | Sens>('TOUS');
  /** Période affichée : un mois précis, ou tout l'historique du registre. */
  const [toutAfficher, setToutAfficher] = useState(true);
  const [filtreMois, setFiltreMois] = useState(moisCourant());
  const [recherche, setRecherche] = useState('');
  /** Les cartes de synthèse se replient, comme celles du livre journal. */
  const [afficherSynthese, setAfficherSynthese] = useState(true);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const soumission = useRef(false);
  const [impression, setImpression] = useState<{ ligne: LigneJournal; compte: CompteVirement } | null>(null);
  /** Ordre de virement imprimé juste après l'enregistrement d'une DED. */
  const [ordre, setOrdre] = useState<{ virement: Virement; compte: CompteVirement } | null>(null);
  const comptes = useMemo(() => new Map(registre.comptes.map(c => [c.id, c])), [registre.comptes]);
  const fiches = useMemo(() => new Map(registre.tiers.map(t => [t.id, t])), [registre.tiers]);
  const lignes = useMemo(() => registre.ecritures.filter(v => {
    if (filtreCompte && v.compteId !== filtreCompte) return false;
    if (filtreSens !== 'TOUS' && v.sens !== filtreSens) return false;
    if (!toutAfficher && !v.date.startsWith(filtreMois)) return false;
    const q = recherche.trim().toLocaleLowerCase('fr');
    return !q || [v.numero, v.libelle, v.categorie, v.tiers, v.reference, comptes.get(v.compteId)?.banque, comptes.get(v.compteId)?.numeroCompte].some(t => t?.toLocaleLowerCase('fr').includes(q));
  }).slice().sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero)), [registre, filtreCompte, filtreSens, toutAfficher, filtreMois, recherche, comptes]);
  /** Totaux de la sélection affichée : ils suivent les filtres, comme au journal. */
  const total = (sens: Sens) => lignes.filter(v => v.sens === sens).reduce((s, v) => s + v.montant, 0);
  const recettes = total('RECETTE');
  const depenses = total('DEPENSE');
  const filtreActif = Boolean(filtreCompte || filtreSens !== 'TOUS' || recherche.trim() || !toutAfficher);
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
  function reinitialiser() {
    setFiltreCompte(''); setFiltreSens('TOUS'); setRecherche(''); setToutAfficher(true);
  }
  /** La saisie reste fermée tant qu'aucun compte n'est réglé (Administration). */
  const saisiePossible = registre.comptes.length > 0;

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
      tiers: v.tiers, reference: v.reference, observation: v.observation, montant: String(v.montant),
      beneficiaireAdresse: v.beneficiaireAdresse ?? '', beneficiaireBanque: v.beneficiaireBanque ?? '',
      beneficiaireCompte: v.beneficiaireCompte ?? '', permanent: v.permanent === true,
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
      beneficiaireCompte: fiche?.numeroCompte ?? '',
    } : f);
  }
  async function enregistrerVirement(event: FormEvent) {
    event.preventDefault();
    if (!formulaire || soumission.current) return;
    const montant = parserMontant(formulaire.montant);
    if (montant === null || montant <= 0) { setErreur('Saisissez un montant entier supérieur à zéro.'); return; }
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
      ...commun, montant,
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
        setFormulaire(null); setEdition(null);
        // Toute autorisation de dépense par virement part à la banque : l'ordre de
        // virement s'imprime aussitôt, sur une demi-feuille A4, sans action de plus.
        const compte = comptes.get(base.compteId);
        if (!edition && base.sens === 'DEPENSE' && compte && numero) {
          setOrdre({ virement: { ...base, numero } as Virement, compte });
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
        return { ...v, libelle: `${v.libelle}\nBanque : ${compte.banque} · Compte : ${compte.numeroCompte || 'non renseigné'}`, solde: 0 };
      });
      // La période imprimée est celle de la sélection, pas un mois par défaut.
      ouvrirEtatPourImpression(selection, entete, periode, fenetre, true);
    } catch (e) { fenetre.close(); setErreur(e instanceof Error ? e.message : 'Impression impossible.'); }
  }
  const libelleCompte = (c: CompteVirement) => `${c.banque} — ${c.numeroCompte || 'numéro non renseigné'}`;
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

    {/* Période, filtres et nouvelles pièces, dans une barre unique comme au journal. */}
    <section className="card space-y-3 p-4" aria-label="Période, filtres et nouvelles pièces">
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
          {(['TOUS', 'RECETTE', 'DEPENSE'] as const).map(sens => <button key={sens} type="button" aria-pressed={filtreSens === sens} onClick={() => setFiltreSens(sens)}>{sens === 'TOUS' ? 'Tous' : sens === 'RECETTE' ? 'Recettes' : 'DED / dépenses'}</button>)}
        </div>
        <select className="field !w-auto max-w-56 !py-2 !text-sm" aria-label="Filtrer par compte" value={filtreCompte} onChange={e => setFiltreCompte(e.target.value)}>
          <option value="">Tous les comptes</option>
          {registre.comptes.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}
        </select>
        <div className="relative min-w-44 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input type="search" className="field !py-2 !pl-9 !text-sm" aria-label="Rechercher dans les virements" placeholder="Rechercher une pièce, un libellé, un bénéficiaire…" value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        {filtreActif && <button type="button" className="icon-button" title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres" onClick={reinitialiser}><X size={16} /></button>}
        <span className="hidden items-center gap-1 text-xs text-slate-400 dark:text-slate-500 xl:flex"><SlidersHorizontal size={14} />{filtreActif ? 'Filtres actifs' : 'Aucun filtre'}</span>
      </div>
    </section>

    {erreur && !formulaire && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Virements enregistrés"><thead><tr>{['Date', 'N°', 'Compte bancaire', 'Type', 'Libellé', 'Catégorie', 'Montant', 'Actions'].map(x => <th key={x} className="border-b p-3">{x}</th>)}</tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Aucun virement pour cette sélection.</td></tr>}
      {lignes.map(v => <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700"><td className="p-3 whitespace-nowrap">{dateFr(v.date)}</td><td className="p-3">{v.numero}</td><td className="p-3">{comptes.get(v.compteId) ? libelleCompte(comptes.get(v.compteId)!) : 'Compte introuvable'}</td><td className="p-3">{v.sens === 'RECETTE' ? 'Recette' : 'DED'}</td><td className="p-3">{v.libelle}</td><td className="p-3">{v.categorie}</td><td className="p-3 whitespace-nowrap text-right">{montantAffiche(v.montant)}</td><td className="p-3 whitespace-nowrap"><button type="button" className="icon-button" title="Modifier" aria-label={`Modifier ${v.numero}`} onClick={() => modifier(v)}><Pencil size={16} /></button><button type="button" className="icon-button" title="Imprimer le bordereau" aria-label={`Imprimer le bordereau ${v.numero}`} onClick={() => imprimerPiece(v)}><Printer size={16} /></button>{v.sens === 'DEPENSE' && <button type="button" className="icon-button" title="Réimprimer l’ordre de virement" aria-label={`Imprimer l’ordre de virement ${v.numero}`} onClick={() => imprimerOrdre(v)}><Landmark size={16} /></button>}</td></tr>)}
    </tbody></table></div>
    {formulaire && <Modale titre={edition ? `Modifier ${edition.numero}` : formulaire.sens === 'RECETTE' ? 'Nouvelle recette par virement' : 'Nouvelle DED par virement'} onFermer={() => { if (!occupe) { setFormulaire(null); setErreur(''); } }}><form className="space-y-3" onSubmit={e => void enregistrerVirement(e)}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Date du virement<input className="field" type="date" required value={formulaire.date} onChange={e => champ('date', e.target.value)} /></label><label className="label">Compte bancaire<select className="field" required value={formulaire.compteId} onChange={e => champ('compteId', e.target.value)}>{registre.comptes.map(c => <option value={c.id} key={c.id}>{libelleCompte(c)}</option>)}</select></label></div>
      <label className="label">Libellé<input className="field" required maxLength={200} value={formulaire.libelle} onChange={e => champ('libelle', e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Catégorie<select className="field" required value={formulaire.categorie} onChange={e => champ('categorie', e.target.value)}>{[...new Set([...listeCategories, ...(edition ? [edition.categorie] : [])])].map(c => <option key={c}>{c}</option>)}</select></label><label className="label">Montant (Ar)<input className="field" inputMode="numeric" required value={formulaire.montant} onChange={e => champ('montant', e.target.value)} /></label></div>
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
      <label className="label">Référence du virement<input className="field" maxLength={200} value={formulaire.reference} onChange={e => champ('reference', e.target.value)} /></label>
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Ordre de virement remis à la banque</legend>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Ces mentions viennent de la fiche du bénéficiaire et figurent sur l’ordre de virement 114018. Une mention laissée vide reste en blanc sur le papier.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Adresse du bénéficiaire<input className="field" maxLength={200} value={formulaire.beneficiaireAdresse} onChange={e => champ('beneficiaireAdresse', e.target.value)} /></label>
          <label className="label">Établissement bancaire du bénéficiaire<input className="field" maxLength={200} value={formulaire.beneficiaireBanque} onChange={e => champ('beneficiaireBanque', e.target.value)} placeholder="BNI, BOA, CCP…" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Compte ou RIB du bénéficiaire<input className="field" maxLength={200} value={formulaire.beneficiaireCompte} onChange={e => champ('beneficiaireCompte', e.target.value)} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={formulaire.permanent} onChange={e => champ('permanent', e.target.checked)} />Virement permanent</label>
        </div>
      </fieldset>
      <label className="label">Observation<textarea className="field" maxLength={500} value={formulaire.observation} onChange={e => champ('observation', e.target.value)} /></label>
      {(erreur || erreurExterne) && <p role="alert" className="text-sm text-rose-700">{erreurExterne || erreur}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={occupe} onClick={() => setFormulaire(null)}>Annuler</button><button className="btn-primary" disabled={occupe}>Enregistrer</button></div>
    </form></Modale>}
    {/* Clients et fournisseurs : le bénéficiaire de chaque virement vient d'ici. */}
    <div className="card p-5" role="region" aria-label="Clients et fournisseurs">
      <GestionTiersVirements registre={registre} onMutation={onMutation} erreurExterne={erreurExterne} />
    </div>
    {impression && <ModaleBordereau ligne={impression.ligne} entete={entete} compteVirement={impression.compte} onFermer={() => setImpression(null)} onErreur={() => setErreur('Impossible d’ouvrir l’impression du bordereau.')} />}
    {ordre && <ModaleOrdreVirement virement={ordre.virement} compte={ordre.compte} entete={entete} onFermer={() => setOrdre(null)} onErreur={() => setErreur("Impossible de confirmer l’ouverture de l’impression de l’ordre de virement. Réessayez depuis la ligne du virement.")} />}
  </section>;
}
