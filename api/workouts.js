import { getPublicWorkouts } from "../lib/workouts.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Alleen GET is toegestaan."
    });
  }

  return res.status(200).json({
    workouts: getPublicWorkouts()
  });
}
