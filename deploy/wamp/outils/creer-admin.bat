@echo off
REM ============================================================
REM  CAISSE SALFA - creation d'un compte ou reinitialisation d'un
REM  mot de passe (administrateur, caissier ou lecteur).
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
set "RACINE=%~dp0.."
call "%~dp0_wamp.bat"
if errorlevel 1 exit /b 1

"%PHP%" "%RACINE%\outils\admin-cli.php" "%CIBLE%"
if errorlevel 1 exit /b 1
echo.
echo   Pensez a supprimer api\connexion-bootstrap.php apres la mise en service.
exit /b 0
