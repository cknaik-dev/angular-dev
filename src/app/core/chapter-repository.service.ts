import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChapterDefinition, ChapterSummary } from '../models/chapter';

@Injectable()
export class ChapterRepositoryService {
  private readonly http = inject(HttpClient);
  private readonly chapterCache = new Map<string, ChapterDefinition>();
  private chapterSummariesPromise?: Promise<ChapterSummary[]>;

  getChapterSummaries(): Promise<ChapterSummary[]> {
    if (!this.chapterSummariesPromise) {
      this.chapterSummariesPromise = firstValueFrom(
        this.http.get<ChapterSummary[]>('chapters/index.json')
      );
    }

    return this.chapterSummariesPromise;
  }

  async getChapterById(id: string): Promise<ChapterDefinition> {
    const cached = this.chapterCache.get(id);
    if (cached) {
      return cached;
    }

    const chapter = await firstValueFrom(
      this.http.get<ChapterDefinition>(`chapters/${id}.json`)
    );
    this.chapterCache.set(id, chapter);
    return chapter;
  }
}
