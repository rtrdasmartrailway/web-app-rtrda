export const RECAPTCHA_DOWNLOAD_ACTION = "download_document";
export const RECAPTCHA_PREVIEW_ACTION = "preview_document";

interface RecaptchaResponse {
  action?: string;
  hostname?: string;
  score?: number;
  success?: boolean;
}

function expectedHostname(): string | null {
  try {
    return new URL(process.env.SITE_ORIGIN ?? "https://test.rtrda.or.th").hostname;
  } catch {
    return null;
  }
}

export async function verifyRecaptcha(
  token: string,
  action: string,
  options: {
    fetchFn?: typeof fetch;
    hostname?: string | null;
    secret?: string;
  } = {},
): Promise<boolean> {
  const secret = options.secret ?? process.env.RECAPTCHA_SECRET_KEY;
  const hostname = options.hostname ?? expectedHostname();
  if (!secret || !hostname || !token) return false;

  try {
    const response = await (options.fetchFn ?? fetch)(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ response: token, secret }),
      },
    );
    if (!response.ok) return false;

    const result = (await response.json()) as RecaptchaResponse;
    return (
      result.success === true &&
      result.action === action &&
      result.hostname === hostname &&
      typeof result.score === "number" &&
      result.score >= 0.5
    );
  } catch {
    return false;
  }
}
