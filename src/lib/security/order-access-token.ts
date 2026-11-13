import { createHash } from "node:crypto";

export function hashOrderAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
