# MiSTer Phone Play

Touch-controller layout fixes and picture controls for [MiSTer Control](https://github.com/RemmyLee/mister-control-releases). Includes a Windows setup script for reaching your own MiSTer through Tailscale.

MiSTer Control provides the video stream, game library, and controller connection. This add-on hides the bottom navigation during play, separates the portrait controls, adds a brightness slider that lifts shadows, and guards against accidental touch zoom.

Supports **MiSTer Control 0.8.3**. This is an early release, tested on one MiSTer setup.

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

The zoom lock cancels native touch zoom, pinch gestures, and browser zoom shortcuts while the controller is open. Ordinary toolbar clicks and the brightness slider remain available. Normal browser zoom settings return when the controller closes.

## Limits and testing

- The tested video mode is low-resolution JPEG video without game audio. About 17–19 fps was measured on the test setup; phone performance depends on the network.
- Remote gameplay was confirmed on an iPhone, including Super Mario World and Doom 64. The brightness adjustment was checked against a live Doom 64 picture.
- Private forwarding was tested on Windows with Tailscale 1.104.2.
- Portrait and landscape control layouts were checked in a desktop browser. The Safari double-tap fix still needs a physical-device retest.
- Other MiSTer Control versions are not supported by the installer yet. An application update may replace the web index; reinstall a compatible add-on after updating.
- Some cores may need their own controller mapping.

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

## Development

Run the installer checks with Python 3 and a POSIX shell:

```sh
python tests/test_install.py
node --test tests/zoom-lock.test.cjs
```

On Windows, the tests use Git for Windows Bash. Set the BASH_BIN environment variable to use another shell.

## Credits

Video, game launching, and controller transport come from [MiSTer Control](https://github.com/RemmyLee/mister-control-releases). Private network access uses [Tailscale](https://tailscale.com/). This repository contains the add-on and setup scripts; it is not the MiSTer Control source or an official MiSTer project.

The code in this repository is available under the MIT license.
