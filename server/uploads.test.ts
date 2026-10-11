import express from "express";
import { createServer, type Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, destroySession } from "./auth-local";
import { COOKIE_NAME } from "../shared/const";
import { registerProductUploads } from "./uploads";

describe("authenticated product uploads", () => {
  let server: Server;
  let origin: string;
  let directory: string;
  let session: string;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "motoshop-upload-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    const app = express();
    app.use(express.json({ limit: "8mb" }));
    registerProductUploads(app);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    origin = `http://127.0.0.1:${address.port}`;
    session = createSession("test-admin");
  });
  afterAll(async () => {
    destroySession(session);
    await new Promise<void>(resolve => server.close(() => resolve()));
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=";
  async function upload(body: unknown, loggedIn = true) {
    return fetch(`${origin}/api/upload`, {
      method: "POST", headers: { "content-type": "application/json", ...(loggedIn ? { cookie: `${COOKIE_NAME}=${session}` } : {}) }, body: JSON.stringify(body),
    });
  }
  it("rejects requests without a session", async () => {
    expect((await upload({ image: png, filename: "photo.png" }, false)).status).toBe(401);
    expect((await fetch(`${origin}/uploads/products/no.png`)).status).toBe(401);
  });
  it("saves a valid image with a generated name and protects retrieval", async () => {
    const response = await upload({ image: png, filename: "../../photo.png" });
    expect(response.status).toBe(200);
    const { url } = await response.json();
    expect(url).toMatch(/^\/uploads\/products\/\d+-[a-f0-9]+\.png$/);
    expect((await fetch(origin + url, { headers: { cookie: `${COOKIE_NAME}=${session}` } })).status).toBe(200);
  });
  it("rejects disguised non-images and mismatched types", async () => {
    expect((await upload({ image: "data:image/png;base64,aGVsbG8=", filename: "photo.png" })).status).toBe(400);
    expect((await upload({ image: png, filename: "photo.jpg" })).status).toBe(400);
    expect((await upload({ image: {}, filename: "photo.png" })).status).toBe(400);
  });
});
