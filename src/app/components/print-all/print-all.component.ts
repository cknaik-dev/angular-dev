import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { DOCUMENT, Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ChapterRepositoryService } from '../../core/chapter-repository.service';
import { PrintModeService } from '../../core/print-mode.service';
import { ChapterDefinition } from '../../models/chapter';
import { ChapterArticleComponent } from '../chapter-article/chapter-article.component';

// One-time generator: loads every chapter, renders the real styled content,
// and produces a single PDF with html2pdf. Save the result as
// public/course.pdf — the header "Download PDF" button serves that file.
@Component({
  selector: 'app-print-all',
  imports: [ChapterArticleComponent],
  template: `
    <div class="print-toolbar">
      <button type="button" (click)="back()">← Back</button>
      <button type="button" (click)="generate()" [disabled]="loading() || busy()">
        {{ busy() ? 'Generating…' : 'Download PDF' }}
      </button>
      <span class="print-status">
        {{ loading() ? 'Loading chapters…' : chapters().length + ' chapters ready' }}
      </span>
    </div>

    <div #doc class="pdf-doc">
      <section class="pdf-cover">
        <h1>Angular Learning</h1>
        <p class="pdf-subtitle">A beginner-friendly path from JavaScript to Angular</p>
        <p class="pdf-meta">{{ chapters().length }} chapters</p>
      </section>

      <section class="pdf-toc">
        <h2>Contents</h2>
        @for (group of toc(); track group.name) {
          <p class="toc-group">{{ group.name }}</p>
          <ul>
            @for (ch of group.items; track ch.id) {
              <li><span class="toc-num">{{ ch.number }}</span><span>{{ ch.title }}</span></li>
            }
          </ul>
        }
      </section>

      @for (chapter of chapters(); track chapter.id) {
        <app-chapter-article class="print-chapter" [chapter]="chapter" />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 860px;
        margin: 0 auto;
        padding: 1.5rem;
      }

      .print-toolbar {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 1.5rem;
      }

      .print-toolbar button {
        padding: 0.5rem 0.9rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
      }

      .print-status {
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .pdf-cover {
        text-align: center;
        padding: 5rem 0 3rem;
      }

      .pdf-cover h1 {
        margin: 0;
        font-size: 2.6rem;
      }

      .pdf-subtitle {
        margin: 0.75rem 0 0;
        color: var(--text-muted);
        font-size: 1.1rem;
      }

      .pdf-meta {
        margin: 0.5rem 0 0;
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .pdf-toc h2 {
        margin: 0 0 1rem;
        font-size: 1.8rem;
      }

      .pdf-toc .toc-group {
        margin: 1.3rem 0 0.4rem;
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .pdf-toc ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .pdf-toc li {
        display: flex;
        gap: 0.7rem;
        padding: 0.3rem 0;
        border-bottom: 1px solid var(--border);
        font-size: 1rem;
      }

      .toc-num {
        min-width: 1.7rem;
        color: var(--text-muted);
        text-align: right;
      }

      @media print {
        .pdf-cover,
        .pdf-toc {
          break-after: page;
        }
      }

      .print-chapter {
        display: block;
      }

      .print-chapter + .print-chapter {
        margin-top: 2.5rem;
      }

      /* For the PDF capture, show the code blocks and hide the live editors /
         output iframes (html2canvas can't capture iframes). */
      :host ::ng-deep .runner {
        display: none !important;
      }

      :host ::ng-deep .runner-print {
        display: block !important;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrintAllComponent {
  @ViewChild('doc') private readonly doc?: ElementRef<HTMLElement>;

  private readonly chapterRepository = inject(ChapterRepositoryService);
  private readonly title = inject(Title);
  private readonly location = inject(Location);
  private readonly printMode = inject(PrintModeService);
  private readonly document = inject(DOCUMENT);

  protected readonly chapters = signal<ChapterDefinition[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  // Group chapters for the Contents page (JavaScript / TypeScript / Angular).
  protected readonly toc = computed(() => {
    const groups: { name: string; items: ChapterDefinition[] }[] = [];
    for (const chapter of this.chapters()) {
      let bucket = groups.find((g) => g.name === chapter.group);
      if (!bucket) {
        bucket = { name: chapter.group, items: [] };
        groups.push(bucket);
      }
      bucket.items.push(chapter);
    }
    return groups;
  });

  constructor() {
    this.loadAll();
  }

  protected back(): void {
    this.location.back();
  }

  protected async generate(): Promise<void> {
    if (!this.doc) {
      return;
    }
    this.busy.set(true);

    // Force light theme and expand all collapsed sections for a clean PDF.
    const root = this.document.documentElement;
    const previousTheme = root.dataset['theme'];
    root.dataset['theme'] = 'light';
    this.doc.nativeElement
      .querySelectorAll<HTMLDetailsElement>('details')
      .forEach((d) => (d.open = true));

    // Let the theme + layout settle before capturing.
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [10, 10, 12, 10],
          filename: 'angular-learning.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.print-chapter' }
        })
        .from(this.doc.nativeElement)
        .save();
    } finally {
      if (previousTheme) {
        root.dataset['theme'] = previousTheme;
      }
      this.busy.set(false);
    }
  }

  private async loadAll(): Promise<void> {
    try {
      const summaries = await this.chapterRepository.getChapterSummaries();
      const full = await Promise.all(
        summaries.map((summary) => this.chapterRepository.getChapterById(summary.id))
      );
      this.chapters.set(full);
      this.title.setTitle('Angular Learning — Full Course');
      this.printMode.enabled.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
