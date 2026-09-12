import { buildPrCenterApi } from "./app";
import { createEmailOnlyAuth } from "./email-only-auth";

const port = Number(process.env.PR_CENTER_API_PORT || 3100);
const host = process.env.PR_CENTER_API_HOST || "127.0.0.1";

const emailOnlyAuth = createEmailOnlyAuth();
const app = buildPrCenterApi(emailOnlyAuth.resolve, emailOnlyAuth);

app.listen({ host, port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
