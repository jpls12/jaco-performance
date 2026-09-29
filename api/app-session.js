import { appSessionCookie, clearAppSessionCookie, createAppSession, validAppPin } from "./_app-auth.js";

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearAppSessionCookie());
    return sendJson(res, 200, { signedOut: true });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, DELETE");
    return sendJson(res, 405, { error: "Alleen POST en DELETE zijn toegestaan." });
  }
  if (!process.env.INTERVALS_API_KEY || !process.env.JACO_APP_PIN) {
    return sendJson(res, 500, { error: "API-configuratie ontbreekt." });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!validAppPin(body?.pin)) {
    return sendJson(res, 401, { error: "Onjuiste app-pincode." });
  }
  res.setHeader("Set-Cookie", appSessionCookie(createAppSession()));
  return sendJson(res, 200, { signedIn: true, expiresInDays: 30 });
}
