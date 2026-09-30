# Delivery and deployment

Repository: [qiyuhuating/quorum-lab](https://github.com/qiyuhuating/quorum-lab), public, MIT.

The GitHub connector has no create-repository operation. The user's existing authenticated GitHub CLI login created the empty repository. The connector's contents/blob/tree/commit/ref operations upload the source and captured media. CLI administration handles Pages settings, repository metadata and release assets where the connector does not expose those operations. No new credentials or tokens are required.

## Deployment pipeline

1. Each pull request and push runs formatting, strict TypeScript checks, protocol tests and a production build.
2. Chromium, Firefox and WebKit run the browser suite against that build. The 100-seed benchmark checks safety, convergence and exact replay.
3. A successful `main` run uploads `dist/` as a Pages artifact.
4. The deployment job publishes it using the dedicated Pages environment and OIDC token.

The repository's Pages Source is GitHub Actions. Deployment status is visible in [Actions](https://github.com/qiyuhuating/quorum-lab/actions). `docs/validation.md` records verified outcomes; a link to the live demo belongs in README only after its page and Worker load successfully.

## Reproduce from source

```sh
git clone https://github.com/qiyuhuating/quorum-lab.git
cd quorum-lab
npm ci
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```

To rerun an existing failed workflow, inspect its logs and repair the reported cause before retrying. Do not deploy an unchecked manual build to sidestep the verification gate.

## Release materials

The v0.1.0 release uses [release-notes.md](release-notes.md). Portable demo and source archives are generated from the delivered revision. [demo-script.md](demo-script.md) provides a 90-second walkthrough. [profile-snippet.md](profile-snippet.md) is available for a later deliberate profile update.

All remote writes for this delivery are scoped to the new `quorum-lab` repository. `yihe-health` and the other audited repositories are independent.
