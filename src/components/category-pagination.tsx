import Link from "next/link";
import type { CategoryPagination } from "@/lib/db/page-data";

/**
 * Numbered pagination control for category listings.
 * Layout: [1] [2] [...] [24] [»]
 * - Active page: dark navy
 * - Ellipsis: not a link
 * - Prev/next arrow on each side
 */
export function CategoryPagination({ pagination }: { pagination: CategoryPagination }) {
  const { currentPage, totalPages, basePath } = pagination;
  if (totalPages <= 1) return null;

  // Build the visible page numbers: always show 1, last, current ± 1,
  // with ellipsis between gaps.
  const pages = buildPageList(currentPage, totalPages);

  const hrefFor = (page: number) => (page === 1 ? basePath : `${basePath}/page/${page}`);

  return (
    <nav className="category-pagination" aria-label="Category pagination">
      {/* Prev arrow */}
      {currentPage > 1 ? (
        <Link
          href={hrefFor(currentPage - 1)}
          rel="prev"
          className="pagination-arrow prev"
          aria-label="Previous page"
        >
          «
        </Link>
      ) : (
        <span className="pagination-arrow prev disabled" aria-hidden="true">
          «
        </span>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="pagination-ellipsis">
            …
          </span>
        ) : p === currentPage ? (
          <span key={p} className="pagination-page active" aria-current="page">
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className="pagination-page">
            {p}
          </Link>
        ),
      )}

      {/* Next arrow */}
      {currentPage < totalPages ? (
        <Link
          href={hrefFor(currentPage + 1)}
          rel="next"
          className="pagination-arrow next"
          aria-label="Next page"
        >
          »
        </Link>
      ) : (
        <span className="pagination-arrow next disabled" aria-hidden="true">
          »
        </span>
      )}
    </nav>
  );
}

function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [];
  const window = 1; // pages to show on each side of current

  // Always show page 1
  pages.push(1);

  // Left ellipsis if current - window > 2
  if (current - window > 2) pages.push("...");

  // Pages around current
  const start = Math.max(2, current - window);
  const end = Math.min(total - 1, current + window);
  for (let p = start; p <= end; p++) pages.push(p);

  // Right ellipsis if current + window < total - 1
  if (current + window < total - 1) pages.push("...");

  // Always show last page
  pages.push(total);

  return pages;
}
