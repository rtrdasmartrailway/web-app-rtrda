import { buildPrCenterApi } from "./app";

const port = Number(process.env.PR_CENTER_API_PORT || 3100);
const host = process.env.PR_CENTER_API_HOST || "127.0.0.1";

// OIDC is intentionally fail-closed until Entra application settings are provisioned.
const app = buildPrCenterApi(async () => null);

app.listen({ host, port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
