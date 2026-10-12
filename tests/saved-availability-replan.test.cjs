const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('saving availability uses the central coach and never a competing replanner',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const logic=app.slice(app.indexOf('function saveWeeklyAvailability('),app.indexOf('function availabilityPreferenceOptions('));
  assert.match(logic,/refreshDerivedCoachViews\(\)/);
  assert.doesNotMatch(logic,/replanSavedAvailabilityWeek/);
  const planner=fs.readFileSync('js/adaptive-week-replanner.js','utf8');
  assert.doesNotMatch(planner,/function replanSavedAvailabilityWeek/);
});
// Availability behaviour is exercised with the real sync + central planner in
// adaptive-integration.test.cjs (priority, no feasible slot, exported session).
