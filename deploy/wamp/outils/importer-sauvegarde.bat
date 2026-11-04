@echo off
REM ============================================================
REM  CAISSE SALFA - restoration d'un dump SQL MySQL
REM  Utiliser en dernier recours : l'application propose aussi
REM  une restauration JSON depuis l'onglet Donnees & sauvegardes.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."

set "WAMP=C:\wamp64"
if exist "C:\wamp\www" if not exist "%WAMP%\www" set "WAMP=C:\wamp"
set "MYSQL=%WAMP%\bin\mysql\mysql.exe"
if not exist "%MYSQL%" set "MYSQL=mysql"

set "FICHIER=%~1"
if "%FICHIER%"=="" set /p FICHIER=Chemin du fichier .sql a restaurer :
if not exist "%FICHIER%" (
  echo   Fichier introuvable : %FICHIER%
  exit /b 1
)

echo ATTENTION : cette operation remplace les donnees actuelles de caisse_salfa.
set /p CONFIRME=Tapez OUI pour continuer :
if /I not "%CONFIRME%"=="OUI" (
  echo   Annule.
  exit /b 1
)

"%MYSQL%" -h 127.0.0.1 -u root --default-character-set=utf8mb4 caisse_salfa < "%FICHIER%"
if errorlevel 1 (
  echo   Echec de la restauration.
  exit /b 1
)
echo   Restauration terminee.
exit /b 0
