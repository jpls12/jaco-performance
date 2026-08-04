const WORKOUTS = {
  "2026-08-04": {
    name: "Jaco - 5 x 1000 m VO2max",
    date: "2026-08-04",
    type: "Run",
    description: `5 km-specifieke VO2max-training.
description: `# VO₂max 5 × 1000 m

## Warm-up
- Run 3.0 km easy
- Repeat 4x
  - Run 100 m fast
  - Run 100 m easy

## Main Set
Repeat 5x
- Run 1000 m @ 3:28-3:30/km
- Run 2:00 easy

## Speed
Repeat 4x
- Run 200 m fast
- Run 200 m easy

## Cool-down
- Run 2.0 km easy

Totale afstand: ongeveer 14 km`

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
- 100m 3:15-3:25/km Pace
- 100m Z1 Pace`
  },
  "2026-08-07": {
    name: "Jaco - 12 x 400 m",
    date: "2026-08-07",
    type: "Run",
    description: `5 km-specifieke snelheidstraining.

Warmup
- 3km Z1 Pace

Main set 12x
- 400m 3:13-3:18/km Pace
- 200m Z1 Pace

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
    return res.status(405).json({ error: "Alleen POST is toegestaan." });
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
    return res.status(401).json({ error: "Onjuiste app-pincode." });
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
      "https://intervals.icu/api/v1/athlete/0/events/bulk",
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
    return res.status(500).json({
      error: "De server kon Intervals.icu niet bereiken."
    });
  }
}
