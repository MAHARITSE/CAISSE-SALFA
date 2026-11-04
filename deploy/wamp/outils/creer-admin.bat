@echo off
REM ============================================================
REM  CAISSE SALFA - creation ou reinitialisation d'un administrateur
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."

set "WAMP=C:\wamp64"
if exist "C:\wamp\www" if not exist "%WAMP%\www" set "WAMP=C:\wamp"
set "WAMP_PHP=%WAMP%\bin\php\php.exe"
set "CIBLE=%WAMP%\www\caisse-salfa"

if not exist "%WAMP_PHP%" (
  echo   php.exe introuvable dans %WAMP%\bin\php.
  exit /b 1
)
if not exist "%CIBLE%\api\connexion-bootstrap.php" (
  echo   Installez d'abord l'application avec installer.bat.
  exit /b 1
)

set /p ADMIN_ID=Identifiant [admin] :
if "!ADMIN_ID!"=="" set "ADMIN_ID=admin"
set /p ADMIN_MDP=Mot de passe (8 caracteres minimum) :
set /p ADMIN_NOM=Nom complet [Administrateur] :
if "!ADMIN_NOM!"=="" set "ADMIN_NOM=Administrateur"
"%WAMP_PHP%" "%CIBLE%\api\connexion-bootstrap.php" "!ADMIN_ID!" "!ADMIN_MDP!" "!ADMIN_NOM!"
if errorlevel 1 exit /b 1
echo cree> "%CIBLE%\api\admin-cree.txt"
echo Compte pret. Pensez a supprimer api\connexion-bootstrap.php si l'installation est terminee.
exit /b 0
