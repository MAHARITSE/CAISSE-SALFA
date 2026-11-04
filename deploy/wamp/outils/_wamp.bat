@echo off
REM ============================================================
REM  Detecte WAMP, php.exe et le dossier cible.
REM  Appele par les autres scripts : ne pas lancer directement.
REM  Definit WAMP, PHP et CIBLE.
REM ============================================================
set "WAMP="
for %%D in ("C:\wamp64" "C:\wamp" "D:\wamp64" "D:\wamp" "C:\wamp\bin") do (
  if exist "%%~D\www" if not defined WAMP set "WAMP=%%~D"
)
if not defined WAMP (
  echo   ERREUR : WAMP introuvable ^(C:\wamp64, C:\wamp, D:\wamp64, D:\wamp^).
  echo   Modifiez la liste des dossiers dans outils\_wamp.bat.
  exit /b 1
)

set "PHP="
for /f "delims=" %%P in ('dir /b /o-n "%WAMP%\bin\php\php*.exe" 2^>nul') do if not defined PHP set "PHP=%WAMP%\bin\php\%%P"
if not defined PHP (
  echo   ERREUR : php.exe introuvable dans %WAMP%\bin\php
  echo   Dans WAMP, menu PHP ^> Version : installer une version 8.1 ou plus.
  exit /b 1
)

set "CIBLE=%WAMP%\www\caisse-salfa"
echo   WAMP : %WAMP%
echo   PHP  : %PHP%
echo   Site : %CIBLE%
exit /b 0
