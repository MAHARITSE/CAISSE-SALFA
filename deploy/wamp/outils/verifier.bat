@echo off
REM ============================================================
REM  CAISSE SALFA - verification de l'installation
REM  Controle PHP, MySQL, les tables et le compte administrateur.
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
set "RACINE=%~dp0.."
call "%~dp0_wamp.bat"
if errorlevel 1 exit /b 1

set "CIBLE_SITE=%CIBLE%"
if exist "%~dp0..\index.html" if "%~1"=="--local" set "CIBLE_SITE=%RACINE%"

"%PHP%" "%RACINE%\outils\verifier-cli.php" "%CIBLE_SITE%"
if errorlevel 1 (
  echo.
  echo   Des problemes subsistent. Consultez les lignes [ECHEC] ci-dessus.
  exit /b 1
)
exit /b 0
