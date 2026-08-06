import { WORKOUTS } from "../lib/workouts.js";

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

function cleanText(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validateCustomWorkout(input) {
  if (!input || typeof input !== "object") {
    throw new Error("De eigen training ontbreekt.");
  }

  const date = cleanText(input.date, 10);
  const name = cleanText(input.name, 100);
  const uploadName = cleanText(input.uploadName || input.name, 120);
  const type = cleanText(input.type || "Run", 20);
  const description = cleanText(input.intervalsDescription, 5000);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("De datum van de training is ongeldig.");
  }
  if (!name) {
    throw new Error("De training heeft geen naam.");
  }
  if (!description) {
    throw new Error("De beschrijving van de training ontbreekt.");
  }

  if (["Core", "Mobility"].includes(type) && !description.includes("- ")) {
    throw new Error(
      "Core- en mobiliteitstrainingen moeten minimaal één oefening bevatten."
    );
  }

  if (type === "Run" && !description.includes("- ")) {
    throw new Error("De Intervals.icu-opbouw van de hardlooptraining is ongeldig.");
  }
  const allowedTypes = ["Run", "Core", "Mobility"];

  if (!allowedTypes.includes(type)) {
    throw new Error(
      "Alleen hardlopen, core en mobiliteit kunnen momenteel worden geëxporteerd."
    );
  }

  return {
    date,
    name,
    uploadName,
    type,
    intervalsDescription: description
  };
}


function intervalsEventType(type) {
  const mapping = {
    Run: "Run",
    Core: "WeightTraining",
    Mobility: "Yoga"
  };

  return mapping[type] || "Workout";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Alleen POST is toegestaan." });
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
      return sendJson(res, 400, { error: "De aanvraag bevat geen geldige JSON." });
    }
  }

  const workoutDate = requestBody?.workoutDate;
  const pin = requestBody?.pin;

  if (String(pin ?? "") !== String(appPin)) {
    return sendJson(res, 401, { error: "Onjuiste app-pincode." });
  }

  let workout;

  try {
    if (requestBody?.customWorkout) {
      workout = validateCustomWorkout(requestBody.customWorkout);
    } else {
      workout = WORKOUTS[workoutDate];
      if (!workout) {
        return sendJson(res, 400, {
          error: "Voor deze datum is geen uploadbare workout ingesteld."
        });
      }
    }
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  const event = [{
    category: "WORKOUT",
    start_date_local: `${workout.date}T00:00:00`,
    name: workout.uploadName || workout.name,
    description: workout.intervalsDescription,
    type: intervalsEventType(workout.type || "Run"),
    external_id: `jaco-performance-${workout.date}-${Date.now()}`
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
        error: `Intervals.icu weigerde de workout: ${apiMessage}`
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Training toegevoegd aan Intervals.icu.",
      workout: {
        date: workout.date,
        name: workout.uploadName || workout.name
      }
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: `De server kon Intervals.icu niet bereiken: ${error.message}`
    });
  }
}
