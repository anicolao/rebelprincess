# Rebel Princess

This repository is the starting point for a realtime, browser-based game of
Rebel Princess. It currently contains documentation and a locked Firebase
backend configuration only; the game itself is intentionally not implemented.

See [RULES.md](RULES.md) for the initial rules summary and
[ARCHITECTURE.md](ARCHITECTURE.md) for the proposed trusted-client protocol.
Future gameplay work must follow the deterministic, zero-pixel-tolerance policy
in [E2E_GUIDE.md](E2E_GUIDE.md).

## Firebase

- Project: `rebel-princess-20260715`
- Web app: `Rebel Princess Web`
- Database: Cloud Firestore in `nam5`
- Authentication: anonymous sign-in is intended for frictionless room play
- Production rules: deny all until the protocol and emulator tests exist

Firebase browser configuration is public configuration, not a secret. Security
comes from Authentication and Firestore Security Rules. Never commit service
account credentials.

Enter the Nix shell, install the local CLI, and start the emulators with:

```sh
nix develop
bun install
bun run emulators
```

## License

Copyright (C) 2026 Alex Nicolaou. Licensed under the GNU General Public
License, version 3. See [LICENSE](LICENSE).
