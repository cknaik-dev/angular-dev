import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { PreviewPaneComponent } from '../preview-pane/preview-pane.component';
import { ProgressService } from '../../core/progress.service';

// A collapsible, editable Angular example: edit component.ts + component.html,
// press Run, and see it rendered by the mini Angular preview engine.
// Monaco + preview are created lazily (@defer) only when the example is opened.
@Component({
  selector: 'app-ng-runner',
  imports: [MonacoEditorComponent, PreviewPaneComponent],
  template: `
    <details class="runner" (toggle)="onToggle($event)">
      <summary class="runner-summary">Angular example — expand to run</summary>

      @defer (when opened()) {
        <p class="ng-label">component.ts</p>
        <app-monaco-editor
          class="ng-editor"
          [style.height.px]="heightFor(ts)"
          [value]="ts"
          language="typescript"
          [theme]="theme()"
          (valueChange)="ts = $event"
        />

        <p class="ng-label">component.html</p>
        <app-monaco-editor
          class="ng-editor"
          [style.height.px]="heightFor(html)"
          [value]="html"
          language="html"
          [theme]="theme()"
          (valueChange)="html = $event"
        />

        <div class="runner-bar">
          <button type="button" class="runner-run" (click)="run()">Run ▶</button>
          <button type="button" class="runner-reset" (click)="reset()">Reset</button>
          <span class="runner-hint">Edit the code, then press Run.</span>
        </div>

        <p class="ng-label">Live preview</p>
        <app-preview-pane
          [tsCode]="runTs()"
          [htmlCode]="runHtml()"
          [theme]="theme()"
          (renderError)="error.set($event)"
        />
        @if (error()) {
          <p class="ng-error">{{ error() }}</p>
        }
      } @placeholder {
        @if (opened()) {
          <p class="runner-hint" style="padding: 0.75rem">Loading editor…</p>
        }
      }
    </details>

    <!-- Shown only when printing, so examples appear in the PDF. -->
    <div class="runner-print">
      <p class="runner-print-label">component.ts</p>
      <pre>{{ ts }}</pre>
      <p class="runner-print-label">component.html</p>
      <pre>{{ html }}</pre>
    </div>
  `,
  styles: [
    `
      /* Theme tokens (--surface, --border, ...) cascade from app-root. */
      .runner {
        margin-top: 1rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        overflow: hidden;
      }

      .runner-summary {
        padding: 0.6rem 0.75rem;
        background: var(--surface-2);
        color: var(--text);
        font-weight: 600;
        cursor: pointer;
      }

      .runner[open] .runner-summary {
        border-bottom: 1px solid var(--border);
      }

      .ng-label {
        margin: 0;
        padding: 0.4rem 0.75rem;
        background: var(--surface-2);
        color: var(--text-muted);
        font-size: 0.78rem;
        font-family: 'JetBrains Mono', monospace;
        border-top: 1px solid var(--border);
      }

      .ng-editor {
        display: block;
        width: 100%;
      }

      .runner-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--surface-2);
        border-top: 1px solid var(--border);
      }

      .runner-run,
      .runner-reset {
        padding: 0.35rem 0.8rem;
        border-radius: 0.4rem;
        border: 1px solid var(--border);
        cursor: pointer;
        font-size: 0.85rem;
        transition: transform 80ms ease, filter 120ms ease;
      }

      .runner-run:hover,
      .runner-reset:hover {
        filter: brightness(1.15);
      }

      .runner-run:active,
      .runner-reset:active {
        transform: translateY(1px) scale(0.97);
        filter: brightness(0.9);
      }

      .runner-run {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-text);
      }

      .runner-reset {
        background: var(--surface);
        color: var(--text);
      }

      .runner-hint {
        color: var(--text-muted);
        font-size: 0.8rem;
      }

      app-preview-pane {
        display: block;
        padding: 0.75rem;
        background: var(--surface-2);
      }

      .ng-error {
        margin: 0;
        padding: 0.6rem 0.75rem;
        background: var(--surface-2);
        color: var(--danger);
        font-size: 0.85rem;
      }

      .runner-print {
        display: none;
      }

      @media print {
        .runner {
          display: none;
        }

        .runner-print {
          display: block;
          margin-top: 1rem;
          border: 1px solid #999;
          border-radius: 0.4rem;
          overflow: hidden;
        }

        .runner-print-label {
          margin: 0;
          padding: 0.3rem 0.6rem;
          background: #f0f0f0;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .runner-print pre {
          margin: 0;
          padding: 0.6rem;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .runner-print pre + .runner-print-label {
          border-top: 1px solid #999;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgRunnerComponent implements OnInit {
  @Input({ required: true }) initialTs = '';
  @Input({ required: true }) initialHtml = '';

  protected readonly theme = inject(ProgressService).theme;
  protected ts = '';
  protected html = '';
  protected readonly opened = signal(false);
  protected readonly runTs = signal('');
  protected readonly runHtml = signal('');
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.ts = this.initialTs;
    this.html = this.initialHtml;
    this.runTs.set(this.ts);
    this.runHtml.set(this.html);
  }

  protected heightFor(code: string): number {
    return Math.max(60, code.split('\n').length * 19 + 22);
  }

  protected onToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.opened.set(true);
    }
  }

  protected run(): void {
    this.error.set(null);
    this.runTs.set(this.ts);
    this.runHtml.set(this.html);
  }

  protected reset(): void {
    this.ts = this.initialTs;
    this.html = this.initialHtml;
    this.run();
  }
}
