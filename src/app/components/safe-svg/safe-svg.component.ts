import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  inject
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Renders an inline SVG string. Angular's HTML sanitizer strips <svg>,
// so we mark trusted markup explicitly. Content comes from our own
// chapter JSON, not user input, so this is safe.
@Component({
  selector: 'app-safe-svg',
  template: `<div class="safe-svg" [innerHTML]="safe"></div>`,
  styles: [
    `
      .safe-svg {
        margin-top: 1rem;
        text-align: center;
      }

      :host ::ng-deep svg {
        display: block;
        width: 100%;
        max-width: 460px;
        height: auto;
        margin: 0 auto;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SafeSvgComponent implements OnChanges {
  @Input({ required: true }) svg = '';

  private readonly sanitizer = inject(DomSanitizer);
  protected safe?: SafeHtml;

  ngOnChanges(): void {
    this.safe = this.sanitizer.bypassSecurityTrustHtml(this.svg);
  }
}
