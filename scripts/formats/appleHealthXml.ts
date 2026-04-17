import { createReadStream } from 'fs';
import sax from 'sax';
import { RunWorkout, toRunWorkout } from '../trackers/running';

// Apple Health exports workouts as:
//   <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
//            duration="30.5" durationUnit="min"
//            totalDistance="5.3" totalDistanceUnit="km"
//            sourceName="Apple Watch"
//            startDate="2026-04-16 07:12:00 -0700" .../>
// Older exports use attributes; newer ones may nest <WorkoutStatistics>.
// We only need the outer attributes for distance/duration.

export async function parseAppleHealthXml(path: string): Promise<RunWorkout[]> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true });
    const workouts: RunWorkout[] = [];

    parser.on('opentag', (node) => {
      if (node.name !== 'Workout') return;
      const a = node.attributes as Record<string, string>;
      if (a.workoutActivityType !== 'HKWorkoutActivityTypeRunning') return;

      const duration = parseFloat(a.duration || '0');
      const durationUnit = a.durationUnit || 'min';
      const durationSec = durationUnit === 's' ? duration : duration * 60;

      const distance = parseFloat(a.totalDistance || '0');
      const distanceUnit = (a.totalDistanceUnit || 'km').toLowerCase();
      let distanceKm = distance;
      if (distanceUnit === 'mi') distanceKm = distance * 1.609344;
      else if (distanceUnit === 'm') distanceKm = distance / 1000;

      if (!a.startDate) return;
      const startDate = normalizeAppleDate(a.startDate);

      workouts.push(
        toRunWorkout({
          startDate,
          durationSec,
          distanceKm,
          activityType: 'Running',
          source: a.sourceName || 'Apple Health',
        })
      );
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve(workouts));

    createReadStream(path).pipe(parser);
  });
}

// Apple uses "2026-04-16 07:12:00 -0700" — convert to RFC3339-ish.
function normalizeAppleDate(s: string): string {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})?$/);
  if (!m) return s;
  const [, date, time, offH, offM = '00'] = m;
  return `${date}T${time}${offH}:${offM}`;
}
