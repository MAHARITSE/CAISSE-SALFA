@echo off
REM ============================================================
REM  CAISSE SALFA - sauvegarde MySQL datee
REM  Sortie : data\sauvegardes\caisse_AAAA-MM-JJ_HH-MM.sql
REM ============================================================
setlocal EnableExtensions
chcp 65001 >nul
set "RACINE=%~dp0.."
call "%~dp0_wamp.bat"
if errorlevel 1 exit /b 1

set "DUMP="
for /f "delims=" %%D in ('dir /b /o-n "%WAMP%\bin\mysql\mysql*\mysqldump.exe" 2^>nul') do if not defined DUMP set "DUMP=%WAMP%\bin\mysql\%%D\mysqldump.exe"
if not defined DUMP (
  echo   ERREUR : mysqldump.exe introuvable sous %WAMP%\bin\mysql
  exit /b 1
)
if not exist "%CIBLE%\data\sauvegardes" mkdir "%CIBLE%\data\sauvegardes"
for /f "tokens=1-3 delims=/-. " %%a in ('echo %DATE%') do set "JOUR=%%a-%%b-%%c"
set "HEURE=%TIME:~0,2%-%TIME:~3,2%"
set "HEURE=%HEURE: =0%"
set "FICHIER=%CIBLE%\data\sauvegardes\caisse_%JOUR%_%HEURE%.sql"

"%PHP%" "%RACINE%\outils\sauvegarde-cli.php" "%CIBLE%" "%DUMP%" "%FICHIER%"
if errorlevel 1 exit /b 1
echo   Sauvegarde ecrite : %FICHIER%
echo   Copiez ce fichier hors du serveur (cle USB, disque reseau).
exit /b 0
