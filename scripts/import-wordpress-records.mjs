import {
  decodeSegment,
  extractDownloadLinks,
  getPathFromUrl,
  SOURCE_ORIGIN,
} from "./import-wordpress-helpers.mjs";
import {
  htmlToText,
  sanitizeAndRewrite,
  stripHtml,
} from "./import-wordpress-sanitize.mjs";

export function createPageRecords(items, language) {
  const pathById = new Map(
    items.map((item) => [item.id, getPathFromUrl(item.link) ?? "/"]),
  );
  const records = [];
  const downloadLinks = [];

  for (const item of items) {
    const routePath = getPathFromUrl(item.link) ?? "/";
    const rawContent = item.content?.rendered ?? "";

    downloadLinks.push(...extractDownloadLinks(rawContent, routePath));
    records.push({
      id: `${language}-page-${item.id}`,
      wpId: item.id,
      language,
      kind: "page",
      path: routePath,
      sourceUrl: item.link,
      title: htmlToText(item.title?.rendered),
      excerpt: stripHtml(item.excerpt?.rendered),
      contentHtml: sanitizeAndRewrite(rawContent),
      modified: item.modified,
      date: item.date,
      parentPath: item.parent ? (pathById.get(item.parent) ?? null) : null,
      categoryIds: [],
      featuredMediaId: item.featured_media || null,
    });
  }

  return { records, downloadLinks };
}

export function createPostRecords(items, language) {
  const records = [];
  const downloadLinks = [];

  for (const item of items) {
    const routePath = getPathFromUrl(item.link) ?? `/${item.slug}`;
    const rawContent = item.content?.rendered ?? "";

    downloadLinks.push(...extractDownloadLinks(rawContent, routePath));
    records.push({
      id: `${language}-post-${item.id}`,
      wpId: item.id,
      language,
      kind: "post",
      path: routePath,
      sourceUrl: item.link,
      title: htmlToText(item.title?.rendered),
      excerpt: stripHtml(item.excerpt?.rendered),
      contentHtml: sanitizeAndRewrite(rawContent),
      modified: item.modified,
      date: item.date,
      parentPath: null,
      categoryIds: item.categories ?? [],
      featuredMediaId: item.featured_media || null,
      authorId: item.author ?? null,
    });
  }

  return { records, downloadLinks };
}

export function createCategories(items, language) {
  return items.map((item) => ({
    id: item.id,
    language,
    path: getPathFromUrl(item.link) ?? `/category/${item.slug}`,
    slug: decodeSegment(item.slug),
    name: htmlToText(item.name),
    count: item.count,
    parent: item.parent,
  }));
}

export const POSTS_PER_ARCHIVE_PAGE = 10;

/**
 * Build one record per archive page (10 posts each, matching WordPress),
 * so `/category/<slug>/page/2` style URLs keep working. Page 1 lives at
 * `basePath` itself.
 */
export function createArchivePageRecords({
  kind,
  wpId,
  language,
  basePath,
  title,
  posts,
}) {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / POSTS_PER_ARCHIVE_PAGE));
  const pageLabel = language === "th" ? "หน้า" : "Page";
  const records = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const pagePosts = sorted.slice(
      (page - 1) * POSTS_PER_ARCHIVE_PAGE,
      page * POSTS_PER_ARCHIVE_PAGE,
    );
    const listHtml = pagePosts
      .map((post) => {
        const dateText = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
          dateStyle: "medium",
        }).format(new Date(post.date));
        const excerptHtml = post.excerpt ? `<p>${post.excerpt}</p>` : "";
        return `<li><a href="${post.path}">${post.title}</a><time datetime="${post.date}">${dateText}</time>${excerptHtml}</li>`;
      })
      .join("");

    const pagerLinks = [];
    if (page > 1) {
      const previousPath = page === 2 ? basePath : `${basePath}/page/${page - 1}`;
      pagerLinks.push(
        `<a href="${previousPath}" rel="prev">${language === "th" ? "← หน้าก่อนหน้า" : "← Previous page"}</a>`,
      );
    }
    if (page < pageCount) {
      pagerLinks.push(
        `<a href="${basePath}/page/${page + 1}" rel="next">${language === "th" ? "หน้าถัดไป →" : "Next page →"}</a>`,
      );
    }
    const pagerHtml =
      pagerLinks.length > 0
        ? `<nav class="wp-import-pagination">${pagerLinks.join(" ")}</nav>`
        : "";

    const pagePath = page === 1 ? basePath : `${basePath}/page/${page}`;
    records.push({
      id: `${language}-${kind}-${wpId}${page === 1 ? "" : `-page-${page}`}`,
      wpId,
      language,
      kind,
      path: pagePath,
      sourceUrl: `${SOURCE_ORIGIN}${pagePath}`,
      title: page === 1 ? title : `${title} – ${pageLabel} ${page}`,
      excerpt: "",
      contentHtml: `<ul class="wp-import-list">${listHtml}</ul>${pagerHtml}`,
      modified: new Date().toISOString(),
      date: new Date().toISOString(),
      parentPath: page === 1 ? null : basePath,
      categoryIds: [],
      featuredMediaId: null,
    });
  }

  return records;
}

export function createCategoryRecords(categories, records, language) {
  return categories
    .filter((category) => category.language === language)
    .flatMap((category) => {
      const posts = records.filter(
        (record) =>
          record.language === language &&
          record.kind === "post" &&
          record.categoryIds.includes(category.id),
      );

      return createArchivePageRecords({
        kind: "category",
        wpId: category.id,
        language,
        basePath: category.path,
        title: category.name,
        posts,
      }).map((record) => ({ ...record, categoryIds: [category.id] }));
    });
}

export function createAuthorRecords(users, records, language) {
  return users.flatMap((user) => {
    const posts = records.filter(
      (record) =>
        record.language === language &&
        record.kind === "post" &&
        record.authorId === user.id,
    );

    const basePath = `${language === "en" ? "/en" : ""}/author/${decodeSegment(user.slug)}`;
    return createArchivePageRecords({
      kind: "author",
      wpId: user.id,
      language,
      basePath,
      title: user.name,
      posts,
    });
  });
}

export function createMediaAssets(items) {
  return items.map((item) => {
    const sourceUrl = item.source_url ?? "";
    return {
      id: item.id,
      sourceUrl,
      localPath: getPathFromUrl(sourceUrl) ?? sourceUrl,
      title: htmlToText(item.title?.rendered),
      alt: item.alt_text ?? "",
      width: item.media_details?.width ?? null,
      height: item.media_details?.height ?? null,
      mimeType: item.mime_type ?? "",
    };
  });
}

export function mediaUrlsFromItem(item) {
  const urls = new Set();
  if (item.source_url) {
    urls.add(item.source_url);
  }

  const sizes = item.media_details?.sizes;
  if (sizes && typeof sizes === "object") {
    for (const size of Object.values(sizes)) {
      if (size?.source_url) {
        urls.add(size.source_url);
      }
    }
  }

  return Array.from(urls);
}
