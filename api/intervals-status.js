function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

const AMSTERDAM_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function isoDate(date) {
  const parts = Object.fromEntries(
    AMSTERDAM_DATE_FORMATTER
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Alleen GET is toegestaan." });
  }

  const apiKey = process.env.INTERVALS_API_KEY;
  const appPin = process.env.JACO_APP_PIN;

  if (!apiKey || !appPin) {
    return sendJson(res, 500, {
      error: "INTERVALS_API_KEY of JACO_APP_PIN ontbreekt in Vercel."
    });
  }

  const providedPin = req.headers["x-jaco-pin"];
  if (String(providedPin ?? "") !== String(appPin)) {
    return sendJson(res, 401, {
      error: "App-pincode is nodig voor persoonlijke wellnessdata."
    });
  }

  const newest = new Date();
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - 42);

  const params = new URLSearchParams({
    oldest: isoDate(oldest),
    newest: isoDate(newest),
    cols: [
      "ctl",
      "atl",
      "rampRate",
      "ctlLoad",
      "atlLoad",
      "hrv",
      "hrvSDNN",
      "readiness",
      "restingHR",
      "sleepSecs",
      "sleepScore",
      "sleepQuality",
      "avgSleepingHR",
      "fatigue",
      "soreness",
      "stress",
      "mood",
      "motivation",
      "Run_eftp",
      "vo2max"
    ].join(",")
  });

  const authorization = Buffer
    .from(`API_KEY:${apiKey}`, "utf8")
    .toString("base64");

  try {
    const response = await fetchWithTimeout(
      `https://intervals.icu/api/v1/athlete/0/wellness?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${authorization}`,
          Accept: "application/json"
        }
      }
    );

    const text = await response.text();
    let body;

    try {
      body = text ? JSON.parse(text) : [];
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      const message =
        body?.message ||
        body?.error ||
        body?.raw ||
        `HTTP ${response.status}`;

      return sendJson(res, 502, {
        error: `Intervals.icu weigerde de aanvraag: ${message}`
      });
    }

    const records = Array.isArray(body) ? body : [];
    records.sort((a, b) =>
      String(a.id || a.date || "").localeCompare(String(b.id || b.date || ""))
    );

    return sendJson(res, 200, {
      ok: true,
      oldest: isoDate(oldest),
      newest: isoDate(newest),
      latest: records[records.length - 1] || null,
      records
    });
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "de aanvraag duurde te lang"
        : error.message;

    return sendJson(res, 500, {
      error: `De server kon Intervals.icu niet bereiken: ${message}`
    });
  }
}
