import net from "node:net";

export type ClamAvScanResult =
  | { status: "CLEAN"; signature: null }
  | { status: "QUARANTINED"; signature: string };

export class ClamAvUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClamAvUnavailableError";
  }
}

function scannerConfig() {
  const host = process.env.PR_CENTER_CLAMD_HOST?.trim();
  const port = Number(process.env.PR_CENTER_CLAMD_PORT || "3310");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new ClamAvUnavailableError("ClamAV scanner is not configured");
  return { host, port };
}

function writePacket(socket: net.Socket, packet: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off("drain", onDrain);
      reject(error);
    };
    const onDrain = () => {
      socket.off("error", onError);
      resolve();
    };
    socket.once("error", onError);
    if (socket.write(packet)) {
      socket.off("error", onError);
      resolve();
    } else {
      socket.once("drain", onDrain);
    }
  });
}

export async function scanWithClamAv(
  content: Buffer,
  timeoutMs = 60_000,
): Promise<ClamAvScanResult> {
  if (!Buffer.isBuffer(content) || content.length === 0)
    throw new TypeError("Scanner requires a non-empty Buffer");
  const { host, port } = scannerConfig();

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error, result?: ClamAvScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new ClamAvUnavailableError("ClamAV returned an empty response"));
    };
    socket.setTimeout(timeoutMs, () =>
      finish(new ClamAvUnavailableError("ClamAV scan timed out")),
    );
    socket.once("error", (error) =>
      finish(new ClamAvUnavailableError(`ClamAV connection failed: ${error.message}`)),
    );
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      const response = Buffer.concat(chunks).toString("utf8");
      const end = response.search(/[\r\n\0]/);
      if (end < 0) return;
      const line = response.slice(0, end);
      if (line.endsWith(": OK")) {
        finish(undefined, { status: "CLEAN", signature: null });
      } else if (line.includes(" FOUND")) {
        finish(undefined, {
          status: "QUARANTINED",
          signature: line
            .slice(line.indexOf(":") + 1)
            .replace(/\s+FOUND$/, "")
            .trim(),
        });
      } else {
        finish(new ClamAvUnavailableError("ClamAV scan could not complete"));
      }
    });
    socket.once("connect", () => {
      void (async () => {
        try {
          await writePacket(socket, Buffer.from("zINSTREAM\0", "ascii"));
          const chunkSize = 64 * 1024;
          for (let offset = 0; offset < content.length; offset += chunkSize) {
            const chunk = content.subarray(
              offset,
              Math.min(offset + chunkSize, content.length),
            );
            const header = Buffer.allocUnsafe(4);
            header.writeUInt32BE(chunk.length);
            await writePacket(socket, Buffer.concat([header, chunk]));
          }
          await writePacket(socket, Buffer.alloc(4));
        } catch (error) {
          finish(
            error instanceof Error
              ? new ClamAvUnavailableError(`ClamAV scan failed: ${error.message}`)
              : new ClamAvUnavailableError("ClamAV scan failed"),
          );
        }
      })();
    });
  });
}

export async function isClamAvAvailable(timeoutMs = 5_000): Promise<boolean> {
  try {
    const result = await scanWithClamAv(
      Buffer.from("PR Center scanner readiness probe"),
      timeoutMs,
    );
    return result.status === "CLEAN";
  } catch {
    return false;
  }
}
