import { Injectable, signal } from '@angular/core';

// Shared open/closed state for the chapter sidebar on mobile, so the header
// (App) can toggle it while the sidebar lives in the chapter page.
@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((o) => !o);
  }

  close(): void {
    this.open.set(false);
  }
}
