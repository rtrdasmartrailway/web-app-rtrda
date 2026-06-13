import { HeroSkeleton, SkeletonBox } from "@/components/skeletons";

// Fallback for the page content only. The nav + footer live in layout.tsx and
// stay visible during navigation, so this never covers the top nav bar.
export default function Loading() {
  return (
    <div aria-busy="true">
      <HeroSkeleton />
      <div className="mx-auto max-w-[1280px] px-10 py-16 space-y-3">
        <SkeletonBox className="h-7 w-1/2" />
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-11/12" />
        <SkeletonBox className="h-4 w-10/12" />
        <SkeletonBox className="h-4 w-2/3" />
      </div>
    </div>
  );
}
