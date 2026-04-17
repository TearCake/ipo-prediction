import { notFound } from "next/navigation";
import { StitchFrame } from "@/components/stitch-frame";
import { getScreenBySlug, stitchScreens } from "@/app/stitch-map";

type ScreenPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return stitchScreens.map((screen) => ({ slug: screen.slug }));
}

export async function generateMetadata({ params }: ScreenPageProps) {
  const { slug } = await params;
  const screen = getScreenBySlug(slug);

  if (!screen) {
    return {
      title: "Screen Not Found",
    };
  }

  return {
    title: `${screen.title} | IPO Intelligence UI`,
    description: screen.description,
  };
}

export default async function ScreenPage({ params }: ScreenPageProps) {
  const { slug } = await params;
  const screen = getScreenBySlug(slug);

  if (!screen) {
    notFound();
  }

  return <StitchFrame title={screen.title} src={screen.file} initialSlug={screen.slug} />;
}
