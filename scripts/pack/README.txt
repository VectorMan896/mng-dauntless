MNG DAUNTLESS - Server Pack
===========================

This folder is a complete MNG DAUNTLESS server, with the saves (accounts, characters, inventories, progress)
from the PC it was made on. KEEP IT PRIVATE: it contains the server's passwords and signing keys.

Set up on a new PC (Windows 10 or 11)
  1. Put this MNG-Server folder where it can stay, for example C:\MNG-Server
     (the server runs from this folder, so not in Downloads or on the Desktop).
  2. Double-click Install-Server.bat and allow administrator access. It:
       - installs Node.js and MongoDB if they are missing,
       - finds Dauntless 1.14.7, or downloads it for you (about 15.4 GB),
       - restores the saves from the pack,
       - asks whether players on other PCs will connect (opens the firewall ports).
     If anything stops it, fix what it says and run it again: finished steps are skipped.
  3. Double-click Start-Server.bat. Give it about a minute before playing (Ramsgate and the Training Dojo start).

Every day
  Start-Server.bat      starts the server (two windows open: MNG Backend and MNG Director - leave them open)
  Stop-Server.bat       stops it
  Restart-Server.bat    stops and starts it
  Server-Status.bat     shows what is running
  Player-Currency.bat   shows players' balances and gives or sets a currency (Rams, platinum, darkharvest, ...)
                        for one player or all; works while the server runs

Backups and moving again
  Make-Server-Pack.bat makes a new pack like this one with the latest saves, in the Server-Packs folder.
  Use it as a backup, or to move the server to the next PC (same steps as above).

Players on other PCs
  1. On this PC: Set-Server-Address.bat. It lists this PC's addresses; pick the one players can reach:
       - Tailscale address (100.x.x.x): easiest - every player installs Tailscale and joins the same network.
         No router setup, and the connection is encrypted.
       - home network address (192.168.x.x): only players in the same house.
       - public address or domain: the router must forward TCP 3000 and UDP 8780-8790 to this PC.
         Passwords then travel unencrypted until HTTPS is set up (TODO-MNG.md "Friend's server").
     Then Restart-Server.bat.
  2. On each player's PC: Start-Launcher.bat asks for the server the first time; type that address.
     (Start-Launcher.bat change asks again.)

What is inside
  Install-Server.bat     the setup
  Mystic-Paradox\        server code, settings (.env), game data, keys
  server-data\           runtime updates the server gives to launchers
  saves\database\        the saved database
  saves\game-runtime\    MysticParadox.dll and winmm.dll (copied next to the game)
  MNG-Game-Downloader\   downloads Dauntless 1.14.7 on its own (Download-Game.bat)
  pack-info.txt          when and where this pack was made
