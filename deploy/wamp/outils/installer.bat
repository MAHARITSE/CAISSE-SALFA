@echo off
REM ============================================================
REM  CAISSE SALFA - installation dans WAMP
REM  Copie le site puis prepare MySQL, les tables et le compte admin.
REM  Aucun Node.js n'est necessaire sur le serveur.
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
set "RACINE=%~dp0.."
call "%~dp0_wamp.bat"
if errorlevel 1 goto echec

echo.
echo [1/3] Copie du site vers %CIBLE%
if not exist "%CIBLE%" mkdir "%CIBLE%"
robocopy "%RACINE%" "%CIBLE%" /E /XD "%RACINE%\outils" /XF salfa-config.php installation.php /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo   ERREUR : copie impossible. Lancez le script en tant qu'administrateur.
  goto echec
)
if not exist "%CIBLE%\data" mkdir "%CIBLE%\data"
if not exist "%CIBLE%\data\sauvegardes" mkdir "%CIBLE%\data\sauvegardes"
echo   Fichiers copies.

echo.
echo [2/3] Configuration MySQL et creation de la base
"%PHP%" "%RACINE%\outils\install-cli.php" "%CIBLE%"
if errorlevel 1 goto echec

echo.
echo [3/3] Verification
"%PHP%" "%RACINE%\outils\verifier-cli.php" "%CIBLE%"

echo.
echo ============================================================
echo   Termine. Ouvrez : http://localhost/caisse-salfa/
echo ============================================================
exit /b 0

:echec
echo.
echo   Installation interrompue. Corrigez le probleme ci-dessus puis relancez.
exit /b 1
