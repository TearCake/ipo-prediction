"use client";

import { useEffect, useMemo, useState } from "react";
import { stitchScreens } from "@/app/stitch-map";

type StitchFrameProps = {
  title: string;
  src: string;
  initialSlug?: string;
};

export function StitchFrame({ title, src, initialSlug }: StitchFrameProps) {
  const slugToFile = useMemo(
    () => Object.fromEntries(stitchScreens.map((screen) => [screen.slug, screen.file])),
    []
  );
  const slugToRoute = useMemo(
    () => Object.fromEntries(stitchScreens.map((screen) => [screen.slug, `/${screen.slug}`])),
    []
  );

  function resolveSlugFromPath(path: string) {
    const clean = path.replace(/\/+$/, "") || "/";

    for (const screen of stitchScreens) {
      if (clean === `/${screen.slug}` || clean === screen.file.replace(/\.html$/, "")) {
        return screen.slug;
      }
      if (clean === screen.file || clean === `/stitch/${screen.slug}.html`) {
        return screen.slug;
      }
    }

    if (clean === "/") {
      return "dashboard";
    }

    return null;
  }

  function getPathFromHref(href: string) {
    try {
      return new URL(href, window.location.origin).pathname;
    } catch {
      return href;
    }
  }

  const startingSlug = initialSlug ?? resolveSlugFromPath(typeof window === "undefined" ? "/" : window.location.pathname) ?? "dashboard";
  const startingSrc = slugToFile[startingSlug] ?? src;

  const [activeSlug, setActiveSlug] = useState(startingSlug);
  const [activeSrc, setActiveSrc] = useState(startingSrc);
  const [preloadSlug, setPreloadSlug] = useState<string | null>(null);
  const [preloadSrc, setPreloadSrc] = useState<string | null>(null);

  function startTransition(targetSlug: string) {
    const targetSrc = slugToFile[targetSlug];
    if (!targetSrc || targetSlug === activeSlug || targetSlug === preloadSlug) {
      return;
    }

    setPreloadSlug(targetSlug);
    setPreloadSrc(targetSrc);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; href?: string } | null;
      if (!data || data.type !== "stitch:navigate" || !data.href) {
        return;
      }

      const targetPath = getPathFromHref(data.href);
      const targetSlug = resolveSlugFromPath(targetPath);
      if (!targetSlug) {
        return;
      }

      startTransition(targetSlug);
    }

    function onPopState() {
      const targetSlug = resolveSlugFromPath(window.location.pathname);
      if (!targetSlug) {
        return;
      }

      startTransition(targetSlug);
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", onPopState);
    };
  }, [activeSlug, preloadSlug, slugToFile]);

  function onPreloadFrameLoaded() {
    if (!preloadSlug || !preloadSrc) {
      return;
    }

    const nextRoute = slugToRoute[preloadSlug] ?? "/dashboard";
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }

    setActiveSlug(preloadSlug);
    setActiveSrc(preloadSrc);
    setPreloadSlug(null);
    setPreloadSrc(null);
  }

  return (
    <div className="stitch-shell" aria-label={`${title} interactive view`}>
      <iframe className="stitch-embed stitch-embed-active" title={title} src={activeSrc} loading="eager" />
      {preloadSrc ? (
        <iframe
          className="stitch-embed stitch-embed-preload"
          title={`${title} transition`}
          src={preloadSrc}
          loading="eager"
          onLoad={onPreloadFrameLoaded}
        />
      ) : null}
    </div>
  );
}
