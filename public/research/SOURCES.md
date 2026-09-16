# Research image sources

- `procon-overview.webp`: `jw-chae/Procon`, `figures/fig1_overview_pb.png`
- `procon-concept.webp`: `jw-chae/Procon`, `figures/fig2_projection_concept_pb.png`
- `procon-qualitative.webp`: `jw-chae/Procon`, `figures/fig5_a1_mvtec.png`
- `procon-hero-strip.webp`: crop of `jw-chae/Procon`, `figures/fig5_a1_mvtec.png`
- `memory-sam-architecture.webp`: `jw-chae/memory-sam`, `figures/figure_architecture.png`
- `gcr-overview.webp`: Figure 1 cropped from arXiv `2601.01856`
- `boundarysupport-framework.png`: Figure 2 cropped from the supplied preprint, *What Remains Normal? Clean Images Miss Useful Near-Defect Normal Patches for Anomaly Detection*
- `cleancon-principle.png`: Figure 1 cropped from the supplied preprint, *What Memory Composition Does Not Tell Us About Anomaly Detection*

All images are derived from the author's official repositories or supplied papers.

## `public/anomaly/` (Anomaly Detection, Visually page)

- `<category>-{input,gt,nn,spm,procon}.webp` for bottle, cable, capsule, carpet, grid: cells cropped from `jw-chae/Procon`, `figures/fig5_a1_mvtec.png` (same source as `procon-qualitative.webp`).
- `<category>-defect.webp`, `<category>-good.webp`, `<category>-mask.png`, `mask28.json` for leather, hazelnut, tile, screw, carpet: MVTec AD test/train images and ground-truth masks (Bergmann et al., CVPR 2019), licensed CC BY-NC-SA 4.0 and used here non-commercially with attribution. `mask28.json` aligns each mask to the 28 × 28 DINOv2 patch grid (a cell is 1 if any defect pixel falls inside it).

## `public/projects/` (진행 중인 프로젝트 page)

- `flymem-pap.webp`: crop of the author's own `lab/flymem/figs/fig1_pap_vs_nimage.png`, MVTec AD metal_nut/tile (CC BY-NC-SA 4.0).
- `flyvis-maps.webp`: crop of the author's own `lab/flyvis/results/exp2_leather_flow_0000_000/figure.png` (flyvis pretrained optic-lobe model; MVTec AD leather).
- `flymem-mascot.png` (optional): author-supplied mascot illustration.

