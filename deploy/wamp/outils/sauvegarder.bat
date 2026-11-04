@echo off
REM ============================================================
REM  CAISSE SALFA - sauvegarde MySQL (dump quotidien manuel ou planifie)
REM  Sortie : deploy\wamp\sauvegardes\caisse_AAAA-MM-JJ_HH-MM.sql
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."

set "DEPLOY=%~dp0.."
set "WAMP=C:\wamp64"
if exist "C:\wamp\www" if not exist "%WAMP%\www" set "WAMP=C:\wamp"
set "MYSQL=%WAMP%\bin\mysql\mysql.exe"
set "DUMP=%WAMP%\bin\mysql\mysqldump.exe"
set "SORTIE=%DEPLOY%\sauvegardes"

if not exist "%MYSQL%" set "MYSQL=mysqldump"
if not exist "%DUMP%" set "DUMP=mysqldump"

if not exist "%SORTIE%" mkdir "%SORTIE%"
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "D=%%I"
set "DATE=%D:~0,4%-%D:~4,2%-%D:~6,2%_%D:~8,2%-%D:~10,2%"
set "FICHIER=%SORTIE%\caisse_%DATE%.sql"

echo Sauvegarde de la base caisse_salfa...
"%DUMP%" -h 127.0.0.1 -u root --single-transaction --routines --default-character-set=utf8mb4 caisse_salfa > "%FICHIER%"
if errorlevel 1 (
  echo   Echec : verifiez que WAMP est demarre et que mysqldump est accessible.
  echo   Adaptez MYSQL/DUMP et le mot de passe dans ce script si necessaire.
  exit /b 1
)
echo   Fichier cree : %FICHIER%
echo   Copiez-le vers un emplacement sur, hors du serveur.
exit /b 0
