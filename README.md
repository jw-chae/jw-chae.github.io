# Joongwon Chae Research Website

A statically exportable Next.js research portfolio built from the supplied CV and research website source package.

## Routes

- `/`: compact bio, research interests, selected projects, recent publications, and academic record
- `/publications`: full publication archive grouped by year
- `/cv`: embedded CV preview and PDF download

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validate and export

```bash
pnpm typecheck
pnpm lint
pnpm build
```

The static export is written to `out/`.

## Deploy to GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Every push to
`main` validates the source, builds the static export, and publishes `out/`
through GitHub Pages.

For the current root-relative links and metadata, use a repository named exactly:

```text
jw-chae.github.io
```

Then configure the repository:

1. Push this project to the repository's `main` branch.
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Open **Actions** and wait for **Deploy to GitHub Pages** to finish.
5. Visit `https://jw-chae.github.io/`.

If the GitHub username is not `jw-chae`, update `metadataBase` in
`app/layout.tsx` and use `<username>.github.io` as the repository name.
A project repository such as `research-website` requires an additional
`basePath` configuration because the published URL includes the repository
name.

## Design and image provenance

- `DESIGN_REFERENCES.md` documents Gao Huang's site and the additional researcher websites reviewed.
- `public/research/SOURCES.md` records the source of every research figure.
- `screenshots/*gao-final.png` contains the final desktop and mobile visual checks.

## Verification before public deployment

BoundarySupport is a working title whose public title and status require confirmation. Under-review venues and manuscript statuses reflect the supplied CV. The public arXiv title for `2511.23276` differs from the supplied CV; both checks are retained as internal verification metadata rather than public-facing labels.
