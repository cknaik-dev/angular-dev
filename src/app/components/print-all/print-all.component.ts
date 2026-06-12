import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Location } from '@angular/common';
import { ChapterRepositoryService } from '../../core/chapter-repository.service';
import { ChapterDefinition } from '../../models/chapter';
import { ChapterArticleComponent } from '../chapter-article/chapter-article.component';

// Loads every chapter and renders them as one long document for printing /
// saving as a single PDF. Opens the print dialog automatically once ready.
@Component({
  selector: 'app-print-all',
  imports: [ChapterArticleComponent],
  template: `
    <div class="print-toolbar">
      <button type="button" (click)="back()">← Back</button>
      <button type="button" (click)="print()">Print / Save PDF</button>
      @if (loading()) {
        <span class="print-status">Loading {{ chapters().length }} chapters…</span>
      } @else {
        <span class="print-status">{{ chapters().length }} chapters ready</span>
      }
    </div>

    <div class="print-doc">
      <h1 class="print-title">Angular Learning — Full Course</h1>
      @for (chapter of chapters(); track chapter.id) {
        <app-chapter-article class="print-chapter" [chapter]="chapter" />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 880px;
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

      .print-title {
        margin: 0 0 1.5rem;
        font-size: 1.6rem;
      }

      .print-chapter {
        display: block;
      }

      .print-chapter + .print-chapter {
        margin-top: 2.5rem;
      }

      @media print {
        :host {
          padding: 0;
          max-width: none;
        }

        .print-toolbar {
          display: none;
        }

        /* Start each chapter on a fresh page. */
        .print-chapter + .print-chapter {
          break-before: page;
          margin-top: 0;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrintAllComponent {
  private readonly chapterRepository = inject(ChapterRepositoryService);
  private readonly title = inject(Title);
  private readonly location = inject(Location);

  protected readonly chapters = signal<ChapterDefinition[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.loadAll();
  }

  protected back(): void {
    this.location.back();
  }

  protected print(): void {
    window.print();
  }

  private async loadAll(): Promise<void> {
    try {
      const summaries = await this.chapterRepository.getChapterSummaries();
      const full = await Promise.all(
        summaries.map((summary) => this.chapterRepository.getChapterById(summary.id))
      );
      this.chapters.set(full);
      this.title.setTitle('Angular Learning — Full Course');
    } finally {
      this.loading.set(false);
      // Give the articles a moment to render, then open the print dialog.
      setTimeout(() => window.print(), 400);
    }
  }
}
