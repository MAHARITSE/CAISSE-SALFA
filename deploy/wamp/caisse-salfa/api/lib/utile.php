<?php
/**
 * Réponses JSON, erreurs contrôlées et garde-fous communs.
 */

declare(strict_types=1);

/** Erreur métier destinée à l'utilisateur (message affiché tel quel). */
class SalFaErreur extends RuntimeException
{
    public int $statut;
    /** Code lisible par le client (« conflit_revision », « hors_exercice »…). */
    public string $codeErreur;

    public function __construct(string $message, int $statut = 400, string $code = 'erreur')
    {
        parent::__construct($message);
        $this->statut = $statut;
        $this->codeErreur = $code;
    }
}

function salfa_repondre(array $donnees, int $statut = 200): void
{
    http_response_code($statut);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    // Aucune écriture de ceinture n'est mise en cache par le navigateur.
    header('Referrer-Policy: same-origin');
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function salfa_erreur(string $message, int $statut = 400, string $code = 'erreur'): void
{
    salfa_repondre(['ok' => false, 'erreur' => $message, 'code' => $code], $statut);
}

/** Lit le corps JSON de la requête et refuse tout ce qui n'est pas un objet. */
function salfa_corps(): array
{
    static $corps = null;
    if ($corps !== null) {
        return $corps;
    }
    $brut = file_get_contents('php://input');
    if ($brut === false || trim($brut) === '') {
        $corps = [];
        return $corps;
    }
    $decode = json_decode($brut, true);
    if (!is_array($decode)) {
        throw new SalFaErreur('Corps de requête JSON invalide.', 400, 'json_invalide');
    }
    $corps = $decode;
    return $corps;
}

function salfa_champ(array $donnees, string $cle, int $max = 200, bool $obligatoire = true): string
{
    $valeur = $donnees[$cle] ?? null;
    if ($valeur === null || $valeur === '') {
        if ($obligatoire) {
            throw new SalFaErreur("Le champ « $cle » est obligatoire.", 400, 'champ_manquant');
        }
        return '';
    }
    if (!is_string($valeur)) {
        throw new SalFaErreur("Le champ « $cle » doit être du texte.", 400, 'champ_invalide');
    }
    $valeur = trim($valeur);
    if ($obligatoire && $valeur === '') {
        throw new SalFaErreur("Le champ « $cle » est obligatoire.", 400, 'champ_manquant');
    }
    if (mb_strlen($valeur) > $max) {
        throw new SalFaErreur("Le champ « $cle » dépasse $max caractères.", 400, 'champ_trop_long');
    }
    return $valeur;
}

function salfa_entier(array $donnees, string $cle, int $min, int $max): int
{
    $valeur = $donnees[$cle] ?? null;
    if (is_string($valeur) && preg_match('/^-?\d+$/', $valeur)) {
        $valeur = (int) $valeur;
    }
    if (!is_int($valeur) || $valeur < $min || $valeur > $max) {
        throw new SalFaErreur("Le champ « $cle » doit être un entier entre $min et $max.", 400, 'champ_invalide');
    }
    return $valeur;
}

/**
 * Montant positif autorisant jusqu'à deux chiffres après la virgule (virements bancaires).
 * Conserve un entier lorsque les centimes valent zéro et un flottant arrondi au centime sinon.
 */
function salfa_montant_decimal(array $donnees, string $cle, int $max): int|float
{
    $valeur = $donnees[$cle] ?? null;
    if (is_string($valeur) && preg_match('/^\d+(?:[.,]\d{1,2})?$/', $valeur)) {
        $valeur = (float) str_replace(',', '.', $valeur);
    }
    if ((!is_int($valeur) && !is_float($valeur)) || !is_finite((float) $valeur)) {
        throw new SalFaErreur("Le champ « $cle » doit être un montant valide.", 400, 'champ_invalide');
    }
    $centimes = (int) round(((float) $valeur) * 100);
    if (abs(((float) $valeur) * 100 - $centimes) > 1e-6 || $centimes < 1 || $centimes > $max * 100) {
        throw new SalFaErreur("Le champ « $cle » doit être compris entre 0,01 et $max (deux chiffres après la virgule maximum).", 400, 'champ_invalide');
    }
    return ($centimes % 100 === 0) ? intdiv($centimes, 100) : round($centimes / 100, 2);
}

function salfa_id(string $valeur): string
{
    if ($valeur === '') {
        throw new SalFaErreur('Identifiant manquant.', 400, 'identifiant_manquant');
    }
    return $valeur;
}

/** Adresse IP du client, derrière WAMP ou un proxy de confiance. */
function salfa_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return is_string($ip) ? substr($ip, 0, 45) : '0.0.0.0';
}

function salfa_agent(): string
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return is_string($ua) ? mb_substr($ua, 0, 255) : '';
}
