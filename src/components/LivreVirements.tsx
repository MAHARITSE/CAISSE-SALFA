import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, Printer, Pencil, Landmark } from 'lucide-react';
import type { Categories, LigneJournal, Sens } from '../types';
import type { ActionVirement } from '../utils/api';
import type { EnteteDocument } from '../utils/entete';
import { aujourdHui, dateFr, montantAffiche, parserMontant } from '../utils/format';
import { identifiant } from '../utils/ledger';
import type { CompteVirement, RegistreVirements, Virement } from '../utils/virements';
import { ajouterVirement } from '../utils/virements';
import { Modale } from './Modale';
import { ModaleBordereau } from './Bordereau';
import { ModaleOrdreVirement } from './OrdreVirement';

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
};

type CompteForm = { banque: string; numeroCompte: string; titulaire: string; adresse: string; codeBanque: string };

export function LivreVirements({ registre, categories, entete, onMutation, erreurExterne }: Props) {
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [compteEdite, setCompteEdite] = useState<CompteVirement | null>(null);
  const [compteForm, setCompteForm] = useState<CompteForm>({ banque: '', numeroCompte: '', titulaire: '', adresse: '', codeBanque: '' });
  const [edition, setEdition] = useState<Virement | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [filtreCompte, setFiltreCompte] = useState('');
  const [filtreSens, setFiltreSens] = useState<'TOUS' | Sens>('TOUS');
  const [filtreMois, setFiltreMois] = useState('');
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const soumission = useRef(false);
  const [impression, setImpression] = useState<{ ligne: LigneJournal; compte: CompteVirement } | null>(null);
  /** Ordre de virement imprimé juste après l'enregistrement d'une DED. */
  const [ordre, setOrdre] = useState<{ virement: Virement; compte: CompteVirement } | null>(null);
  const comptes = useMemo(() => new Map(registre.comptes.map(c => [c.id, c])), [registre.comptes]);
  const lignes = useMemo(() => registre.ecritures.filter(v => {
    if (filtreCompte && v.compteId !== filtreCompte) return false;
    if (filtreSens !== 'TOUS' && v.sens !== filtreSens) return false;
    if (filtreMois && !v.date.startsWith(filtreMois)) return false;
    const q = recherche.trim().toLocaleLowerCase('fr');
    return !q || [v.numero, v.libelle, v.categorie, v.tiers, v.reference, comptes.get(v.compteId)?.banque, comptes.get(v.compteId)?.numeroCompte].some(t => t?.toLocaleLowerCase('fr').includes(q));
  }).slice().sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero)), [registre, filtreCompte, filtreSens, filtreMois, recherche, comptes]);
  const nomsBniManquants = ['BNI/C', 'BNI/D'].filter(nom => !registre.comptes.some(c => c.banque.toLocaleUpperCase('fr') === nom));
  const total = (sens: Sens) => lignes.filter(v => v.sens === sens).reduce((s, v) => s + v.montant, 0);

  function nouveau(sens: Sens) {
    setEdition(null); setErreur('');
    setFormulaire({
      date: aujourdHui(), sens, compteId: registre.comptes[0]?.id ?? '', libelle: '',
      categorie: (sens === 'RECETTE' ? categories.recette : categories.depense)[0] ?? '',
      tiers: '', reference: '', observation: '', montant: '',
      beneficiaireAdresse: '', beneficiaireBanque: '', beneficiaireCompte: '', permanent: false,
    });
  }
  function modifier(v: Virement) {
    setEdition(v); setErreur('');
    setFormulaire({
      date: v.date, sens: v.sens, compteId: v.compteId, libelle: v.libelle, categorie: v.categorie,
      tiers: v.tiers, reference: v.reference, observation: v.observation, montant: String(v.montant),
      beneficiaireAdresse: v.beneficiaireAdresse ?? '', beneficiaireBanque: v.beneficiaireBanque ?? '',
      beneficiaireCompte: v.beneficiaireCompte ?? '', permanent: v.permanent === true,
    });
  }
  function champ<K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) { setFormulaire(f => f ? { ...f, [cle]: valeur } : f); }
  async function enregistrerCompte(event: FormEvent) {
    event.preventDefault();
    if (soumission.current) return;
    if (!compteForm.banque.trim()) { setErreur('Renseignez le nom de la banque ou du compte.'); return; }
    if (compteForm.codeBanque.trim() && !/^\d{5}$/.test(compteForm.codeBanque.trim())) {
      setErreur('Le code banque du RIB comporte cinq chiffres.');
      return;
    }
    soumission.current = true; setOccupe(true); setErreur('');
    try {
      const compte: CompteVirement = {
        id: compteEdite?.id ?? identifiant('banque'),
        banque: compteForm.banque.trim(),
        numeroCompte: compteForm.numeroCompte.trim(),
        ...(compteForm.titulaire.trim() ? { titulaire: compteForm.titulaire.trim() } : {}),
        ...(compteForm.adresse.trim() ? { adresse: compteForm.adresse.trim() } : {}),
        ...(compteForm.codeBanque.trim() ? { codeBanque: compteForm.codeBanque.trim() } : {}),
      };
      const action: ActionVirement = compteEdite ? { operation: 'modifier_compte', compte } : { operation: 'ajouter_compte', compte };
      if (await onMutation(action)) {
        setCompteOuvert(false); setCompteEdite(null);
        setCompteForm({ banque: '', numeroCompte: '', titulaire: '', adresse: '', codeBanque: '' });
      } else setErreur('Compte non enregistré. Vérifiez le message et réessayez.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Compte non enregistré.'); }
    finally { soumission.current = false; setOccupe(false); }
  }
  async function preparerComptesBni() {
    if (soumission.current || !nomsBniManquants.length) return;
    soumission.current = true; setOccupe(true); setErreur('');
    try {
      const nouveaux = nomsBniManquants.map(banque => ({ id: identifiant('banque'), banque, numeroCompte: '' }));
      if (!await onMutation({ operation: 'ajouter_comptes', comptes: nouveaux })) setErreur('Comptes non enregistrés. Vérifiez le message et réessayez.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Comptes non enregistrés.'); }
    finally { soumission.current = false; setOccupe(false); }
  }
  function ouvrirCompte(compte?: CompteVirement) {
    setCompteEdite(compte ?? null);
    setCompteForm({
      banque: compte?.banque ?? '', numeroCompte: compte?.numeroCompte ?? '',
      titulaire: compte?.titulaire ?? '', adresse: compte?.adresse ?? '', codeBanque: compte?.codeBanque ?? '',
    });
    setErreur(''); setCompteOuvert(true);
  }
  function champCompte<K extends keyof CompteForm>(cle: K, valeurCompte: CompteForm[K]) {
    setCompteForm(f => ({ ...f, [cle]: valeurCompte }));
  }
  async function enregistrerVirement(event: FormEvent) {
    event.preventDefault();
    if (!formulaire || soumission.current) return;
    const montant = parserMontant(formulaire.montant);
    if (montant === null || montant <= 0) { setErreur('Saisissez un montant entier supérieur à zéro.'); return; }
    soumission.current = true; setOccupe(true); setErreur('');
    const { beneficiaireAdresse, beneficiaireBanque, beneficiaireCompte, permanent, ...commun } = formulaire;
    const base = {
      ...commun, montant,
      ...(beneficiaireAdresse.trim() ? { beneficiaireAdresse: beneficiaireAdresse.trim() } : {}),
      ...(beneficiaireBanque.trim() ? { beneficiaireBanque: beneficiaireBanque.trim() } : {}),
      ...(beneficiaireCompte.trim() ? { beneficiaireCompte: beneficiaireCompte.trim() } : {}),
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
      ouvrirEtatPourImpression(selection, entete, filtreMois || 'Toutes périodes', fenetre, true);
    } catch (e) { fenetre.close(); setErreur(e instanceof Error ? e.message : 'Impression impossible.'); }
  }
  const libelleCompte = (c: CompteVirement) => `${c.banque} — ${c.numeroCompte || 'numéro non renseigné'}`;
  const listeCategories = formulaire ? (formulaire.sens === 'RECETTE' ? categories.recette : categories.depense) : [];

  return <section className="space-y-4" aria-label="Livre des virements">
    <p className="text-sm text-slate-600 dark:text-slate-300">Registre bancaire indépendant : ces opérations ne modifient pas le solde de la caisse en espèces.</p>
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => ouvrirCompte()}><Plus size={16} />Ajouter un compte bancaire</button>
        {nomsBniManquants.length > 0 && <button type="button" className="btn-secondary" disabled={occupe} onClick={() => void preparerComptesBni()}><Plus size={16} />Préparer BNI/C et BNI/D</button>}
        <button type="button" className="btn-primary" disabled={!registre.comptes.length} onClick={() => nouveau('RECETTE')}><Plus size={16} />Nouvelle recette par virement</button>
        <button type="button" className="btn-danger" disabled={!registre.comptes.length} onClick={() => nouveau('DEPENSE')}><Plus size={16} />Nouvelle DED par virement</button>
        <button type="button" className="btn-secondary" disabled={!lignes.length} onClick={() => void imprimerEtat()}><Printer size={16} />Imprimer l’état des virements</button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">Chaque DED par virement s’imprime aussitôt sur une demi-feuille A4 : l’ordre de virement part à la banque, la souche reste dans le dossier.</p>
      {registre.comptes.length > 0 && <div className="space-y-1 text-sm"><p className="font-semibold">Comptes bancaires</p><ul className="flex flex-wrap gap-x-4 gap-y-2">{registre.comptes.map(c => <li key={c.id} className="flex items-center gap-1"><span>{libelleCompte(c)}</span><button type="button" className="icon-button" title="Modifier le compte" aria-label={`Modifier le compte ${c.banque}`} onClick={() => ouvrirCompte(c)}><Pencil size={15} /></button></li>)}</ul><p className="text-slate-500">Un numéro non renseigné peut être complété ultérieurement.</p></div>}
      {!registre.comptes.length && <p className="text-sm text-slate-500">Ajoutez d’abord un compte bancaire pour saisir un virement.</p>}
      <div className="flex flex-wrap gap-2">
        <label className="text-sm">Compte<select className="field" value={filtreCompte} onChange={e => setFiltreCompte(e.target.value)}><option value="">Tous les comptes</option>{registre.comptes.map(c => <option key={c.id} value={c.id}>{libelleCompte(c)}</option>)}</select></label>
        <label className="text-sm">Type<select className="field" value={filtreSens} onChange={e => setFiltreSens(e.target.value as 'TOUS' | Sens)}><option value="TOUS">Tous</option><option value="RECETTE">Recettes</option><option value="DEPENSE">DED / dépenses</option></select></label>
        <label className="text-sm">Mois<input className="field" type="month" value={filtreMois} onChange={e => setFiltreMois(e.target.value)} /></label>
        <label className="text-sm">Rechercher<input className="field" type="search" value={recherche} onChange={e => setRecherche(e.target.value)} /></label>
      </div>
      <p className="text-sm">{lignes.length} virement(s) · Recettes : {montantAffiche(total('RECETTE'))} Ar · Dépenses : {montantAffiche(total('DEPENSE'))} Ar</p>
    </div>
    {erreur && !formulaire && !compteOuvert && <p role="alert" className="text-sm text-rose-700">{erreur}</p>}
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Virements enregistrés"><thead><tr>{['Date', 'N°', 'Compte bancaire', 'Type', 'Libellé', 'Catégorie', 'Montant', 'Actions'].map(x => <th key={x} className="border-b p-3">{x}</th>)}</tr></thead><tbody>
      {lignes.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Aucun virement pour cette sélection.</td></tr>}
      {lignes.map(v => <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700"><td className="p-3 whitespace-nowrap">{dateFr(v.date)}</td><td className="p-3">{v.numero}</td><td className="p-3">{comptes.get(v.compteId) ? libelleCompte(comptes.get(v.compteId)!) : 'Compte introuvable'}</td><td className="p-3">{v.sens === 'RECETTE' ? 'Recette' : 'DED'}</td><td className="p-3">{v.libelle}</td><td className="p-3">{v.categorie}</td><td className="p-3 whitespace-nowrap text-right">{montantAffiche(v.montant)}</td><td className="p-3 whitespace-nowrap"><button type="button" className="icon-button" title="Modifier" aria-label={`Modifier ${v.numero}`} onClick={() => modifier(v)}><Pencil size={16} /></button><button type="button" className="icon-button" title="Imprimer le bordereau" aria-label={`Imprimer le bordereau ${v.numero}`} onClick={() => imprimerPiece(v)}><Printer size={16} /></button>{v.sens === 'DEPENSE' && <button type="button" className="icon-button" title="Réimprimer l’ordre de virement" aria-label={`Imprimer l’ordre de virement ${v.numero}`} onClick={() => imprimerOrdre(v)}><Landmark size={16} /></button>}</td></tr>)}
    </tbody></table></div>
    {compteOuvert && <Modale titre={compteEdite ? 'Modifier un compte bancaire' : 'Ajouter un compte bancaire'} onFermer={() => { if (!occupe) { setCompteOuvert(false); setErreur(''); } }}><form className="space-y-3" onSubmit={e => void enregistrerCompte(e)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Banque<input className="field" required maxLength={120} value={compteForm.banque} onChange={e => champCompte('banque', e.target.value)} /></label>
        <label className="label">Numéro de compte<input className="field" maxLength={120} value={compteForm.numeroCompte} onChange={e => champCompte('numeroCompte', e.target.value)} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Titulaire du compte (donneur d’ordre)<input className="field" maxLength={200} value={compteForm.titulaire} onChange={e => champCompte('titulaire', e.target.value)} placeholder="SALFA — Hôpital Loterana Toliary Tanambao" /></label>
        <label className="label">Adresse du titulaire<input className="field" maxLength={200} value={compteForm.adresse} onChange={e => champCompte('adresse', e.target.value)} placeholder="BP 99 — Toliara" /></label>
      </div>
      <label className="label">Code banque du RIB (5 chiffres)<input className="field" inputMode="numeric" maxLength={5} value={compteForm.codeBanque} onChange={e => champCompte('codeBanque', e.target.value.replace(/\D/g, ''))} placeholder="00005" /></label>
      <p className="text-sm text-slate-500">Le numéro peut être renseigné plus tard. Toute correction du compte apparaîtra également sur les anciens virements et leurs impressions. Le titulaire, l’adresse et le code banque sont imprimés sur l’ordre de virement remis à la banque.</p>
      {(erreur || erreurExterne) && <p role="alert" className="text-sm text-rose-700">{erreurExterne || erreur}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={occupe} onClick={() => setCompteOuvert(false)}>Annuler</button><button className="btn-primary" disabled={occupe}>Enregistrer le compte</button></div>
    </form></Modale>}
    {formulaire && <Modale titre={edition ? `Modifier ${edition.numero}` : formulaire.sens === 'RECETTE' ? 'Nouvelle recette par virement' : 'Nouvelle DED par virement'} onFermer={() => { if (!occupe) { setFormulaire(null); setErreur(''); } }}><form className="space-y-3" onSubmit={e => void enregistrerVirement(e)}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Date du virement<input className="field" type="date" required value={formulaire.date} onChange={e => champ('date', e.target.value)} /></label><label className="label">Compte bancaire<select className="field" required value={formulaire.compteId} onChange={e => champ('compteId', e.target.value)}>{registre.comptes.map(c => <option value={c.id} key={c.id}>{libelleCompte(c)}</option>)}</select></label></div>
      <label className="label">Libellé<input className="field" required maxLength={200} value={formulaire.libelle} onChange={e => champ('libelle', e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Catégorie<select className="field" required value={formulaire.categorie} onChange={e => champ('categorie', e.target.value)}>{[...new Set([...listeCategories, ...(edition ? [edition.categorie] : [])])].map(c => <option key={c}>{c}</option>)}</select></label><label className="label">Montant (Ar)<input className="field" inputMode="numeric" required value={formulaire.montant} onChange={e => champ('montant', e.target.value)} /></label></div>
      <label className="label">Tiers / bénéficiaire<input className="field" maxLength={200} value={formulaire.tiers} onChange={e => champ('tiers', e.target.value)} /></label>
      <label className="label">Référence du virement<input className="field" maxLength={200} value={formulaire.reference} onChange={e => champ('reference', e.target.value)} /></label>
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Ordre de virement remis à la banque</legend>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Ces mentions figurent sur le formulaire 114018 imprimé automatiquement. Une mention laissée vide reste en blanc sur le papier, à compléter à la main.</p>
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
    {impression && <ModaleBordereau ligne={impression.ligne} entete={entete} compteVirement={impression.compte} onFermer={() => setImpression(null)} onErreur={() => setErreur('Impossible d’ouvrir l’impression du bordereau.')} />}
    {ordre && <ModaleOrdreVirement virement={ordre.virement} compte={ordre.compte} entete={entete} onFermer={() => setOrdre(null)} onErreur={() => setErreur("Impossible de confirmer l’ouverture de l’impression de l’ordre de virement. Réessayez depuis la ligne du virement.")} />}
  </section>;
}
