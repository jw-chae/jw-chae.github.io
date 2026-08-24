import type { MetadataRoute } from "next";

const base = "https://jw-chae.github.io";
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { en: "/", zh: "/zh/" },
    { en: "/publications/", zh: "/zh/publications/" },
    { en: "/cv/", zh: "/zh/cv/" },
  ];

  return routes.flatMap(({ en, zh }) => [
    {
      url: `${base}${en}`,
      lastModified: new Date("2026-08-24"),
      changeFrequency: "monthly" as const,
      priority: en === "/" ? 1 : 0.8,
      alternates: { languages: { en: `${base}${en}`, "zh-CN": `${base}${zh}` } },
    },
    {
      url: `${base}${zh}`,
      lastModified: new Date("2026-08-24"),
      changeFrequency: "monthly" as const,
      priority: zh === "/zh/" ? 0.9 : 0.7,
      alternates: { languages: { en: `${base}${en}`, "zh-CN": `${base}${zh}` } },
    },
  ]);
}
