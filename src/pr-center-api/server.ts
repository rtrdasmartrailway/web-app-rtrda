import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Node's env-file parser accepts the securely managed file's whitespace format.
const entraEnvFile = process.env.ENTRA_ENV_FILE || "/srv/workspace/rtrda.env";
if (existsSync(entraEnvFile)) loadEnvFile(entraEnvFile);

async function main() {
  const [{ buildPrCenterApi }, { createEntraAuth }, { createEmailOnlyAuth }] =
    await Promise.all([
      import("./app"),
      import("./entra-auth"),
      import("./email-only-auth"),
    ]);
  const port = Number(process.env.PR_CENTER_API_PORT || 3100);
  const host = process.env.PR_CENTER_API_HOST || "127.0.0.1";
  const emailOnlyAuth = createEmailOnlyAuth();
  const entraAuth = createEntraAuth();
  const app = buildPrCenterApi(
    async (request) =>
      (await entraAuth?.resolve(request)) || emailOnlyAuth.resolve(request),
    emailOnlyAuth,
    entraAuth,
  );
  await app.listen({ host, port });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
