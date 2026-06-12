import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  effect,
  inject
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProgressService } from './core/progress.service';

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

  @HostBinding('class.dark-theme') protected get isDarkThemeClass(): boolean {
    return this.theme() === 'dark';
  }

  protected readonly theme = this.progressService.theme;

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.theme();
    });
  }

  protected toggleTheme(): void {
    this.progressService.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  protected printChapter(): void {
    window.print();
  }
}
