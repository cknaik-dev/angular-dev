import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { ChapterRepositoryService } from '../../core/chapter-repository.service';
import { ChapterDefinition, ChapterGroup, ChapterSummary } from '../../models/chapter';
import { ChapterArticleComponent } from '../chapter-article/chapter-article.component';

@Component({
  selector: 'app-chapter-page',
  imports: [RouterLink, RouterLinkActive, ChapterArticleComponent],
  templateUrl: './chapter-page.component.html',
  styleUrl: './chapter-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly chapterRepository = inject(ChapterRepositoryService);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  // Scroll to a section; open it first if it's a collapsed (advanced) section.
  protected scrollToSection(id: string, event: Event): void {
    event.preventDefault();
    const el = this.document.getElementById(id);
    if (!el) {
      return;
    }
    if (el.tagName === 'DETAILS') {
      (el as HTMLDetailsElement).open = true;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly chapters = signal<ChapterSummary[]>([]);
  protected readonly selectedChapter = signal<ChapterDefinition | null>(null);
  protected readonly chapterError = signal<string | null>(null);

  // Group chapters by category (JavaScript / TypeScript / Angular) for the sidebar.
  protected readonly chapterGroups = computed(() => {
    const groups: { name: ChapterGroup; items: ChapterSummary[] }[] = [];
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
    this.loadChapters();

    // Each URL change (chapter/:id) loads that chapter into the page.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadChapter(id);
      }
    });
  }

  private async loadChapters(): Promise<void> {
    try {
      this.chapters.set(await this.chapterRepository.getChapterSummaries());
    } catch (error) {
      this.chapterError.set(
        error instanceof Error ? error.message : 'Unable to load the chapter list.'
      );
    }
  }

  private async loadChapter(id: string): Promise<void> {
    this.chapterError.set(null);
    try {
      const chapter = await this.chapterRepository.getChapterById(id);
      this.selectedChapter.set(chapter);
      this.title.setTitle(`Angular Learning — ${chapter.title}`);
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.selectedChapter.set(null);
      this.chapterError.set(
        error instanceof Error ? error.message : 'Unable to load this chapter.'
      );
    }
  }
}
