import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LessonDefinition, LessonSummary } from '../models/lesson';

@Injectable()
export class LessonRepositoryService {
  private readonly http = inject(HttpClient);
  private readonly lessonCache = new Map<string, LessonDefinition>();
  private lessonSummariesPromise?: Promise<LessonSummary[]>;

  getLessonSummaries(): Promise<LessonSummary[]> {
    if (!this.lessonSummariesPromise) {
      this.lessonSummariesPromise = firstValueFrom(
        this.http.get<LessonSummary[]>('lessons/index.json')
      );
    }

    return this.lessonSummariesPromise;
  }

  async getLessonById(id: string): Promise<LessonDefinition> {
    const cachedLesson = this.lessonCache.get(id);
    if (cachedLesson) {
      return cachedLesson;
    }

    const lesson = await firstValueFrom(this.http.get<LessonDefinition>(`lessons/${id}.json`));
    this.lessonCache.set(id, lesson);
    return lesson;
  }
}
