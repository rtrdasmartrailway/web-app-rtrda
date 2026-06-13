// Loading skeletons for streamed (Suspense) page regions.
// Plain server components — Tailwind v4 ships `animate-pulse`, no config needed.
// Each skeleton keeps the real component's outer wrapper (section padding,
// container, grid) so the fallback occupies the same space (no layout shift).

const FONT = { fontFamily: "'Hanken Grotesk', 'Noto Sans Thai', sans-serif" };

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-[#e8eef7] ${className}`} />;
}

/** Matches HeroSlider — full-width 16/7 banner. */
export function HeroSkeleton() {
  return <SkeletonBox className="w-full aspect-[16/7] rounded-none" />;
}

/** A single news card placeholder (matches HomePage / CategoryPage news cards). */
function NewsCardSkeleton({ imageHeight = "h-52" }: { imageHeight?: string }) {
  return (
    <div className="bg-white border border-[#c3c6d2] overflow-hidden">
      <SkeletonBox className={`${imageHeight} w-full rounded-none`} />
      <div className="p-4 space-y-2">
        <SkeletonBox className="h-3 w-24" />
        <SkeletonBox className="h-4 w-11/12" />
        <SkeletonBox className="h-4 w-3/4" />
        <SkeletonBox className="h-3 w-full mt-2" />
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Horizontal article-row placeholder (HomePage "บทความล่าสุด"). */
function ArticleRowSkeleton() {
  return (
    <div className="bg-white border border-[#c3c6d2] p-4 flex gap-4">
      <SkeletonBox className="flex-shrink-0 w-32 h-24 rounded-none" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonBox className="h-3 w-20" />
        <SkeletonBox className="h-4 w-11/12" />
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Calendar widget placeholder. */
function CalendarSkeleton() {
  return (
    <div className="bg-white border border-[#c3c6d2] p-5">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBox className="h-4 w-32" />
        <SkeletonBox className="h-7 w-16" />
      </div>
      <SkeletonBox className="h-4 w-24 mx-auto mb-3" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <SkeletonBox key={i} className="aspect-square rounded-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Homepage News + Articles + Calendar region (a single Suspense fallback that
 * mirrors both the white news-grid section and the grey articles/calendar row).
 */
export function NewsHomeSkeleton() {
  return (
    <>
      <section className="py-16 bg-white" style={FONT}>
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="mb-8 space-y-2">
            <SkeletonBox className="h-7 w-56" />
            <SkeletonBox className="h-1 w-16 rounded-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <NewsCardSkeleton key={i} imageHeight="h-52" />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f3f3f3]" style={FONT}>
        <div className="mx-auto max-w-[1280px] px-10">
          <div className="flex gap-8 items-start flex-col lg:flex-row">
            <div className="flex-1 min-w-0">
              <div className="mb-6 space-y-2">
                <SkeletonBox className="h-7 w-48" />
                <SkeletonBox className="h-1 w-16 rounded-none" />
              </div>
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <ArticleRowSkeleton key={i} />
                ))}
              </div>
            </div>
            <div className="w-full lg:w-72 flex-shrink-0">
              <CalendarSkeleton />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Strategic-partners logo row. */
export function PartnersSkeleton() {
  return (
    <section className="py-16 bg-white border-t border-[#c3c6d2]" style={FONT}>
      <div className="mx-auto max-w-[1280px] px-10 text-center">
        <SkeletonBox className="h-6 w-64 mx-auto mb-8" />
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="w-16 h-16 rounded-none" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** CategoryPage news/related grid (also reused for the child-pages branch). */
export function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <NewsCardSkeleton key={i} imageHeight="h-48" />
      ))}
    </div>
  );
}

/** StandardPage sidebar + related grid. */
export function StandardSkeleton() {
  return (
    <>
      <aside className="page-sidebar" aria-hidden="true">
        <SkeletonBox className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="h-4 w-full" />
          ))}
        </div>
      </aside>
      <div className="content-main">
        <div className="related-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBox className="h-40 w-full" />
              <SkeletonBox className="h-3 w-20" />
              <SkeletonBox className="h-4 w-11/12" />
              <SkeletonBox className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** PostPage article body. */
export function PostSkeleton() {
  const widths = ["w-full", "w-11/12", "w-full", "w-10/12", "w-full", "w-9/12", "w-full", "w-2/3"];
  return (
    <div className="space-y-3">
      {widths.map((w, i) => (
        <SkeletonBox key={i} className={`h-4 ${w}`} />
      ))}
    </div>
  );
}

/** Search results list. */
export function SearchResultsSkeleton() {
  return (
    <div className="search-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBox className="h-40 w-full" />
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-4 w-11/12" />
          <SkeletonBox className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
