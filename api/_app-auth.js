import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "jaco_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function signingKey() {
  const apiKey = process.env.INTERVALS_API_KEY;
  const pin = process.env.JACO_APP_PIN;
  if (!apiKey || !pin) return null;
  return createHmac("sha256", apiKey).update(`jaco-session-v1:${pin}`).digest();
}

function signature(payload, key) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function validAppPin(pin) {
  const expected = process.env.JACO_APP_PIN;
  if (!expected || typeof pin !== "string") return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAppSession() {
  const key = signingKey();
  if (!key) throw new Error("API-configuratie ontbreekt.");
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${signature(payload, key)}`;
}

export function appSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Max-Age=${SESSION_SECONDS}; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAppSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}

export function validAppSession(req) {
  const raw = String(req.headers?.cookie ?? "");
  const value = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  if (!value) return false;
  const token = value.slice(COOKIE_NAME.length + 1);
  const match = /^(\d{10})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expiry = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiry <= now || expiry > now + SESSION_SECONDS) return false;
  const key = signingKey();
  if (!key) return false;
  const expected = Buffer.from(signature(`${match[1]}.${match[2]}`, key));
  const provided = Buffer.from(match[3]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function authorizedAppRequest(req, fallbackPin) {
  return validAppSession(req) || validAppPin(req.headers?.["x-jaco-pin"] ?? fallbackPin);
}
