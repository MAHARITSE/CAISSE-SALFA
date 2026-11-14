import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CompteVirement, Virement } from '../utils/virements';
import { dateFr, masqueMajuscules } from '../utils/format';
import { sommeAriaryTitre } from '../utils/nombreEnLettres';
import { enteteParDefaut, type EnteteDocument } from '../utils/entete';
import { LOGO_BNI_MADAGASCAR } from '../utils/logoBni';
import { BordereauDocument } from './Bordereau';

/**
 * Ordre de virement bancaire au format officiel BNI Madagascar (imprimé 114018).
 *
 * Le formulaire occupe la moitié haute d'une feuille A4 portrait et s'imprime
 * en un seul exemplaire, sans souche ni trait de découpe, fidèle à la maquette
 * 114018 avec un unique cadre bénéficiaire (logo BNI Madagascar, cadre « Client
 * donneur d'ordre », bacs RIB en U, cadre bénéficiaire unique, total en lettres
 * et en chiffres, observations du donneur d'ordre alimentées par le libellé du
 * virement, cadre de signature et notes de renvoi).
 */

export const COTES_ORDRE_VIR = {
  largeurFeuille: 210,
  hauteurFeuille: 297,
  /** Demi-hauteur exacte d'une feuille A4 portrait (297 / 2 = 148,5 mm). */
  demiFeuille: 148.5,
  /** Marge haute de la feuille, centrant l'ordre dans la moitié supérieure. */
  margeFeuille: 6,
  /** Hauteur imprimée du formulaire 114018 : tient intégralement dans la demi-page (6 + 114 = 120 mm < 148,5 mm). */
  hauteurOrdre: 114,
  /** Marge non imprimable minimale laissée libre sur la feuille. */
  securite: 7,
};

/** Hauteur totale occupée sur la feuille imprimée, en millimètres. */
export function hauteurTotaleFeuille(): number {
  return 2 * COTES_ORDRE_VIR.margeFeuille + COTES_ORDRE_VIR.hauteurOrdre;
}

/** Cotes passées au CSS : la feuille et l'ordre gardent ces dimensions. */
function styleFeuille(): CSSProperties {
  return {
    '--ordre-largeur': `${COTES_ORDRE_VIR.largeurFeuille}mm`,
    '--ordre-hauteur-feuille': `${COTES_ORDRE_VIR.hauteurFeuille}mm`,
    '--ordre-marge': `${COTES_ORDRE_VIR.margeFeuille}mm`,
    '--ordre-hauteur-ordre': `${COTES_ORDRE_VIR.hauteurOrdre}mm`,
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

export interface SegmentsRib {
  banque: string;
  guichet: string;
  compte: string;
  cle: string;
}

/** Montant du modèle : séparateur de milliers insécable et deux décimales. */
export function montantOrdre(montant: number): string {
  const [entier, decimales] = montant.toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')},${decimales}`;
}

/** Une valeur absente laisse la case vide, à compléter à la main sur le papier. */
const valeur = (texte?: string): string => (texte ?? '').trim();

/**
 * Découpe un compte ou RIB malgache dans les 4 compartiments du masque
 * `00005 00041 43200100200 85` (code banque 5, guichet 5, compte 11, clé 2),
 * sans jamais perdre un numéro libre ou partiel déjà saisi.
 */
export function decouperRib(texteCompte?: string, codeBanqueDefaut?: string): SegmentsRib {
  const brut = valeur(texteCompte);
  const codeDefaut = valeur(codeBanqueDefaut);
  if (!brut) return { banque: codeDefaut, guichet: '', compte: '', cle: '' };

  if (/^[\d\s.-]+$/.test(brut)) {
    const compact = brut.replace(/\D/g, '');
    if (!compact) return { banque: codeDefaut, guichet: '', compte: '', cle: '' };
    if (compact.length === 18 && /^\d{5}$/.test(codeDefaut)) {
      return {
        banque: codeDefaut,
        guichet: compact.slice(0, 5),
        compte: compact.slice(5, 16),
        cle: compact.slice(16, 18),
      };
    }
    if (compact.length <= 23) {
      return {
        banque: compact.slice(0, 5),
        guichet: compact.slice(5, 10),
        compte: compact.slice(10, 21),
        cle: compact.slice(21, 23),
      };
    }
  }

  const morceaux = brut.split(/\s+/).filter(Boolean);
  if (morceaux.length >= 4) {
    return {
      banque: morceaux[0],
      guichet: morceaux[1],
      compte: morceaux.slice(2, -1).join(' '),
      cle: morceaux[morceaux.length - 1],
    };
  }
  if (morceaux.length === 3) {
    if (/^\d{2}$/.test(morceaux[2]) && !/^\d{5}$/.test(morceaux[1])) {
      return { banque: codeDefaut, guichet: morceaux[0], compte: morceaux[1], cle: morceaux[2] };
    }
    return { banque: morceaux[0], guichet: morceaux[1], compte: morceaux[2], cle: '' };
  }
  if (morceaux.length === 2) {
    if (/^\d{5}$/.test(morceaux[0])) {
      return { banque: morceaux[0], guichet: '', compte: morceaux[1], cle: '' };
    }
    return { banque: codeDefaut, guichet: morceaux[0], compte: morceaux[1], cle: '' };
  }
  return { banque: codeDefaut, guichet: '', compte: morceaux[0], cle: '' };
}

/** Case à cocher du modèle : cochée, ou laissée vide pour être cochée à la main. */
function Case({ coche, libelle }: { coche: boolean; libelle: string }) {
  return <span className="ordre-virement__case">
    <span className="ordre-virement__case-carre" aria-hidden="true">{coche ? '✕' : ''}</span>{' '}
    <span>{libelle}</span>
  </span>;
}

/** Cadre bénéficiaire unique (« Virer au crédit du compte de »). */
function BlocBeneficiaire({ nom, adresse, banque, compteBeneficiaire, montant }: {
  nom?: string;
  adresse?: string;
  banque?: string;
  compteBeneficiaire?: string;
  montant?: string;
}) {
  const rib = decouperRib(compteBeneficiaire);
  return <div className="ordre-virement__beneficiaire">
    <div className="ordre-virement__beneficiaire-entete">
      <div className="ordre-virement__beneficiaire-entete-gauche">
        <span className="ordre-virement__rang">1</span>
        <span className="ordre-virement__sous-titre">VIRER AU CREDIT DU COMPTE DE</span>
      </div>
      <span className="ordre-virement__sous-titre">MONTANT (en chiffres)</span>
    </div>
    <div className="ordre-virement__beneficiaire-cadre">
      <div className="ordre-virement__beneficiaire-corps">
        <p className="ordre-virement__ligne">
          <span className="ordre-virement__etiquette-normale">Nom et prénoms :</span>
          <span className="ordre-virement__valeur">{valeur(nom)}</span>
        </p>
        <p className="ordre-virement__ligne">
          <span className="ordre-virement__etiquette-normale">Adresse :</span>
          <span className="ordre-virement__valeur">{valeur(adresse)}</span>
        </p>
        <p className="ordre-virement__ligne ordre-virement__ligne--sans-filet">
          <span className="ordre-virement__etiquette-normale">Etablissement bancaire ou CCP :</span>
          <span className="ordre-virement__valeur-libre">{valeur(banque)}</span>
        </p>
        <div className="ordre-virement__beneficiaire-rib">
          <span className="ordre-virement__etiquette">Compte ou RIB (2)</span>
          <div className="ordre-virement__rib-bac ordre-virement__rib-bac--quatre">
            <span className="ordre-virement__rib-case">{rib.banque}</span>{' '}
            <span className="ordre-virement__rib-case">{rib.guichet}</span>{' '}
            <span className="ordre-virement__rib-case">{rib.compte}</span>{' '}
            <span className="ordre-virement__rib-case">{rib.cle}</span>
          </div>
        </div>
      </div>
      <div className="ordre-virement__montant">
        <p className="ordre-virement__montant-valeur">{valeur(montant)}</p>
      </div>
    </div>
  </div>;
}

/**
 * Formulaire 114018 complet : logo BNI Madagascar et titre à gauche, encadré
 * « Client donneur d'ordre » à droite, instructions et bacs RIB en U, cadre
 * bénéficiaire unique, total en lettres et en chiffres, observations du
 * donneur d'ordre (libellé du virement) et cadre de signature.
 */
function BlocOrdre({ virement, compte, identite }: DonneesOrdreVirement & {
  identite: { titulaire: string; adresse: string };
}) {
  const estBni = !compte.banque.trim() || /bni/i.test(compte.banque);
  const ribDonneur = decouperRib(compte.numeroCompte, compte.codeBanque || '00005');
  const ribDebit = valeur(compte.numeroCompte)
    ? decouperRib(compte.numeroCompte, compte.codeBanque)
    : { banque: '', guichet: '', compte: '', cle: '' };
  const referenceAffichee = [valeur(virement.reference), valeur(virement.numero)]
    .filter((v, i, arr) => v && arr.indexOf(v) === i)
    .join(' — ');
  const observationDonneur = masqueMajuscules(valeur(virement.libelle)) || valeur(virement.observation);

  return <section className="ordre-virement" aria-label="Ordre de virement">
    <header className="ordre-virement__entete">
      <div className="ordre-virement__marque">
        {estBni
          ? <img className="ordre-virement__logo" src={LOGO_BNI_MADAGASCAR} alt="BNI Madagascar" />
          : <p className="ordre-virement__banque-nom">{compte.banque}</p>}
        <div className="ordre-virement__titre">
          <p>ORDRE DE VIREMENT</p>
          <p>EN ARIARY</p>
        </div>
      </div>

      <div className="ordre-virement__client">
        <p className="ordre-virement__client-titre">CLIENT DONNEUR D’ORDRE</p>
        <div className="ordre-virement__client-corps">
          <p className="ordre-virement__ligne">
            <span className="ordre-virement__etiquette-normale">Nom et prénoms :</span>
            <span className="ordre-virement__valeur ordre-virement__valeur--pointilles">
              {valeur(compte.titulaire || identite.titulaire)}
            </span>
          </p>
          <p className="ordre-virement__ligne">
            <span className="ordre-virement__etiquette-normale">Adresse :</span>
            <span className="ordre-virement__valeur ordre-virement__valeur--pointilles">
              {valeur(compte.adresse || identite.adresse)}
            </span>
          </p>
          <div className="ordre-virement__client-rib">
            <span className="ordre-virement__etiquette">RIB (2)</span>
            <div className="ordre-virement__rib-bac ordre-virement__rib-bac--client">
              <span className="ordre-virement__rib-case ordre-virement__rib-case--gras">
                {ribDonneur.banque || '00005'}
              </span>{' '}
              <span className="ordre-virement__rib-case">{ribDonneur.guichet}</span>{' '}
              <span className="ordre-virement__rib-case">{ribDonneur.compte}</span>{' '}
              <span className="ordre-virement__rib-case">{ribDonneur.cle}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div className="ordre-virement__instruction">
      <p className="ordre-virement__instruction-ligne1">
        PAR LE DEBIT DE MON COMPTE, VEUILLEZ EXECUTER L’ORDRE DE VIREMENT{' '}
        <Case coche={virement.permanent === true} libelle="PERMANENT" /> /{' '}
        <Case coche={virement.permanent !== true} libelle="OCCASIONNEL (1)" />
      </p>
      <p className="ordre-virement__instruction-ligne2">
        <strong>SUIVANT :</strong> A PARTIR DE <span className="ordre-virement__blanc" /> AU{' '}
        <span className="ordre-virement__blanc" /> SUIVANT UNE PÉRIODICITÉ{' '}
        <span className="ordre-virement__blanc" />
      </p>
    </div>

    <div className="ordre-virement__debiter">
      <div className="ordre-virement__debiter-ligne1">
        <span>VEUILLEZ DÉBITER AU COMPTE N°</span>
        <div className="ordre-virement__rib-bac ordre-virement__rib-bac--debit">
          <span className="ordre-virement__rib-case">{ribDebit.banque}</span>{' '}
          <span className="ordre-virement__rib-case">{ribDebit.guichet}</span>{' '}
          <span className="ordre-virement__rib-case">{ribDebit.compte}</span>{' '}
          <span className="ordre-virement__rib-case">{ribDebit.cle}</span>
        </div>
        <span>LES FRAIS ET COMMISSIONS</span>
      </div>
      <p className="ordre-virement__debiter-ligne2">
        CORRESPONDANTS SUIVANTS LES CONDITIONS TARIFAIRES EN VIGUEUR
      </p>
    </div>

    <p className="ordre-virement__reference-ligne">
      <span className="ordre-virement__etiquette-normale">Référence :</span>{' '}
      <span className="ordre-virement__pointilles ordre-virement__reference">{referenceAffichee}</span>
    </p>

    <BlocBeneficiaire
      nom={virement.tiers}
      adresse={virement.beneficiaireAdresse}
      banque={virement.beneficiaireBanque}
      compteBeneficiaire={virement.beneficiaireCompte}
      montant={montantOrdre(virement.montant)}
    />

    <div className="ordre-virement__total">
      <div className="ordre-virement__total-entete">
        <span className="ordre-virement__sous-titre">TOTAL A VIRER (en lettres)</span>
        <span className="ordre-virement__sous-titre">TOTAL A VIRER (en chiffres)</span>
      </div>
      <div className="ordre-virement__total-cadre">
        <p className="ordre-virement__lettres">{sommeAriaryTitre(virement.montant)}</p>
        <div className="ordre-virement__total-chiffres">
          <p className="ordre-virement__montant-valeur">{montantOrdre(virement.montant)}</p>
        </div>
      </div>
    </div>

    <footer className="ordre-virement__pied">
      <div className="ordre-virement__pied-gauche">
        <p className="ordre-virement__observations">
          <span className="ordre-virement__etiquette-normale">Observations du donneur d’ordre</span>{' '}
          <span className="ordre-virement__valeur ordre-virement__observation">{observationDonneur}</span>
        </p>
        <p className="ordre-virement__date">
          A <span className="ordre-virement__pointilles">Toliara</span> le{' '}
          <span className="ordre-virement__pointilles">{dateFr(virement.date)}</span>
        </p>
        <div className="ordre-virement__notes">
          <p>(1) Cocher la case correspondante</p>
          <p>(2) RIB Relevé d’Identité Bancaire pour les établissements autres que BNI Madagascar</p>
        </div>
      </div>

      <div className="ordre-virement__signature">
        <p className="ordre-virement__signature-titre">Signature du donneur d’ordre</p>
        <div className="ordre-virement__signature-cadre" />
      </div>

      <div className="ordre-virement__imprimeur" aria-hidden="true">
        <span>114018 - FOCUSPrint - 11/2019</span>
      </div>
    </footer>
  </section>;
}

/**
 * Feuille A4 : un seul exemplaire de l'ordre de virement dans la moitié haute
 * de la feuille, conformément au formulaire 114018.
 */
export function FeuilleOrdreVirement({ virement, compte, entete }: DonneesOrdreVirement) {
  const identite = { ...DONNEUR_PAR_DEFAUT, ...identiteEntete(entete) };
  return <article className="ordre-virement-feuille" style={styleFeuille()}>
    <div className="ordre-virement-feuille__cadre">
      <BlocOrdre virement={virement} compte={compte} entete={entete} identite={identite} />
    </div>
  </article>;
}

/**
 * Impression directe de l'ordre de virement (et, lors de la validation d'une
 * DED par virement, de l'état DED sur la première page suivi de l'ordre de
 * virement sur la seconde), sans écran d'aperçu intermédiaire.
 */
export function ModaleOrdreVirement({
  virement,
  compte,
  entete,
  inclureEtat = false,
  onFermer,
  onErreur,
}: DonneesOrdreVirement & {
  inclureEtat?: boolean;
  onFermer: () => void;
  onErreur?: () => void;
}) {
  const callbacks = useRef({ onFermer, onErreur });
  callbacks.current = { onFermer, onErreur };
  useEffect(() => {
    document.body.classList.add('has-print-ordre-virement');
    if (inclureEtat) document.body.classList.add('has-print-bordereau');
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
        if (!termine) secours = setTimeout(() => finir(true), 30000);
      } catch { finir(true); }
    }, 50);
    return () => {
      clearTimeout(lancement);
      if (secours) clearTimeout(secours);
      window.removeEventListener('afterprint', apresImpression);
      document.body.classList.remove('has-print-ordre-virement');
      document.body.classList.remove('has-print-bordereau');
    };
  }, [inclureEtat]);

  if (inclureEtat) {
    return createPortal(
      <div className="print-only print-liasse-virement">
        <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
        <div className="print-bordereau print-liasse-virement__page">
          <BordereauDocument
            ligne={{ ...virement, solde: 0 }}
            entete={entete ?? enteteParDefaut('depense')}
            compteVirement={compte}
          />
        </div>
        <div className="print-ordre-virement">
          <FeuilleOrdreVirement virement={virement} compte={compte} entete={entete} />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="print-only print-ordre-virement">
      <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
      <FeuilleOrdreVirement virement={virement} compte={compte} entete={entete} />
    </div>, document.body,
  );
}
