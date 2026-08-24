# Joongwon Chae Research Website

A bilingual, statically exported Next.js research portfolio built from the supplied CV and verified publication records.

## Routes

- `/`: English profile, selected research, publications, and academic record
- `/publications`: English publication archive
- `/cv`: English CV preview and PDF download
- `/zh`: Chinese profile and research overview
- `/zh/publications`: Chinese publication archive
- `/zh/cv`: Chinese CV preview and PDF download

Each page includes a language switch that preserves the current section.

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
`app/(en)/layout.tsx` and `app/(zh)/zh/layout.tsx`, then use
`<username>.github.io` as the repository name.
A project repository such as `research-website` requires an additional
`basePath` configuration because the published URL includes the repository
name.

## Rebuild the CV PDFs

`scripts/build_cv.py` generates the English and Chinese PDFs in `output/pdf/`
and copies the web-ready versions to `public/`. It expects the private ID photo
`JOONGWON_CHAE_ID Photo.jpg` one directory above this repository and uses local
Windows fonts for English and CJK text, so font paths must be adapted on other
operating systems.

## Design and image provenance

- `DESIGN_REFERENCES.md` documents Gao Huang's site and the additional researcher websites reviewed.
- `public/research/SOURCES.md` records the source of every research figure.

## Publication verification

Published and preprint author lists are transcribed from current arXiv, DOI,
publisher, and supplied manuscript records. The two signature preprints,
BoundarySupport and CLEANCON, are listed first and their supplied PDFs are
hosted under `public/papers/`. Together with ProCon, GCR, and Memory-SAM, they
form the five signature projects on the home page. The unpublished ViGen entry intentionally lists only
the two confirmed co-first authors because its complete author list is not yet
public.
