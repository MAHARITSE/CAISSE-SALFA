@echo off
REM ============================================================
REM  CAISSE SALFA - verification de l'installation WAMP
REM  Controle les fichiers du site et la reponse de l'API.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."

set "WAMP=C:\wamp64"
if exist "C:\wamp\www" if not exist "%WAMP%\www" set "WAMP=C:\wamp"
set "CIBLE=%WAMP%\www\caisse-salfa"
set "WAMP_PHP=%WAMP%\bin\php\php.exe"
set /a ERREURS=0

echo ============================================================
echo   Verification de CAISSE SALFA
echo   Dossier : %CIBLE%
echo ============================================================
echo.

for %%F in (index.html api\points\livre.php api\points\sante.php api\points\cloture.php api\salfa-config.php api\socle.php sql\salfa_install.sql) do (
  if exist "%CIBLE%\%%F" (echo   OK    %%F) else (echo   MANQUE %%F & set /a ERREURS+=1)
)

echo.
if exist "%WAMP_PHP%" if exist "%CIBLE%\api\tests\test-api.php" (
  echo Tests de validation de l'API :
  "%WAMP_PHP%" "%CIBLE%\api\tests\test-api.php"
  if errorlevel 1 set /a ERREURS+=1
) else (
  echo   php.exe ou test-api.php introuvable : tests ignores.
)

echo.
if %ERREURS% GTR 0 (
  echo   %ERREURS% probleme^(s^) detecte^(s^). Relancez outils\installer.bat.
  exit /b 1
)
echo   Installation complete. Ouvrez http://localhost/caisse-salfa/
exit /b 0
