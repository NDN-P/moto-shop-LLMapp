import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Express, type RequestHandler } from "express";
import { getLocalUserFromRequest } from "./auth-local";

const requireLogin: RequestHandler = (req, res, next) => {
  if (!getLocalUserFromRequest(req)) {
    res.status(401).json({ error: "Login required" });
    return;
  }
  next();
};

export function registerProductUploads(app: Express) {
  const uploadDirectory = path.resolve(process.cwd(), "uploads", "products");
  app.post("/api/upload", requireLogin, (req, res) => {
    const { image, filename } = req.body ?? {};
    if (typeof image !== "string" || typeof filename !== "string") {
      res.status(400).json({ error: "Supply an image and filename" });
      return;
    }
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    const extension = path.extname(filename).toLowerCase();
    const extensions: Record<string, string[]> = { png: [".png"], jpeg: [".jpg", ".jpeg"], webp: [".webp"] };
    if (!match || !extensions[match[1]].includes(extension)) {
      res.status(400).json({ error: "Use a PNG, JPEG, or WebP image matching the filename" });
      return;
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Images must be at most 5 MB" });
      return;
    }
    const valid = match[1] === "png"
      ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg"
        ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
    if (!valid) {
      res.status(400).json({ error: "The file is not a supported image" });
      return;
    }
    try {
      fs.mkdirSync(uploadDirectory, { recursive: true });
      const savedName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
      fs.writeFileSync(path.join(uploadDirectory, savedName), buffer, { flag: "wx" });
      res.json({ url: `/uploads/products/${savedName}` });
    } catch {
      res.status(500).json({ error: "Unable to save image" });
    }
  });
  app.use("/uploads", requireLogin, express.static(path.resolve(process.cwd(), "uploads"), { dotfiles: "deny" }));
}
