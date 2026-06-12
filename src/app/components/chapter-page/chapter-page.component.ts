import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { ChapterRepositoryService } from '../../core/chapter-repository.service';
import { ChapterDefinition, ChapterGroup, ChapterSummary } from '../../models/chapter';
import { DomRunnerComponent } from '../dom-runner/dom-runner.component';
import { NgRunnerComponent } from '../ng-runner/ng-runner.component';
import { SafeSvgComponent } from '../safe-svg/safe-svg.component';

@Component({
  selector: 'app-chapter-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    DomRunnerComponent,
    NgRunnerComponent,
    SafeSvgComponent
  ],
  templateUrl: './chapter-page.component.html',
  styleUrl: './chapter-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly chapterRepository = inject(ChapterRepositoryService);

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
      this.selectedChapter.set(await this.chapterRepository.getChapterById(id));
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.selectedChapter.set(null);
      this.chapterError.set(
        error instanceof Error ? error.message : 'Unable to load this chapter.'
      );
    }
  }
}
