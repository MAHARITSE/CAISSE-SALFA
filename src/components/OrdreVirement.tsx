import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import bniLogo from '../assets/logo-bni.png?inline';
import type { CompteVirement, Virement } from '../utils/virements';
import { dateFr } from '../utils/format';
import { nombreEnLettres } from '../utils/nombreEnLettres';
import { enteteParDefaut, type EnteteDocument } from '../utils/entete';

/**
 * Ordre de virement bancaire au format BNI Madagascar (imprimé 114018).
 *
 * Le formulaire d'origine est prévu pour la moitié haute d'une feuille A4.
 * Imprimé seul sur une page entière, sa moitié basse était perdue : la feuille
 * est donc remplie jusqu'à 140 mm, un trait de découpe sépare la partie utile,
 * et la moitié basse répète le même ordre. Quelle que soit la moitié détachée,
 * la banque reçoit une pièce complète et le dossier conserve sa souche.
 *
 * Les cotes sont fixes, en millimètres, pour que le document garde la même
 * géométrie à l'écran et sur le papier, quel que soit le zoom du navigateur :
 * page A4 portrait 210 × 297 mm, marges de 7 mm, une ligne par mention.
 */

/**
 * Cotes de la feuille, en millimètres — une seule source de vérité.
 *
 * Elles sont transmises au CSS par des variables : le document ne peut pas
 * dériver entre le calcul et l'impression. Le total reste sous les 297 mm d'une
 * A4 avec 7 mm de sécurité, pour qu'aucune imprimante ne sorte une seconde page
 * presque vide. Un test vérifie cette somme.
 */
export const COTES_ORDRE_VIR = {
  largeurFeuille: 210,
  hauteurFeuille: 297,
  /** Marge de la feuille, haut et bas. */
  margeFeuille: 5,
  /** Hauteur imprimée d'un ordre de virement : environ la moitié d'une A4. */
  hauteurMoitie: 135,
  /** Bande du trait de découpe entre les deux moitiés. */
  hauteurDecoupe: 10,
  /** Marge non imprimable laissée libre sous le second ordre. */
  securite: 7,
};

/** Hauteur totale occupée par la feuille imprimée, en millimètres. */
export function hauteurTotaleFeuille(): number {
  return 2 * COTES_ORDRE_VIR.margeFeuille
    + 2 * COTES_ORDRE_VIR.hauteurMoitie
    + COTES_ORDRE_VIR.hauteurDecoupe;
}

/** Cotes passées au CSS : la feuille et ses moitiés gardent ces dimensions. */
function styleFeuille(): CSSProperties {
  return {
    '--ordre-largeur': `${COTES_ORDRE_VIR.largeurFeuille}mm`,
    '--ordre-hauteur-feuille': `${COTES_ORDRE_VIR.hauteurFeuille}mm`,
    '--ordre-marge': `${COTES_ORDRE_VIR.margeFeuille}mm`,
    '--ordre-hauteur-moitie': `${COTES_ORDRE_VIR.hauteurMoitie}mm`,
    '--ordre-hauteur-decoupe': `${COTES_ORDRE_VIR.hauteurDecoupe}mm`,
  } as CSSProperties;
}

/** Identité imprimée du donneur d'ordre, reprise de l'en-tête de l'hôpital. */
const DONNEUR_PAR_DEFAUT = {
  titulaire: 'SALFA — HOPITALY LOTERANA TOLIARY TANAMBAO',
  adresse: 'BP 99 — Toliara, Madagascar',
};

/** Lignes de l'en-tête de l'hôpital qui nomment l'établissement et son adresse. */
function identiteEntete(entete?: EnteteDocument | null): Partial<typeof DONNEUR_PAR_DEFAUT> {
  const textes = (entete ?? enteteParDefaut()).lignes
    .map(ligne => ligne.texte.trim())
    .filter(texte => texte !== '');
  if (!textes.length) return {};
  // L'adresse porte la boîte postale, comme sur les imprimés de l'hôpital.
  const adresse = textes.find(texte => /\bBP\b/i.test(texte));
  const titulaire = textes
    .filter(texte => texte !== adresse)
    .sort((a, b) => b.length - a.length)[0];
  return {
    ...(titulaire ? { titulaire } : {}),
    ...(adresse ? { adresse } : {}),
  };
}

export interface DonneesOrdreVirement {
  virement: Virement;
  compte: CompteVirement;
  entete?: EnteteDocument | null;
}

/** Montant du modèle : séparateur de milliers insécable et deux décimales. */
export function montantOrdre(montant: number): string {
  const [entier, decimales] = montant.toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')},${decimales}`;
}

/** Une valeur absente laisse la case vide, à compléter à la main sur le papier. */
const valeur = (texte?: string): string => (texte ?? '').trim();

/** Une ligne « libellé : valeur » du formulaire. */
function Ligne({ etiquette, texte }: { etiquette: string; texte?: string }) {
  return <p className="ordre-virement__ligne">
    <span className="ordre-virement__etiquette">{etiquette}</span>
    <span className="ordre-virement__valeur">{valeur(texte)}</span>
  </p>;
}

/** Case à cocher du modèle : cochée, ou laissée vide pour être cochée à la main. */
function Case({ coche, libelle }: { coche: boolean; libelle: string }) {
  return <span className="ordre-virement__case">
    <span className="ordre-virement__case-carre" aria-hidden="true">{coche ? '✕' : ''}</span>{' '}
    <span>{libelle}</span>
  </span>;
}

/**
 * Un ordre de virement complet : client donneur d'ordre, ordre lui-même,
 * bénéficiaire, total et signatures. Le second bénéficiaire du modèle reste en
 * blanc : la caisse n'effectue qu'un virement par autorisation de dépense.
 */
function BlocOrdre({ virement, compte, identite, souche }: DonneesOrdreVirement & {
  identite: { titulaire: string; adresse: string };
  souche: boolean;
}) {
  const nomBeneficiaire = valeur(virement.tiers);
  return <section
    className={`ordre-virement${souche ? ' ordre-virement--souche' : ''}`}
    aria-label={souche ? 'Ordre de virement — souche à conserver' : 'Ordre de virement — exemplaire pour la banque'}
  >
    <header className="ordre-virement__entete">
      <img src={bniLogo} alt="BNI Madagascar" className="ordre-virement__logo" />
      <div className="ordre-virement__titre">
        <p>ORDRE DE VIREMENT</p>
        <p>EN ARIARY</p>
        <p className="ordre-virement__titre-client">CLIENT DONNEUR D’ORDRE</p>
      </div>
      <div className="ordre-virement__modele">
        <p>Formulaire 114018</p>
        <p className="ordre-virement__souche-marque">{souche ? 'SOUCHE — à conserver' : 'EXEMPLAIRE BANQUE'}</p>
        <p className="ordre-virement__piece">Pièce {virement.numero}</p>
      </div>
    </header>

    <div className="ordre-virement__client">
      <Ligne etiquette="Nom et prénoms :" texte={compte.titulaire || identite.titulaire} />
      <Ligne etiquette="Adresse :" texte={compte.adresse || identite.adresse} />
      <div className="ordre-virement__rib">
        <span className="ordre-virement__etiquette">RIB :</span>
        <span className="ordre-virement__code">{compte.codeBanque || '00005'}</span>
        <span className="ordre-virement__valeur">{valeur(compte.numeroCompte)}</span>
        <span className="ordre-virement__banque">{compte.banque}</span>
      </div>
    </div>

    <p className="ordre-virement__instruction">
      PAR LE DEBIT DE MON COMPTE, VEUILLEZ EXECUTER L’ORDRE DE VIREMENT{' '}
      <Case coche={virement.permanent === true} libelle="PERMANENT" /> /{' '}
      <Case coche={virement.permanent !== true} libelle="OCCASIONNEL" /> (1) SUIVANT :{' '}
      <span className="ordre-virement__reference">Référence : {valeur(virement.reference) || virement.numero}</span>
    </p>

    <div className="ordre-virement__debiter">
      <span className="ordre-virement__etiquette">VEUILLEZ DÉBITER AU COMPTE N°</span>
      <span className="ordre-virement__valeur">{valeur(compte.numeroCompte)}</span>
      <span className="ordre-virement__banque">{compte.banque}</span>
    </div>

    <div className="ordre-virement__beneficiaire">
      <p className="ordre-virement__rang">1</p>
      <div className="ordre-virement__beneficiaire-corps">
        <p className="ordre-virement__sous-titre">VIRER AU CREDIT DU COMPTE DE</p>
        <Ligne etiquette="Nom et prénoms :" texte={nomBeneficiaire} />
        <Ligne etiquette="Adresse :" texte={virement.beneficiaireAdresse} />
        <Ligne etiquette="Etablissement bancaire ou CCP :" texte={virement.beneficiaireBanque} />
        <Ligne etiquette="Compte ou RIB :" texte={virement.beneficiaireCompte} />
      </div>
      <div className="ordre-virement__montant">
        <p className="ordre-virement__sous-titre">MONTANT (en chiffres)</p>
        <p className="ordre-virement__montant-valeur">{montantOrdre(virement.montant)}</p>
        <p className="ordre-virement__devise">ARIARY</p>
      </div>
    </div>

    <div className="ordre-virement__total">
      <div>
        <p className="ordre-virement__sous-titre">TOTAL A VIRER (en lettres)</p>
        <p className="ordre-virement__lettres">{nombreEnLettres(virement.montant)} Ariary</p>
      </div>
      <div className="ordre-virement__total-chiffres">
        <p className="ordre-virement__sous-titre">TOTAL A VIRER (en chiffres)</p>
        <p className="ordre-virement__montant-valeur">{montantOrdre(virement.montant)}</p>
      </div>
    </div>

    <div className="ordre-virement__signature">
      <p className="ordre-virement__etiquette">Signature du donneur d’ordre</p>
      <p className="ordre-virement__signature-nom">{compte.titulaire || identite.titulaire}</p>
    </div>

    <div className="ordre-virement__observations">
      <p className="ordre-virement__etiquette">Observations du donneur d’ordre</p>
      <p className="ordre-virement__observation">{valeur(virement.observation)}</p>
    </div>

    <p className="ordre-virement__date">A Toliara, le {dateFr(virement.date)}</p>
  </section>;
}

/** Trait de découpe entre les deux moitiés de la feuille. */
function TraitDecoupe() {
  return <div className="ordre-virement__decoupe">
    <span className="ordre-virement__decoupe-trait" aria-hidden="true" />
    <span className="ordre-virement__decoupe-texte">Découper ici — moitié haute pour la banque, moitié basse en souche</span>
    <span className="ordre-virement__decoupe-trait" aria-hidden="true" />
  </div>;
}

/**
 * Feuille A4 complète : deux ordres de virement identiques, séparés par un trait
 * de découpe. Le premier part à la banque, le second reste dans le dossier.
 */
export function FeuilleOrdreVirement({ virement, compte, entete }: DonneesOrdreVirement) {
  const identite = { ...DONNEUR_PAR_DEFAUT, ...identiteEntete(entete) };
  return <article className="ordre-virement-feuille" style={styleFeuille()}>
    <div className="ordre-virement-feuille__moitie">
      <BlocOrdre virement={virement} compte={compte} entete={entete} identite={identite} souche={false} />
    </div>
    <TraitDecoupe />
    <div className="ordre-virement-feuille__moitie ordre-virement-feuille__moitie--souche">
      <BlocOrdre virement={virement} compte={compte} entete={entete} identite={identite} souche />
    </div>
  </article>;
}

/**
 * Impression directe de l'ordre de virement, sans aperçu intermédiaire : la
 * boîte d'impression du navigateur s'ouvre dès l'enregistrement du virement,
 * comme pour le bordereau de la caisse.
 *
 * Le document n'est monté que le temps de l'impression : le registre reste
 * utilisable si le navigateur ne signale jamais la fin de l'impression.
 */
export function ModaleOrdreVirement({ virement, compte, entete, onFermer, onErreur }: DonneesOrdreVirement & {
  onFermer: () => void;
  onErreur?: () => void;
}) {
  const callbacks = useRef({ onFermer, onErreur });
  callbacks.current = { onFermer, onErreur };
  useEffect(() => {
    document.body.classList.add('has-print-ordre-virement');
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
        // l'impression : libérer le document pour ne pas bloquer le registre.
        if (!termine) secours = setTimeout(() => finir(true), 30000);
      } catch { finir(true); }
    }, 50);
    return () => {
      clearTimeout(lancement);
      if (secours) clearTimeout(secours);
      window.removeEventListener('afterprint', apresImpression);
      document.body.classList.remove('has-print-ordre-virement');
    };
  }, []);

  return createPortal(
    <div className="print-only print-ordre-virement">
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      <FeuilleOrdreVirement virement={virement} compte={compte} entete={entete} />
    </div>, document.body,
  );
}
