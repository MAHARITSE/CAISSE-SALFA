@echo off
REM ============================================================
REM  CAISSE SALFA - restauration d'un dump SQL (dernier recours)
REM  L'application propose aussi une restauration JSON depuis
REM  l'onglet "Donnees & sauvegardes".
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
set "RACINE=%~dp0.."
call "%~dp0_wamp.bat"
if errorlevel 1 exit /b 1

set "MYSQL="
for /f "delims=" %%D in ('dir /b /o-n "%WAMP%\bin\mysql\mysql*\mysql.exe" 2^>nul') do if not defined MYSQL set "MYSQL=%WAMP%\bin\mysql\%%D\mysql.exe"
if not defined MYSQL (
  echo   ERREUR : mysql.exe introuvable sous %WAMP%\bin\mysql
  exit /b 1
)

set "FICHIER=%~1"
if "%FICHIER%"=="" set /p FICHIER=Fichier .sql a restaurer :
if not exist "%FICHIER%" (
  echo   Fichier introuvable : %FICHIER%
  exit /b 1
)

echo ATTENTION : cette operation remplace les donnees actuelles.
set /p CONFIRME=Tapez OUI pour continuer :
if /I not "%CONFIRME%"=="OUI" (
  echo   Annule.
  exit /b 1
)

"%PHP%" "%RACINE%\outils\importer-cli.php" "%CIBLE%" "%MYSQL%" "%FICHIER%"
if errorlevel 1 exit /b 1
echo   Restauration terminee.
exit /b 0
