function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Alleen GET is toegestaan." });
  }

  const apiKey = process.env.INTERVALS_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "INTERVALS_API_KEY ontbreekt in Vercel."
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
    const response = await fetch(
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
    return sendJson(res, 500, {
      error: `De server kon Intervals.icu niet bereiken: ${error.message}`
    });
  }
}
