export const WORKOUTS = {
  "2026-08-04": {
    name: "5 × 1000 m VO₂max",
    uploadName: "Jaco - 5 x 1000 m VO2max",
    date: "2026-08-04",
    type: "Run",
    distanceKm: 14,
    rpe: "8/10",
    status: "planned",
    displaySteps: [
      "3 km rustig inlopen",
      "4 × 100 m versnellen, 100 m herstel",
      "5 × 1000 m @ 3:28–3:30/km, 2 min dribbel",
      "4 × 200 m soepel snel, 200 m herstel",
      "2 km rustig uitlopen"
    ],
    intervalsDescription: `5 km-specifieke VO2max-training.

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
    name: "Herstelloop",
    uploadName: "Jaco - Herstelloop 8 km",
    date: "2026-08-05",
    type: "Run",
    distanceKm: 8,
    rpe: "2–3/10",
    status: "planned",
    displaySteps: [
      "8 km rustig @ 5:05–5:25/km",
      "Hartslag onder 145 bpm",
      "Geen strides als de benen zwaar zijn"
    ],
    intervalsDescription: `Rustige herstelloop.

Easy
- 8km 5:05-5:25/km Pace`
  },

  "2026-08-07": {
    name: "12 × 400 m",
    uploadName: "Jaco - 12 x 400 m",
    date: "2026-08-07",
    type: "Run",
    distanceKm: 12.2,
    rpe: "8/10",
    status: "planned",
    displaySteps: [
      "3 km inlopen",
      "12 × 400 m in 77–79 sec",
      "200 m dribbel",
      "2 km uitlopen"
    ],
    intervalsDescription: `5 km-specifieke snelheidstraining.

Warmup
- 3km Z1 Pace

Main set 12x
- 400mtr 3:13-3:18/km Pace
- 200mtr Z1 Pace

Cooldown
- 2km Z1 Pace`
  }
};

export function getPublicWorkouts() {
  return Object.fromEntries(
    Object.entries(WORKOUTS).map(([date, workout]) => [
      date,
      {
        name: workout.name,
        date: workout.date,
        type: workout.type,
        distanceKm: workout.distanceKm,
        rpe: workout.rpe,
        status: workout.status,
        displaySteps: workout.displaySteps
      }
    ])
  );
}
