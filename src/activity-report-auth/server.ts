import { activitySettings, buildActivityAuthApi, createActivityAuth } from "./auth";
const settings = activitySettings();
if (!settings) {
  console.error("Activity OIDC configuration unavailable");
  process.exit(1);
}
void buildActivityAuthApi(createActivityAuth(settings))
  .listen({
    host: process.env.ACTIVITY_AUTH_HOST || "127.0.0.1",
    port: Number(process.env.ACTIVITY_AUTH_PORT || 3101),
  })
  .catch(() => {
    console.error("Activity auth service unavailable");
    process.exit(1);
  });
