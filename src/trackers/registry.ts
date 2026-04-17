import { Tracker } from './Tracker';
import { runningTracker } from './running';

// Add new trackers here as they ship.
export const trackers: Tracker<unknown>[] = [runningTracker as Tracker<unknown>];
