export type StitchScreen = {
  slug: string;
  title: string;
  file: string;
  description: string;
};

export const stitchScreens: StitchScreen[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    file: "/stitch/dashboard.html",
    description: "Neumorphic dashboard overview for IPO prediction workflows.",
  },
  {
    slug: "model-comparison",
    title: "Model Comparison",
    file: "/stitch/model-comparison.html",
    description: "Compare model quality and behavior side by side.",
  },
  {
    slug: "history",
    title: "History",
    file: "/stitch/history.html",
    description: "Review historical forecasts and generated analyses.",
  },
  {
    slug: "about",
    title: "About",
    file: "/stitch/about.html",
    description: "Project narrative and context behind the platform.",
  },
  {
    slug: "insights",
    title: "Insights",
    file: "/stitch/insights.html",
    description: "Curated recommendations and business intelligence highlights.",
  },
  {
    slug: "predict-ipo",
    title: "Predict IPO",
    file: "/stitch/predict-ipo.html",
    description: "Final refined prediction flow and output details.",
  },
];

export function getScreenBySlug(slug: string) {
  return stitchScreens.find((screen) => screen.slug === slug);
}
