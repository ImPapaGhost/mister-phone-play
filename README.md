# MiSTer Phone Play

Phone controls and picture settings for [MiSTer Control](https://github.com/RemmyLee/mister-control-releases), with a Windows helper for private access through Tailscale.

Requires **MiSTer Control 0.8.3**.

## What you need

- A MiSTer with network access and your games already installed.
- MiSTer Control 0.8.3, installed from its [release repository](https://github.com/RemmyLee/mister-control-releases). Follow that project's installation instructions first.
- A phone browser. Home-network play needs no PC.
- For play away from home: Tailscale on your phone and a Windows PC on the same home network as the MiSTer. Both Tailscale clients must use your account.

The MiSTer Control installer downloads its application and optional data and adds a startup entry and logging settings. This add-on does not install or redistribute that application, game files, or its game database.

## Install on the MiSTer

1. Download this repository's ZIP from **Code > Download ZIP** and extract it.
2. Copy the extracted folder to `/media/fat/Scripts/mister-phone-play/` on the MiSTer SD card. Keep `install.sh`, `ASSET-SHA256SUMS`, and `assets/` together. If the SD card is connected to a PC, this is the `Scripts/mister-phone-play/` folder at the card root.
3. Open **Scripts > mister-phone-play > install** on the MiSTer, or run over SSH:

   ```sh
   sh /media/fat/Scripts/mister-phone-play/install.sh
   ```

4. Reload MiSTer Control in your phone browser. On home Wi-Fi, its address is `http://YOUR-MISTER-IP:8110/`.
5. Tap the running game, or choose **Controllers > Play on phone**.

The installer backs up the web index and adds its files under MiSTer Control's `web/phone-play/` directory. It also installs a default map for the virtual touch controller if no map exists. Existing controller maps are preserved. If a new map was added, reload the core before testing the buttons.

The game and MiSTer service do not restart during installation. The original JavaScript and CSS bundles are left in place.

## Play away from home

Do this on a Windows PC connected to the same home network as the MiSTer:

1. Install [Tailscale for Windows](https://tailscale.com/download/windows). Windows may ask for administrator approval.
2. Sign in to Tailscale on the PC and phone using the same account.
3. Find the MiSTer's home-network IP address. Open PowerShell in the extracted repository folder and run the following, replacing the example address with your MiSTer's address:

   ```powershell
   Unblock-File -LiteralPath .\windows\Connect-MiSTer.ps1
   powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\windows\Connect-MiSTer.ps1 -MiSTerAddress 192.168.1.50 -KeepConnected
   ```

4. Open the address printed by the script in your phone browser. Keep Tailscale connected on the phone and leave **Exit node > None**.

The script forwards only the MiSTer Control service on port 8110. It does not advertise a subnet or use Tailscale Funnel. `-KeepConnected` enables Tailscale's unattended mode so the connection can remain up when Windows signs out. The PC and MiSTer must stay powered on.

If port 8110 is already used by another Tailscale Serve configuration, choose a different port with `-ListenPort 8112`. The script checks before replacing a service.

See [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) for the underlying forwarding feature. Your own Tailscale access rules still apply.

## Controls and picture

- Tap **View > Picture brightness** to lift dark areas of the streamed picture. **100%** is normal. The setting is saved in that browser; **Reset brightness** restores it.
- The navigation bar hides while the controller is open. Close the controller with **X** to bring it back.
- To quit a game, save in-game, close the controller, then choose **Power > Exit to menu**.
- Closing the browser tab disconnects the remote view. The game continues on the MiSTer.

## Limitations

- Low-resolution video without game audio. Frame rate and delay depend on the network.
- Some cores need their own controller mapping.
- Only MiSTer Control 0.8.3 is supported. An application update may replace the web index; reinstall a compatible add-on afterward.

## Remove

Run **Scripts > mister-phone-play > uninstall**, or:

```sh
sh /media/fat/Scripts/mister-phone-play/uninstall.sh
```

This removes the add-on's index entries and web files. A controller map is removed only if this installer created it and it has not been changed. Index backups remain in `/media/fat/mister-control/.phone-play/`.

To stop private forwarding on Windows, run the command printed by the setup script. With the default port:

```powershell
& "$env:ProgramFiles\Tailscale\tailscale.exe" serve --tcp=8110 off
```

This leaves Tailscale installed and signed in. It does not change unattended mode.

## Credits

Video, game launching, and controller transport come from [MiSTer Control](https://github.com/RemmyLee/mister-control-releases). Private network access uses [Tailscale](https://tailscale.com/). This repository contains the add-on and setup scripts; it is not the MiSTer Control source or an official MiSTer project.

The code in this repository is available under the MIT license.
