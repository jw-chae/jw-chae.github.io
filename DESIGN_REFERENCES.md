# Design reference matrix

This redesign preserves the existing routes, research content, source links, SEO structure, and accessibility baseline. After a visual audit of Gao Huang's homepage, the interface was rebuilt as a compact, content-first academic website.

## Design read

- Mode: redesign overhaul
- Audience: professors, research collaborators, and technical hiring reviewers
- Design variance: 5/10
- Motion intensity: 1/10
- Visual density: 5/10
- Theme: compact academic profile
- Typography: Helvetica/Arial system sans
- Palette: white page, plum navigation, navy headings, blue scholarly links

## Sites reviewed

| Reference | Observed strength | Applied principle |
| --- | --- | --- |
| [Gao Huang](https://gaohuang-net.github.io/) | A narrow reading frame, 16/24 Helvetica text, compact 40px identity heading, cardless hierarchy, and paper-first rows. | Use a 920px modern container, 46px semantic navigation bar, small blue headings, real research teasers, and bracketed resource links. Rebuild the broken float/percentage mobile layout with responsive grid. |
| [Kaiming He](https://people.csail.mit.edu/kaiming/) | Credentials and research reputation are immediately legible. | Put affiliation and the research thesis before biography. |
| [Richard Zhang](https://richzhang.github.io/) | Real paper teasers and resource links appear early. | Keep Paper and Code beside each project. |
| [Keunhong Park](https://keunhong.com/) | Highlights precede the publication archive and use real research media. | Lead with a compact visual atlas and one-sentence contributions. |
| [Jon Barron](https://jonbarron.info/) | Each paper pairs a real result image with a concise contribution. | Attach the research claim directly to the figure. |
| [Ben Mildenhall](https://bmild.github.io/) | Four canonical projects are summarized before the full research list. | Give selected work a stronger hierarchy than the archive. |
| [Saining Xie](https://www.sainingxie.com/) | Research metadata is clear and mobile figures stack at full width. | Preserve figures on mobile and keep body text at a readable size. |
| [Jiajun Wu](https://jiajunwu.com/) | Publications are organized for scanning by date and topic. | Group the archive by year and label each research area. |
| [Fred Hohman](https://fredhohman.com/) | The profile, thesis, and featured visual work form one coherent first screen. | Use a compact identity block and visual evidence without a marketing hero. |

No page was copied. Gao Huang provides the dominant density and hierarchy reference; its dated Bootstrap table, float navigation, percentage gutters, and mobile overflow were deliberately not reproduced.

## Deliberate removals

- Full-viewport marketing hero and bento-style research atlas
- Warm paper, oxide-red, Manrope, and decorative mono-label styling
- Oversized 4rem section headings and 5-8rem section spacing
- Five-column “research primitives” taxonomy
- Duplicate research imagery and public-facing verification labels
- Nested tinted project panels, hover zoom, shadows, and rounded cards

## Responsive rule

Desktop research entries use a 240px visual rail beside concise project text. Below 700px they become a full-width single column, the header compresses to one 50px navigation row, all primary links remain available, and no image is hidden. The implementation is verified without relying on `overflow-x: hidden`.
