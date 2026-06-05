import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { PreviewSnapshot } from '../../models/lesson';
import { PreviewEngine } from '../../preview/preview-engine';

@Component({
  selector: 'app-preview-pane',
  imports: [CommonModule],
  template: `
    <div class="preview-shell" [class.light]="theme === 'light'">
      <div #previewHost class="preview-host"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 26rem;
      }

      .preview-shell {
        height: 100%;
        overflow: auto;
        border-radius: 1rem;
        border: 1px solid rgba(145, 179, 255, 0.16);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent),
          rgba(6, 14, 26, 0.7);
      }

      .preview-shell.light {
        background:
          linear-gradient(180deg, rgba(0, 104, 255, 0.04), transparent),
          rgba(255, 255, 255, 0.96);
      }

      .preview-host {
        min-height: 100%;
        padding: 1.25rem;
        color: inherit;
        font-family: 'Space Grotesk', sans-serif;
      }

      .preview-host :is(h1, h2, h3, h4, h5, h6) {
        letter-spacing: -0.04em;
      }

      .preview-host button,
      .preview-host input {
        font: inherit;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreviewPaneComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) tsCode = '';
  @Input({ required: true }) htmlCode = '';
  @Input({ required: true }) theme: 'dark' | 'light' = 'dark';
  @Output() readonly snapshotChange = new EventEmitter<PreviewSnapshot>();
  @Output() readonly renderError = new EventEmitter<string | null>();
  @ViewChild('previewHost') private readonly previewHost?: ElementRef<HTMLElement>;

  private readonly previewEngine = new PreviewEngine();

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.previewHost) {
      return;
    }

    if (changes['tsCode'] || changes['htmlCode']) {
      this.render();
    }
  }

  private render(): void {
    if (!this.previewHost) {
      return;
    }

    try {
      this.previewEngine.render(
        this.previewHost.nativeElement,
        this.tsCode,
        this.htmlCode,
        (snapshot) => this.snapshotChange.emit(snapshot)
      );
      this.renderError.emit(null);
    } catch (error) {
      this.previewHost.nativeElement.innerHTML = '';
      this.renderError.emit(error instanceof Error ? error.message : 'Preview render failed.');
    }
  }
}
