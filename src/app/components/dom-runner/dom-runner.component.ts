import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { ProgressService } from '../../core/progress.service';

// A collapsible "edit and run" box for raw HTML/JS examples.
// Uses the Monaco editor (created lazily on expand, so many runners on one
// page don't all spin up editors). Code runs in a sandboxed iframe.
@Component({
  selector: 'app-dom-runner',
  imports: [MonacoEditorComponent],
  template: `
    <details class="runner" (toggle)="onToggle($event)">
      <summary class="runner-summary">Example — expand to run</summary>

      @defer (when opened()) {
        <app-monaco-editor
          class="runner-editor"
          [style.height.px]="editorHeight"
          [value]="code"
          language="html"
          [theme]="theme()"
          (valueChange)="code = $event"
        />
        <div class="runner-bar">
          <button type="button" class="runner-run" (click)="run()">Run ▶</button>
          <button type="button" class="runner-reset" (click)="reset()">Reset</button>
          <span class="runner-hint">Edit the code, then press Run.</span>
        </div>
        <iframe
          #frame
          class="runner-frame"
          title="Example output"
          scrolling="no"
          sandbox="allow-scripts"
          [style.height.px]="outputHeight()"
        ></iframe>
      } @placeholder {
        @if (opened()) {
          <p class="runner-hint" style="padding: 0.75rem">Loading editor…</p>
        }
      }
    </details>
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

      .runner-editor {
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
        border-bottom: 1px solid var(--border);
      }

      .runner-run,
      .runner-reset {
        padding: 0.35rem 0.8rem;
        border-radius: 0.4rem;
        border: 1px solid var(--border);
        cursor: pointer;
        font-size: 0.85rem;
        transition: transform 80ms ease, filter 120ms ease, background 120ms ease;
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

      .runner-run:focus-visible,
      .runner-reset:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
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

      .runner-frame {
        display: block;
        width: 100%;
        border: 0;
        overflow: hidden;
        background: #fff;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DomRunnerComponent implements OnInit {
  @Input({ required: true }) initialCode = '';
  @Input() rows = 8;
  @ViewChild('frame') private readonly frame?: ElementRef<HTMLIFrameElement>;

  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ProgressService).theme;
  protected code = '';
  protected readonly opened = signal(false);
  protected readonly outputHeight = signal(40);

  // Size the editor to the example length (Monaco line ≈ 19px + padding).
  protected get editorHeight(): number {
    return this.rows * 19 + 28;
  }

  constructor() {
    // Re-render the output when the theme changes so it matches light/dark.
    effect(() => {
      this.theme();
      if (this.opened()) {
        this.run();
      }
    });
  }

  ngOnInit(): void {
    this.code = this.initialCode;

    // The sandboxed iframe reports its content height via postMessage,
    // so we can size it exactly and avoid an inner scrollbar.
    const onMessage = (event: MessageEvent) => {
      if (
        this.frame &&
        event.source === this.frame.nativeElement.contentWindow &&
        event.data?.__runnerHeight
      ) {
        this.outputHeight.set(Math.ceil(event.data.__runnerHeight));
      }
    };
    window.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', onMessage));
  }

  // Create the editor + iframe only when the example is first expanded.
  protected onToggle(event: Event): void {
    const isOpen = (event.target as HTMLDetailsElement).open;
    if (isOpen) {
      this.opened.set(true);
      // The @defer chunk loads asynchronously; retry until the iframe exists.
      this.tryRun();
    }
  }

  private tryRun(attempts = 0): void {
    if (this.frame) {
      this.run();
    } else if (attempts < 40) {
      setTimeout(() => this.tryRun(attempts + 1), 50);
    }
  }

  protected run(): void {
    if (this.frame) {
      this.frame.nativeElement.srcdoc = this.wrap(this.code);
    }
  }

  protected reset(): void {
    this.code = this.initialCode;
    this.run();
  }

  private wrap(snippet: string): string {
    const resize = `<script>(function(){
      function post(){var b=document.body,h=document.documentElement;
        parent.postMessage({__runnerHeight:Math.max(b.scrollHeight,h.scrollHeight)},'*');}
      window.addEventListener('load',post);
      if(window.ResizeObserver){new ResizeObserver(post).observe(document.documentElement);}
      setTimeout(post,0);
    })();<\/script>`;
    const dark = this.theme() === 'dark';
    const bg = dark ? '#0f1722' : '#ffffff';
    const fg = dark ? '#e6edf6' : '#16202e';
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body { margin: 0; }
      body { font-family: system-ui, sans-serif; padding: 12px; background: ${bg}; color: ${fg}; }
      button, input { font: inherit; padding: 0.4rem 0.6rem; }
    </style></head><body>${snippet}${resize}</body></html>`;
  }
}
