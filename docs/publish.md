# Delivery and deployment

Repository: [qiyuhuating/quorum-lab](https://github.com/qiyuhuating/quorum-lab), public, MIT.

The connected GitHub plugin uploads source/media through blob, tree, commit and ref operations. It exposes no repository-create or release-admin operation. The initial repository was created with the user's existing GitHub CLI login. The v0.2 release is built and published inside GitHub Actions using its repository-scoped token.

## Verified pipeline

1. Pull requests and pushes run formatting, strict types, 18 protocol tests and the production build.
2. Chromium, Firefox and WebKit run 39 production browser checks. The 100-seed benchmark verifies safety, convergence and exact replay.
3. Successful main verification publishes the Pages artifact through the OIDC Pages environment.
4. After verification and deployment, the release job reads the version in package.json. An existing public release is left unchanged.
5. For a new version, it rebuilds the exact revision and generates source ZIP, portable demo ZIP, a complete Git bundle and SHA-256 checksums.
6. ZIP integrity, source-version agreement and Git bundle integrity are checked before publishing. An unfinished draft can be retried; the complete release is then made public.

[Actions](https://github.com/qiyuhuating/quorum-lab/actions) exposes the results. [validation.md](validation.md) records tests; [live-check.json](live-check.json) records actual public-page behavior.

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
