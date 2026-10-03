import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { scanWithClamAv } from "./clamav-scanner";

const originalHost = process.env.PR_CENTER_CLAMD_HOST;
const originalPort = process.env.PR_CENTER_CLAMD_PORT;
const servers: net.Server[] = [];

afterEach(async () => {
  if (originalHost === undefined) delete process.env.PR_CENTER_CLAMD_HOST;
  else process.env.PR_CENTER_CLAMD_HOST = originalHost;
  if (originalPort === undefined) delete process.env.PR_CENTER_CLAMD_PORT;
  else process.env.PR_CENTER_CLAMD_PORT = originalPort;
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function fakeClamd(reply: string) {
  let captured = Buffer.alloc(0);
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      captured = Buffer.concat([captured, data]);
      const commandEnd = captured.indexOf(0);
      if (commandEnd < 0) return;
      let offset = commandEnd + 1;
      while (captured.length >= offset + 4) {
        const size = captured.readUInt32BE(offset);
        offset += 4;
        if (size === 0) {
          socket.write(reply);
          return;
        }
        if (captured.length < offset + size) return;
        offset += size;
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");
  process.env.PR_CENTER_CLAMD_HOST = "127.0.0.1";
  process.env.PR_CENTER_CLAMD_PORT = String(address.port);
  return () => captured;
}

describe("ClamAV INSTREAM adapter", () => {
  it("returns CLEAN only when the scanner explicitly responds OK", async () => {
    const captured = await fakeClamd("stream: OK\0");
    const result = await scanWithClamAv(Buffer.from("harmless test content"));
    expect(result).toEqual({ status: "CLEAN", signature: null });
    expect(captured().includes(Buffer.from("zINSTREAM\0"))).toBe(true);
  });

  it("quarantines a positive malware signature", async () => {
    await fakeClamd("stream: Eicar-Test-Signature FOUND\0");
    await expect(scanWithClamAv(Buffer.from("test"))).resolves.toEqual({
      status: "QUARANTINED",
      signature: "Eicar-Test-Signature",
    });
  });

  it("fails closed when no scanner host is configured", async () => {
    delete process.env.PR_CENTER_CLAMD_HOST;
    await expect(scanWithClamAv(Buffer.from("test"))).rejects.toThrow(
      "ClamAV scanner is not configured",
    );
  });
});
