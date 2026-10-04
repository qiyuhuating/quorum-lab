# Delivery and deployment

Repository: [qiyuhuating/quorum-lab](https://github.com/qiyuhuating/quorum-lab), public, MIT.

The connected GitHub plugin uploads source/media through blob, tree, commit and ref operations. It exposes no repository-create or release-admin operation. The initial repository was created with the user's existing GitHub CLI login. Versioned releases are built and published inside GitHub Actions using its repository-scoped token.

## Verified pipeline

1. Pull requests and pushes run formatting, strict types, 24 protocol tests and the production build.
2. Chromium, Firefox and WebKit run 48 production browser checks. The 100-seed mixed-fault benchmark verifies safety, convergence and exact diagnostic replay.
3. Successful main verification publishes the Pages artifact through the OIDC Pages environment.
4. A separate cloud job tests the actual published URL: chapters, causal repair/RPC, keyboard directed cut, export/import, automatic guide, four responsive widths and a new applied write. It uploads screenshots and a revision-stamped JSON report.
5. After live acceptance passes, the release job reads package.json. A public version is left unchanged; a new version rebuilds the exact revision and generates source ZIP, portable demo ZIP, complete Git bundle and SHA-256 checksums.
6. The demo ZIP is extracted to an isolated directory and started with its own bundled server. The same browser acceptance runs against the extracted assets, including the real Worker.
7. Both acceptance reports join the downloadable assets and checksum manifest. ZIP integrity, source-version agreement and bundle integrity also must pass. An unfinished draft can be retried; only a complete release becomes public.

[Actions](https://github.com/qiyuhuating/quorum-lab/actions) exposes results and the `production-acceptance` artifact. The release includes `production-validation.json` and `portable-validation.json`. These jobs run on GitHub's hosted Ubuntu runners after the connector's push and do not depend on the development computer remaining powered on.

## Reproduce

```sh
git clone https://github.com/qiyuhuating/quorum-lab.git
cd quorum-lab
npm ci
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```

To package an existing production build, use Python 3 and Git:

```sh
python scripts/package-release.py --out release
```

The checked-out revision must match local main. The portable demo needs only Node.js 22.12+ and a browser; Python and npm are not required to run it.

## Version publishing

Bump package.json and package-lock.json, update release-notes.md, then commit to main through the connector. CI creates a public release only after all gates succeed. Existing public versions are immutable in this workflow. Repair failed checks before retrying; do not bypass the verification gate.

All writes are scoped to quorum-lab. yihe-health and the other audited repositories remain independent.
