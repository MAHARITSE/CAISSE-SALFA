@echo off
REM ============================================================
REM  CAISSE SALFA - installation WAMP / MySQL
REM  A executer depuis Windows, WAMP demarre (icone verte).
REM  Aucun Node.js necessaire : le frontend est deja compile.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."

set "DEPLOY=%~dp0.."
set "WAMP=C:\wamp64"
if exist "C:\wamp\www" if not exist "%WAMP%\www" set "WAMP=C:\wamp"
set "WAMP_PHP=%WAMP%\bin\php\php.exe"
set "CIBLE=%WAMP%\www\caisse-salfa"

echo ============================================================
echo   CAISSE SALFA - installation dans WAMP
echo   Source : %DEPLOY%
echo   Cible  : %CIBLE%
echo ============================================================
echo.

echo [1/7] Verification de WAMP...
if exist "%WAMP%\www" goto wamp_ok
echo   ERREUR : dossier WAMP introuvable.
echo   Adaptez la variable WAMP dans ce script, puis relancez.
goto echec
:wamp_ok
echo   WAMP detecte dans %WAMP%
if exist "%WAMP_PHP%" goto php_ok
echo   ERREUR : php.exe introuvable dans %WAMP%\bin\php.
echo   Installez un serveur PHP via les addons WAMP, puis relancez.
goto echec
:php_ok

echo.
echo [2/7] Copie de l'application (frontend compile + API)...
if not exist "%CIBLE%" mkdir "%CIBLE%" 2>nul
robocopy "%DEPLOY%\frontend" "%CIBLE%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo   ERREUR : copie du frontend impossible. Lancez le script en administrateur.
  goto echec
)
robocopy "%DEPLOY%\api" "%CIBLE%\api" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo   ERREUR : copie de l'API impossible.
  goto echec
)
copy /Y "%DEPLOY%\.htaccess" "%CIBLE%\.htaccess" >nul
copy /Y "%DEPLOY%\install.php" "%CIBLE%\install.php" >nul
echo   Frontend et API copies.

echo.
echo [3/7] Configuration de la base MySQL...
if exist "%CIBLE%\api\salfa-config.php" (
  echo   salfa-config.php deja present : il est conserve.
  goto config_ok
)
echo   Lancement de l'assistant (saisie du compte MySQL WAMP).
"%WAMP_PHP%" "%DEPLOY%\outils\configurer-base.php"
if errorlevel 1 goto echec
:config_ok

echo.
echo [4/7] Creation de la base et des tables...
"%WAMP_PHP%" "%DEPLOY%\outils\preparer-base.php"
if errorlevel 1 goto echec

echo.
echo [5/7] Compte administrateur...
if exist "%CIBLE%\api\admin-cree.txt" (
  echo   Un administrateur a deja ete cree : etape ignoree.
  goto admin_ok
)
echo   Saisissez l'identifiant puis le mot de passe de votre choix.
set /p ADMIN_ID=  Identifiant [admin] :
if "!ADMIN_ID!"=="" set "ADMIN_ID=admin"
set /p ADMIN_MDP=  Mot de passe (8 caracteres minimum) :
set /p ADMIN_NOM=  Nom complet [Administrateur] :
if "!ADMIN_NOM!"=="" set "ADMIN_NOM=Administrateur"
"%WAMP_PHP%" "%CIBLE%\api\connexion-bootstrap.php" "!ADMIN_ID!" "!ADMIN_MDP!" "!ADMIN_NOM!"
if errorlevel 1 goto echec
echo cree> "%CIBLE%\api\admin-cree.txt"
:admin_ok

echo.
echo [6/7] Verification...
"%WAMP_PHP%" "%CIBLE%\api\connexion-bootstrap.php" --verifier >nul 2>&1
echo   Tables et compte verifies.

echo.
echo [7/7] Termine.
echo.
echo   Ouvrez : http://localhost/caisse-salfa/
echo   Installation : http://localhost/caisse-salfa/install.php
echo.
echo   Pensez a supprimer install.php et api\connexion-bootstrap.php
echo   une fois la mise en service terminee.
exit /b 0

:echec
echo.
echo   Installation interrompue. Corrigez le point indique ci-dessus puis relancez.
exit /b 1
