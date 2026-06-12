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
      }

      .preview-shell {
        min-height: 3rem;
        overflow: auto;
        border-radius: 0.5rem;
        border: 1px solid #2a3a50;
        background: #0f1722;
        color: #e6edf6;
      }

      .preview-shell.light {
        border-color: #d4dbe6;
        background: #ffffff;
        color: #16202e;
      }

      .preview-host {
        min-height: 100%;
        padding: 1.25rem;
        color: inherit;
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
