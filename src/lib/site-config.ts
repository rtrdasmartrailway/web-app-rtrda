/**
 * Public origin the site is served from. Used for canonical URLs in
 * metadata, the sitemap, and robots.txt. Override per environment via the
 * SITE_ORIGIN environment variable (set in docker-compose.yml for the test
 * deployment; change it when promoting to production).
 */
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://test.rtrda.or.th";
