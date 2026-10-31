@echo off
rem MNG DAUNTLESS: sets the server up on this PC (Node.js, MongoDB, the game, the saves). Double-click and answer the
rem questions. Windows asks for administrator permission (needed to install MongoDB and set it up).
title MNG DAUNTLESS - Install Server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Mystic-Paradox\scripts\mng-install-server.ps1" %*
