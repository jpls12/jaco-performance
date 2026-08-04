const WORKOUTS = {
  "2026-08-04": {
    name: "Jaco - 5 x 1000 m VO2max",
    date: "2026-08-04",
    type: "Run",
    description: `5 km-specifieke VO2max-training.

Warmup
- 3km 5:00-5:30/km Pace

Strides 4x
- 100mtr 3:15-3:25/km Pace
- 100mtr Z1 Pace

VO2max 5x
- 1km 3:28-3:30/km Pace
- 2m Z1 Pace

Speed 4x
- 200mtr 3:05-3:10/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`
  },

  "2026-08-05": {
    name: "Jaco - Herstelloop 8 km",
    date: "2026-08-05",
    type: "Run",
    description: `Rustige herstelloop na de VO2max-training.

Easy
- 8km 5:05-5:25/km Pace`
  },

  "2026-08-06": {
    name: "Jaco - Easy plus strides",
    date: "2026-08-06",
    type: "Run",
    description: `Rustige duurloop met ontspannen strides indien fris.

Easy
- 10km 5:00-5:20/km Pace

Strides 6x
- 100mtr 3:15-3:25/km Pace
- 100mtr Z1 Pace`
  },

  "2026-08-07": {
    name: "Jaco - 12 x 400 m",
    date: "2026-08-07",
    type: "Run",
    description: `5 km-specifieke snelheidstraining.

Warmup
- 3km Z1 Pace

Main set 12x
- 400mtr 3:13-3:18/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`
  },

  "2026-08-08": {
    name: "Jaco - Lange duur 18 km",
    date: "2026-08-08",
    type: "Run",
    description: `Lange duurloop met gecontroleerde versnelling.

Easy
- 15km 4:55-5:20/km Pace

Progression
- 3km 4:00-4:10/km Pace`
  },

  "2026-08-09": {
    name: "Jaco - Herstel 8 km",
    date: "2026-08-09",
    type: "Run",
    description: `Zeer rustige herstelloop.

Recovery
- 8km 5:10-5:35/km Pace`
  }
};

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

  const event = [{
    category: "WORKOUT",
    start_date_local: `${workout.date}T00:00:00`,
    name: workout.name,
    description: workout.description,
    type: workout.type,
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
      console.error("Intervals.icu API error", {
        status: response.status,
        body: responseBody,
        workoutDate,
        description: workout.description
      });

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
        name: workout.name
      },
      result: responseBody
    });
  } catch (error) {
    console.error("Intervals.icu request failed", error);

    return sendJson(res, 500, {
      error: `De server kon Intervals.icu niet bereiken: ${error.message}`
    });
  }
}
