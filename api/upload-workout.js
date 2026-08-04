import { WORKOUTS } from "../lib/workouts.js";

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, {
      error: "Alleen POST is toegestaan."
    });
  }

  const apiKey = process.env.INTERVALS_API_KEY;
  const appPin = process.env.JACO_APP_PIN;

  if (!apiKey || !appPin) {
    return sendJson(res, 500, {
      error: "INTERVALS_API_KEY of JACO_APP_PIN ontbreekt in Vercel."
    });
  }

  let requestBody = req.body;

  if (typeof requestBody === "string") {
    try {
      requestBody = JSON.parse(requestBody);
    } catch {
      return sendJson(res, 400, {
        error: "De aanvraag bevat geen geldige JSON."
      });
    }
  }

  const workoutDate = requestBody?.workoutDate;
  const pin = requestBody?.pin;

  if (String(pin ?? "") !== String(appPin)) {
    return sendJson(res, 401, {
      error: "Onjuiste app-pincode."
    });
  }

  const workout = WORKOUTS[workoutDate];

  if (!workout) {
    return sendJson(res, 400, {
      error: "Voor deze datum is geen uploadbare workout ingesteld."
    });
  }

  if (!workout.intervalsDescription) {
    return sendJson(res, 400, {
      error: "Deze training heeft geen Intervals.icu-beschrijving."
    });
  }

  const event = [{
    category: "WORKOUT",
    start_date_local: `${workout.date}T00:00:00`,
    name: workout.uploadName || workout.name,
    description: workout.intervalsDescription,
    type: workout.type || "Run",
    external_id: `jaco-performance-${workout.date}`
  }];

  const authorization = Buffer
    .from(`API_KEY:${apiKey}`, "utf8")
    .toString("base64");

  try {
    const response = await fetch(
      "https://intervals.icu/api/v1/athlete/0/events/bulk",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(event)
      }
    );

    const responseText = await response.text();
    let responseBody;

    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = { raw: responseText };
    }

    if (!response.ok) {
      const apiMessage =
        responseBody?.message ||
        responseBody?.error ||
        responseBody?.raw ||
        `HTTP ${response.status}`;

      return sendJson(res, 502, {
        error: `Intervals.icu weigerde de workout: ${apiMessage}`,
        status: response.status
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Workout toegevoegd aan Intervals.icu.",
      workout: {
        date: workout.date,
        name: workout.uploadName || workout.name
      },
      result: responseBody
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: `De server kon Intervals.icu niet bereiken: ${error.message}`
    });
  }
}
