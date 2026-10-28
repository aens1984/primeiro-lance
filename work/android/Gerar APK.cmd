@echo off
chcp 65001 >nul
title Primeiro Lance - Gerar aplicativo Android
echo Primeiro Lance - Android
echo.
echo A primeira compilacao baixa ferramentas oficiais e pode demorar.
echo Nao e necessario executar como administrador.
echo.
if exist "%~dp0fontes\build.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fontes\build.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
)
if errorlevel 1 (
  echo.
  echo Nao foi possivel concluir. Consulte o arquivo build.log na pasta fontes.
  pause
  exit /b 1
)
echo.
echo APK criado. Abra a pasta Android e transfira Primeiro-Lance.apk para o celular.
pause
