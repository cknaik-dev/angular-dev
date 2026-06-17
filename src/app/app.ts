import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  effect,
  inject
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ProgressService } from './core/progress.service';
import { PrintModeService } from './core/print-mode.service';
import { SidebarService } from './core/sidebar.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly progressService = inject(ProgressService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly printMode = inject(PrintModeService);

  @HostBinding('class.dark-theme') protected get isDarkThemeClass(): boolean {
    return this.theme() === 'dark';
  }

  protected readonly sidebar = inject(SidebarService);
  protected readonly theme = this.progressService.theme;

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.theme();
    });
  }

  protected toggleTheme(): void {
    this.progressService.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  // Print the chapter currently on screen (user can Save as PDF).
  protected printCurrent(): void {
    // Expand any collapsed "Advanced" sections so they're included.
    this.document
      .querySelectorAll<HTMLDetailsElement>('details.chapter-advanced')
      .forEach((details) => (details.open = true));

    // Render example outputs for print, give them a moment, then print.
    this.printMode.enabled.set(true);
    setTimeout(() => {
      window.print();
      this.printMode.enabled.set(false);
    }, 500);
  }

  // Open the full-course view, which loads every chapter and prints them.
  protected printAll(): void {
    this.router.navigate(['/print']);
  }
}
