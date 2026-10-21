# Testing

## Automated checks

Run from the repository root:

```sh
python tests/test_install.py
node --test tests/zoom-lock.test.cjs
```

The installer checks require Python 3 and a POSIX shell. On Windows they use Git for Windows Bash; set `BASH_BIN` to use another shell. The gesture checks use Node.js and require no packages.

## Verified setup

- MiSTer Control 0.8.3 on one MiSTer, with a live installation of this add-on.
- Private forwarding from Windows using Tailscale 1.104.2.
- Remote gameplay on an iPhone with Super Mario World and Doom 64.
- Picture adjustment against live Doom 64 video.
- Portrait and landscape layout checks in a desktop browser.
- Installer checks: 9 passed.
- Gesture-handler checks: 10 passed.

The video sample measured about 17–19 fps. That is an observation from this setup, not a performance guarantee.

## Still to verify

- Physical iPhone/Safari double-tap and pinch behavior with the current zoom lock.
- Simultaneous touch controls after canceling native touch gestures on Safari.
- Other MiSTer Control versions and a wider range of cores and phone browsers.

The in-app browser cannot inject real touch gestures. Its viewport and mouse-click checks do not establish Safari touch compatibility.
