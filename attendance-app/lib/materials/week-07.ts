import { createDecipheriv } from "node:crypto";
import encrypted from "../../private-materials/week-07.encrypted.json";

export const privateMaterialNames = [
  "ushtrimet.html", "prezantimi-ushtrimeve.html", "java-07-model.md",
  "week-07.css", "week-07.js", "week-07-model.mjs",
  "ushtrimet-07-kontrolli-mvp-rideshare-2026.pptx",
] as const;

type Envelope = { iv: string; tag: string; data: string };

export function decryptMaterialBundle(envelope: Envelope, key: string) {
  if (!/^[a-f\d]{64}$/i.test(key)) throw new Error("Private materials are unavailable");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(Buffer.from("mobile-2026-2027/week-07/private-materials/v1"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, { mime: string; data: string }>;
}

export function readPrivateMaterial(name: string) {
  if (!(privateMaterialNames as readonly string[]).includes(name)) return null;
  const key = process.env.MOBILE_MATERIALS_KEY;
  if (!key) throw new Error("Private materials are unavailable");
  const files = decryptMaterialBundle(encrypted, key);
  const file = files[name];
  if (!file) return null;
  return { mime: file.mime, bytes: Buffer.from(file.data, "base64") };
}
