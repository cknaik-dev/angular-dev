import { Injectable, signal } from '@angular/core';

// Turned on only while a print is being prepared. Runners watch it and
// render their default output into a print-only area, so examples appear
// (with output) in the PDF even when the learner hasn't expanded them.
// Kept off during normal use so example timers / fetches don't run on load.
@Injectable({ providedIn: 'root' })
export class PrintModeService {
  readonly enabled = signal(false);
}
