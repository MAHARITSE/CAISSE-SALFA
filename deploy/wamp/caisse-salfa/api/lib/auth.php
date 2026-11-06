<?php
/**
 * Authentification : sessions PHP, comptes MySQL et limitation des tentatives.
 * Le hachage est bcrypt (60 caractères) ou argon2id (97 caractères) ;
 * la colonne mdp_hash est dimensionnée pour les deux.
 */

declare(strict_types=1);

const SALFA_DUREE_SESSION = 12 * 3600;      // 12 heures
const SALFA_DUREE_INACTIVITE = 3600;        // 1 heure
const SALFA_MAX_ESSAIS = 8;                 // par fenêtre et par adresse
const SALFA_FENETRE_ESSAIS = 15 * 60;       // 15 minutes
const SALFA_LONGUEUR_MDP = 8;

function salfa_sel_session(): string
{
    $sel = (string) (salfa_config()['sel_session'] ?? '');
    return $sel === 'changez-ce-sel' ? '' : $sel;
}

/** Cookie HttpOnly, SameSite=Lax ; le jeton de session n'est jamais exposé au JavaScript. */
function salfa_demarrer_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    @ini_set('session.gc_maxlifetime', (string) SALFA_DUREE_INACTIVITE);
    session_name('salfa_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    ]);
    session_start();
}

/** En mode « mysql », la session PHP est en plus contrôlée côté serveur (révocation). */
function salfa_session_en_base(): bool
{
    return (string) salfa_config()['mode_session'] === 'mysql';
}

/** Hash interne du jeton, jamais stocké en clair. */
function salfa_hacher_jeton(string $jeton): string
{
    $sel = salfa_sel_session();
    return hash('sha256', $sel === '' ? $jeton : $sel . '|' . $jeton);
}

function salfa_identifiant_aleatoire(): string
{
    $octets = random_bytes(16);
    $octets[6] = chr(ord($octets[6]) & 0x0f | 0x40);
    $octets[8] = chr(ord($octets[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($octets), 4));
}

/**
 * État de la session courante, sans exposer de secret.
 *
 * @return array<string, mixed>
 */
function salfa_etat_session(): array
{
    $utilisateur = salfa_utilisateur_courant(false);
    return [
        'ok' => true,
        'connecte' => $utilisateur !== null,
        'utilisateur' => $utilisateur,
    ];
}

/**
 * Utilisateur connecté, ou exception 401 si $exiger est vrai.
 *
 * @return array<string, mixed>|null
 */
function salfa_utilisateur_courant(bool $exiger = true): ?array
{
    $session = $_SESSION['utilisateur'] ?? null;
    if (!is_array($session) || !isset($session['id'])) {
        if ($exiger) {
            throw new SalFaErreur('Connectez-vous pour accéder à la caisse.', 401, 'non_authentifie');
        }
        return null;
    }
    $ligne = salfa_executer(
        'SELECT id, identifiant, nom_complet, role, actif FROM ' . salfa_table('utilisateurs') . ' WHERE id = ?',
        [(int) $session['id']]
    )->fetch();
    if (!$ligne || (int) $ligne['actif'] !== 1) {
        if ($exiger) {
            throw new SalFaErreur('Compte introuvable ou désactivé : reconnectez-vous.', 401, 'non_authentifie');
        }
        return null;
    }
    $derniere = (int) ($_SESSION['derniere_activite'] ?? 0);
    if ($derniere > 0 && (time() - $derniere) > SALFA_DUREE_INACTIVITE) {
        salfa_fermer_session();
        if ($exiger) {
            throw new SalFaErreur('Session expirée après une longue inactivité. Reconnectez-vous.', 401, 'session_expiree');
        }
        return null;
    }
    if (salfa_session_en_base() && !salfa_session_base_valide((int) $ligne['id'], (string) $session['jeton'])) {
        salfa_fermer_session();
        if ($exiger) {
            throw new SalFaErreur('Session expirée. Reconnectez-vous.', 401, 'session_expiree');
        }
        return null;
    }
    $_SESSION['derniere_activite'] = time();
    return [
        'id' => (int) $ligne['id'],
        'identifiant' => (string) $ligne['identifiant'],
        'nomComplet' => (string) $ligne['nom_complet'],
        'role' => (string) $ligne['role'],
    ];
}

function salfa_session_base_valide(int $utilisateurId, string $jeton): bool
{
    $ligne = salfa_executer(
        'SELECT expire_le FROM ' . salfa_table('sessions') . ' WHERE jeton_hash = ? AND utilisateur_id = ?',
        [salfa_hacher_jeton($jeton), $utilisateurId]
    )->fetch();
    return $ligne !== false && strtotime((string) $ligne['expire_le']) >= time();
}

/**
 * Connexion : même message pour un compte inexistant et un mot de passe faux.
 *
 * @return array<string, mixed>
 */
function salfa_connecter(array $corps): array
{
    $identifiant = mb_strtolower(salfa_champ($corps, 'identifiant', 80));
    $motDePasse = salfa_champ($corps, 'motDePasse', 200);
    salfa_verifier_limite($identifiant);

    $utilisateur = salfa_executer(
        'SELECT * FROM ' . salfa_table('utilisateurs') . ' WHERE identifiant = ? AND actif = 1',
        [$identifiant]
    )->fetch();

    $valide = $utilisateur !== false && password_verify($motDePasse, (string) $utilisateur['mdp_hash']);
    salfa_journaliser('connexion', $utilisateur ? (int) $utilisateur['id'] : null, $valide ? 'succes' : 'echec', $identifiant);
    if (!$valide) {
        throw new SalFaErreur('Identifiant ou mot de passe incorrect.', 401, 'identifiants_invalides');
    }

    if (password_needs_rehash((string) $utilisateur['mdp_hash'], PASSWORD_DEFAULT)) {
        salfa_executer(
            'UPDATE ' . salfa_table('utilisateurs') . ' SET mdp_hash = ? WHERE id = ?',
            [password_hash($motDePasse, PASSWORD_DEFAULT), (int) $utilisateur['id']]
        );
    }

    session_regenerate_id(true);
    $jeton = bin2hex(random_bytes(32));
    $_SESSION = [
        'utilisateur' => ['id' => (int) $utilisateur['id'], 'jeton' => $jeton],
        'cree_le' => time(),
        'derniere_activite' => time(),
    ];

    if (salfa_session_en_base()) {
        salfa_executer('DELETE FROM ' . salfa_table('sessions') . ' WHERE expire_le < NOW()');
        salfa_executer(
            'INSERT INTO ' . salfa_table('sessions') . ' (id, utilisateur_id, jeton_hash, ip, agent, expire_le) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? SECOND))',
            [salfa_identifiant_aleatoire(), (int) $utilisateur['id'], salfa_hacher_jeton($jeton), salfa_ip(), salfa_agent(), SALFA_DUREE_SESSION]
        );
    }
    salfa_executer('UPDATE ' . salfa_table('utilisateurs') . ' SET derniere_connexion = NOW(3) WHERE id = ?', [(int) $utilisateur['id']]);
    salfa_reinitialiser_limite($identifiant);

    return [
        'ok' => true,
        'connecte' => true,
        'utilisateur' => [
            'id' => (int) $utilisateur['id'],
            'identifiant' => (string) $utilisateur['identifiant'],
            'nomComplet' => (string) $utilisateur['nom_complet'],
            'role' => (string) $utilisateur['role'],
        ],
    ];
}

function salfa_fermer_session(): void
{
    $session = $_SESSION['utilisateur'] ?? null;
    if (is_array($session) && salfa_session_en_base()) {
        salfa_executer('DELETE FROM ' . salfa_table('sessions') . ' WHERE jeton_hash = ?', [salfa_hacher_jeton((string) $session['jeton'])]);
    }
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
        session_destroy();
    }
}

/**
 * Limitation des tentatives de connexion.
 * Un compte ou une adresse bloquée reçoit une erreur explicite, jamais un blocage silencieux.
 */
function salfa_verifier_limite(string $cle): void
{
    try {
        $hash = hash('sha256', salfa_ip() . '|' . mb_strtolower($cle));
        $ligne = salfa_executer('SELECT * FROM ' . salfa_table('tentatives') . ' WHERE cle_hash = ?', [$hash])->fetch();
        $maintenant = time();
        if ($ligne === false) {
            salfa_executer(
                'INSERT INTO ' . salfa_table('tentatives') . ' (cle_hash, action, compteur, derniere_le) VALUES (?, ?, 1, NOW(3))',
                [$hash, 'connexion']
            );
            return;
        }
        $derniere = strtotime((string) $ligne['derniere_le']);
        if ($maintenant - $derniere >= SALFA_FENETRE_ESSAIS) {
            salfa_executer('UPDATE ' . salfa_table('tentatives') . ' SET compteur = 1, derniere_le = NOW(3) WHERE cle_hash = ?', [$hash]);
            return;
        }
        if ((int) $ligne['compteur'] >= SALFA_MAX_ESSAIS) {
            $minutes = (int) ceil((SALFA_FENETRE_ESSAIS - ($maintenant - $derniere)) / 60);
            throw new SalFaErreur('Trop de tentatives. Réessayez dans ' . max(1, $minutes) . ' minute(s).', 429, 'trop_de_tentatives');
        }
        salfa_executer('UPDATE ' . salfa_table('tentatives') . ' SET compteur = compteur + 1, derniere_le = NOW(3) WHERE cle_hash = ?', [$hash]);
    } catch (PDOException $e) {
        // Le compteur ne doit jamais bloquer l'application.
    }
}

function salfa_reinitialiser_limite(string $cle): void
{
    try {
        salfa_executer('DELETE FROM ' . salfa_table('tentatives') . ' WHERE cle_hash = ?', [hash('sha256', salfa_ip() . '|' . mb_strtolower($cle))]);
    } catch (PDOException $e) {
        // Sans effet de bord.
    }
}

function salfa_journaliser(string $action, ?int $utilisateurId, string $resultat, string $detail = ''): void
{
    try {
        salfa_executer(
            'INSERT INTO ' . salfa_table('journal_audit') . ' (utilisateur_id, action, resultat, ip, agent, detail) VALUES (?, ?, ?, ?, ?, ?)',
            [$utilisateurId, $action, $resultat, salfa_ip(), salfa_agent(), mb_substr($detail, 0, 500)]
        );
    } catch (PDOException $e) {
        // Le journal ne doit jamais bloquer une opération métier.
    }
}

/**
 * Rôle minimal exigé.
 *
 *   comptable — consulte le livre journal et l'analyse, exporte ;
 *   caissier  — saisit les recettes et les dépenses ;
 *   admin     — tout, et seul à corriger le solde d'ouverture ou à clôturer.
 *
 * L'ancien rôle « lecteur » est accepté à la hauteur du comptable : une base
 * importée avant la version actuelle continue de fonctionner sans conversion.
 *
 * @return array<string, mixed>
 */
function salfa_exiger_role(string $roleMinimum): array
{
    $utilisateur = salfa_utilisateur_courant();
    $roles = ['lecteur' => 0, 'comptable' => 0, 'caissier' => 1, 'admin' => 2];
    $obtenu = $roles[(string) $utilisateur['role']] ?? 0;
    if ($obtenu < ($roles[$roleMinimum] ?? 0)) {
        throw new SalFaErreur('Votre rôle ne permet pas cette action.', 403, 'role_insuffisant');
    }
    return $utilisateur;
}

/** Changement de mot de passe du compte connecté. */
function salfa_changer_mot_de_passe(array $corps): array
{
    $utilisateur = salfa_utilisateur_courant();
    $actuel = salfa_champ($corps, 'motDePasseActuel', 200);
    $nouveau = salfa_champ($corps, 'motDePasse', 200);
    if (mb_strlen($nouveau) < SALFA_LONGUEUR_MDP) {
        throw new SalFaErreur('Le nouveau mot de passe doit contenir au moins ' . SALFA_LONGUEUR_MDP . ' caractères.', 400, 'mdp_court');
    }
    $ligne = salfa_executer('SELECT mdp_hash FROM ' . salfa_table('utilisateurs') . ' WHERE id = ?', [$utilisateur['id']])->fetch();
    if (!$ligne || !password_verify($actuel, (string) $ligne['mdp_hash'])) {
        throw new SalFaErreur('Le mot de passe actuel est incorrect.', 400, 'mdp_incorrect');
    }
    salfa_executer(
        'UPDATE ' . salfa_table('utilisateurs') . ' SET mdp_hash = ? WHERE id = ?',
        [password_hash($nouveau, PASSWORD_DEFAULT), (int) $utilisateur['id']]
    );
    salfa_journaliser('mot_de_passe', (int) $utilisateur['id'], 'succes');
    return ['ok' => true, 'message' => 'Mot de passe modifié.'];
}
