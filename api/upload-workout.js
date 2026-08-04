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
- 1000mtr 3:28-3:30/km Pace
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Alleen POST is toegestaan."
    });
  }

  const apiKey = process.env.INTERVALS_API_KEY;
  const appPin = process.env.JACO_APP_PIN;

  if (!apiKey || !appPin) {
    return res.status(500).json({
      error: "INTERVALS_API_KEY of JACO_APP_PIN ontbreekt in Vercel."
    });
  }

  const { workoutDate, pin } = req.body || {};

  if (String(pin || "") !== String(appPin)) {
    return res.status(401).json({
      error: "Onjuiste app-pincode."
    });
  }

  const workout = WORKOUTS[workoutDate];

  if (!workout) {
    return res.status(400).json({
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
    .from(`API_KEY:${apiKey}`)
    .toString("base64");

  try {
    const response = await fetch(
      "https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true&upsertOnUid=false",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authorization}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(event)
      }
    );

    const text = await response.text();
    let body = {};

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      console.error("Intervals.icu error:", response.status, body);

      return res.status(502).json({
        error: `Intervals.icu gaf fout ${response.status}.`,
        details: body
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Workout toegevoegd aan Intervals.icu.",
      result: body
    });
  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      error: "De server kon Intervals.icu niet bereiken."
    });
  }
}
