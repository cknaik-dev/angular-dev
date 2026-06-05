import { Injectable, signal } from '@angular/core';
import { LessonEdits, ProgressState } from '../models/lesson';

const STORAGE_KEY = 'angular-learning-playground.progress';

@Injectable()
export class ProgressService {
  readonly completedLessonIds = signal<Set<string>>(new Set<string>());
  private readonly state: ProgressState = this.loadState();

  constructor() {
    this.completedLessonIds.set(new Set(this.state.completedLessonIds));
  }

  getTheme(): 'dark' | 'light' {
    return this.state.theme;
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.state.theme = theme;
    this.persist();
  }

  getSelectedLessonId(): string | null {
    return this.state.selectedLessonId;
  }

  setSelectedLessonId(lessonId: string): void {
    this.state.selectedLessonId = lessonId;
    this.persist();
  }

  getLessonEdits(lessonId: string): LessonEdits | undefined {
    return this.state.edits[lessonId];
  }

  saveLessonEdits(lessonId: string, edits: LessonEdits): void {
    this.state.edits[lessonId] = edits;
    this.persist();
  }

  clearLessonEdits(lessonId: string): void {
    delete this.state.edits[lessonId];
    this.persist();
  }

  setLessonCompleted(lessonId: string, completed: boolean): void {
    const nextCompleted = new Set(this.completedLessonIds());
    if (completed) {
      nextCompleted.add(lessonId);
    } else {
      nextCompleted.delete(lessonId);
    }

    this.completedLessonIds.set(nextCompleted);
    this.state.completedLessonIds = [...nextCompleted];
    this.persist();
  }

  exportProgress(): ProgressState {
    return {
      version: this.state.version,
      theme: this.state.theme,
      selectedLessonId: this.state.selectedLessonId,
      completedLessonIds: [...this.state.completedLessonIds],
      edits: structuredClone(this.state.edits)
    };
  }

  importProgress(state: unknown): void {
    if (!this.isProgressState(state)) {
      throw new Error('The selected file is not a valid progress export.');
    }

    this.state.version = state.version;
    this.state.theme = state.theme;
    this.state.selectedLessonId = state.selectedLessonId;
    this.state.completedLessonIds = [...state.completedLessonIds];
    this.state.edits = structuredClone(state.edits);
    this.completedLessonIds.set(new Set(state.completedLessonIds));
    this.persist();
  }

  private loadState(): ProgressState {
    if (typeof localStorage === 'undefined') {
      return this.createDefaultState();
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.createDefaultState();
      }

      const parsed = JSON.parse(raw);
      return this.isProgressState(parsed) ? parsed : this.createDefaultState();
    } catch {
      return this.createDefaultState();
    }
  }

  private createDefaultState(): ProgressState {
    return {
      version: 1,
      theme: 'dark',
      selectedLessonId: null,
      completedLessonIds: [],
      edits: {}
    };
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private isProgressState(value: unknown): value is ProgressState {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<ProgressState>;
    return (
      candidate.version === 1 &&
      (candidate.theme === 'dark' || candidate.theme === 'light') &&
      (typeof candidate.selectedLessonId === 'string' || candidate.selectedLessonId === null) &&
      Array.isArray(candidate.completedLessonIds) &&
      !!candidate.edits &&
      typeof candidate.edits === 'object'
    );
  }
}
