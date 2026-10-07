export async function verifyLandingPage(httpsUrl, page, fetchPage) {
  if (page.status === 200) return [page];

  const introUrl = new URL("/intro", httpsUrl);
  if (page.status !== 307 || page.headers.get("location") !== introUrl.href) {
    throw new Error(`expected HTTPS 200 or same-origin Intro 307, got ${page.status}`);
  }

  const intro = await fetchPage(introUrl, { redirect: "manual" });
  if (intro.status !== 200) {
    throw new Error(`Intro expected 200, got ${intro.status}`);
  }
  return [page, intro];
}
