import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LessonRepositoryService } from './core/lesson-repository.service';
import { ProgressService } from './core/progress.service';
import { PlaygroundLesson, LessonSummary, PreviewSnapshot } from './models/lesson';
import { MonacoEditorComponent } from './components/monaco-editor/monaco-editor.component';
import { PreviewPaneComponent } from './components/preview-pane/preview-pane.component';

type EditorTab = 'component.ts' | 'component.html';
type ThemeMode = 'dark' | 'light';
type ResizePane = 'left' | 'center';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MonacoEditorComponent, PreviewPaneComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements AfterViewInit {
  private readonly lessonRepository = inject(LessonRepositoryService);
  private readonly progressService = inject(ProgressService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  @ViewChild('workspaceShell') private readonly workspaceShell?: ElementRef<HTMLElement>;

  @HostBinding('class.dark-theme') protected get isDarkThemeClass(): boolean {
    return this.theme() === 'dark';
  }

  protected readonly lessons = signal<LessonSummary[]>([]);
  protected readonly selectedLesson = signal<PlaygroundLesson | null>(null);
  protected readonly activeTab = signal<EditorTab>('component.ts');
  protected readonly theme = signal<ThemeMode>(this.progressService.getTheme());
  protected readonly showHint = signal(false);
  protected readonly showSolution = signal(false);
  protected readonly lessonError = signal<string | null>(null);
  protected readonly previewError = signal<string | null>(null);
  protected readonly lastPreviewSnapshot = signal<PreviewSnapshot | null>(null);
  protected readonly leftPanelWidth = signal(24);
  protected readonly centerPanelWidth = signal(38);

  protected readonly lessonTitle = computed(() => this.selectedLesson()?.title ?? 'Loading lesson...');
  protected readonly currentTs = computed(() => this.selectedLesson()?.studentTs ?? '');
  protected readonly currentHtml = computed(() => this.selectedLesson()?.studentHtml ?? '');
  protected readonly expectedOutput = computed(() => this.selectedLesson()?.expectedOutput ?? '');
  protected readonly currentLessonIndex = computed(() =>
    this.lessons().findIndex((lesson) => lesson.id === this.selectedLesson()?.id)
  );
  protected readonly completedCount = computed(() => this.progressService.completedLessonIds().size);
  protected readonly completionPercent = computed(() => {
    const total = this.lessons().length;
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });
  protected readonly canGoPrevious = computed(() => this.currentLessonIndex() > 0);
  protected readonly canGoNext = computed(() => {
    const index = this.currentLessonIndex();
    return index >= 0 && index < this.lessons().length - 1;
  });
  protected readonly currentLessonCompleted = computed(() => {
    const lesson = this.selectedLesson();
    return lesson ? this.progressService.completedLessonIds().has(lesson.id) : false;
  });
  protected readonly activeEditorLanguage = computed(() =>
    this.activeTab() === 'component.ts' ? 'typescript' : 'html'
  );
  protected readonly activeEditorValue = computed(() =>
    this.activeTab() === 'component.ts' ? this.currentTs() : this.currentHtml()
  );

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.theme();
      this.progressService.setTheme(this.theme());
    });

    effect(() => {
      const lesson = this.selectedLesson();
      if (!lesson) {
        return;
      }

      this.progressService.saveLessonEdits(lesson.id, {
        ts: lesson.studentTs,
        html: lesson.studentHtml
      });
    });

    this.destroyRef.onDestroy(() => {
      this.detachResizeListeners();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.loadLessons();
  }

  protected selectLessonById(lessonId: string): void {
    if (lessonId === this.selectedLesson()?.id) {
      return;
    }

    this.loadLesson(lessonId);
  }

  protected selectTab(tab: EditorTab): void {
    this.activeTab.set(tab);
  }

  protected updateEditorValue(value: string): void {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return;
    }

    const updatedLesson =
      this.activeTab() === 'component.ts'
        ? { ...lesson, studentTs: value }
        : { ...lesson, studentHtml: value };

    this.selectedLesson.set(updatedLesson);
    this.showSolution.set(false);
  }

  protected toggleHint(): void {
    this.showHint.update((value) => !value);
  }

  protected toggleTheme(): void {
    this.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }

  protected showLessonSolution(): void {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return;
    }

    this.selectedLesson.set({
      ...lesson,
      studentTs: lesson.ts,
      studentHtml: lesson.html
    });
    this.showSolution.set(true);
  }

  protected resetCurrentLesson(): void {
    const lesson = this.selectedLesson();
    if (!lesson) {
      return;
    }

    this.selectedLesson.set({
      ...lesson,
      studentTs: lesson.ts,
      studentHtml: lesson.html
    });
    this.progressService.clearLessonEdits(lesson.id);
    this.showSolution.set(false);
  }

  protected goToPreviousLesson(): void {
    if (!this.canGoPrevious()) {
      return;
    }

    const previousLesson = this.lessons()[this.currentLessonIndex() - 1];
    if (previousLesson) {
      this.loadLesson(previousLesson.id);
    }
  }

  protected goToNextLesson(): void {
    if (!this.canGoNext()) {
      return;
    }

    const nextLesson = this.lessons()[this.currentLessonIndex() + 1];
    if (nextLesson) {
      this.loadLesson(nextLesson.id);
    }
  }

  protected async exportProgress(): Promise<void> {
    const payload = this.progressService.exportProgress();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = 'angular-learning-playground-progress.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected async importProgress(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      this.progressService.importProgress(parsed);
      this.theme.set(this.progressService.getTheme());
      await this.loadLessons(this.progressService.getSelectedLessonId());
    } catch (error) {
      this.lessonError.set(
        error instanceof Error ? error.message : 'Could not import the selected progress file.'
      );
    } finally {
      input.value = '';
    }
  }

  protected openImportDialog(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected trackByLessonId(_: number, lesson: LessonSummary): string {
    return lesson.id;
  }

  protected isLessonCompleted(lessonId: string): boolean {
    return this.progressService.completedLessonIds().has(lessonId);
  }

  protected onPreviewSnapshot(snapshot: PreviewSnapshot): void {
    this.lastPreviewSnapshot.set(snapshot);
    const lesson = this.selectedLesson();
    if (!lesson) {
      return;
    }

    const isComplete = lesson.checks.every((check) => {
      switch (check.type) {
        case 'textIncludes':
          return snapshot.textContent.includes(check.value);
        case 'allTextIncluded':
          return check.values.every((value) => snapshot.textContent.includes(value));
        case 'inputValue':
          return snapshot.inputValues.some(
            (input) => (!check.selector || input.selector === check.selector) && input.value === check.value
          );
      }
    });

    this.progressService.setLessonCompleted(lesson.id, isComplete);
  }

  protected onPreviewError(errorMessage: string | null): void {
    this.previewError.set(errorMessage);
  }

  protected startResize(event: PointerEvent, pane: ResizePane): void {
    if (!this.workspaceShell) {
      return;
    }

    event.preventDefault();
    const shell = this.workspaceShell.nativeElement;
    const bounds = shell.getBoundingClientRect();
    const startLeft = this.leftPanelWidth();
    const startCenter = this.centerPanelWidth();
    const startX = event.clientX;
    const minPaneWidth = 18;

    this.detachResizeListeners();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / bounds.width) * 100;
      if (pane === 'left') {
        const nextLeft = this.clamp(startLeft + deltaPercent, minPaneWidth, 40);
        const maxCenter = 100 - nextLeft - minPaneWidth;
        this.leftPanelWidth.set(nextLeft);
        this.centerPanelWidth.set(this.clamp(this.centerPanelWidth(), minPaneWidth, maxCenter));
        return;
      }

      const nextCenter = this.clamp(startCenter + deltaPercent, minPaneWidth, 56);
      const maxCenter = 100 - this.leftPanelWidth() - minPaneWidth;
      this.centerPanelWidth.set(this.clamp(nextCenter, minPaneWidth, maxCenter));
    };

    const handlePointerUp = () => {
      this.detachResizeListeners();
    };

    this.document.addEventListener('pointermove', handlePointerMove);
    this.document.addEventListener('pointerup', handlePointerUp, { once: true });
    this.pointerMoveHandler = handlePointerMove;
    this.pointerUpHandler = handlePointerUp;
  }

  private pointerMoveHandler?: (event: PointerEvent) => void;
  private pointerUpHandler?: () => void;

  private async loadLessons(preferredLessonId?: string | null): Promise<void> {
    try {
      const summaries = await this.lessonRepository.getLessonSummaries();
      this.lessons.set(summaries);
      const initialLessonId =
        preferredLessonId ??
        this.progressService.getSelectedLessonId() ??
        summaries[0]?.id;

      if (initialLessonId) {
        await this.loadLesson(initialLessonId);
      }
    } catch (error) {
      this.lessonError.set(
        error instanceof Error ? error.message : 'Unable to load the lesson catalog.'
      );
    }
  }

  private async loadLesson(lessonId: string): Promise<void> {
    this.lessonError.set(null);
    this.showHint.set(false);
    this.showSolution.set(false);

    try {
      const lesson = await this.lessonRepository.getLessonById(lessonId);
      const savedEdits = this.progressService.getLessonEdits(lesson.id);

      this.selectedLesson.set({
        ...lesson,
        studentTs: savedEdits?.ts ?? lesson.ts,
        studentHtml: savedEdits?.html ?? lesson.html
      });
      this.progressService.setSelectedLessonId(lesson.id);
    } catch (error) {
      this.lessonError.set(error instanceof Error ? error.message : 'Unable to load the lesson.');
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private detachResizeListeners(): void {
    if (this.pointerMoveHandler) {
      this.document.removeEventListener('pointermove', this.pointerMoveHandler);
      this.pointerMoveHandler = undefined;
    }

    if (this.pointerUpHandler) {
      this.document.removeEventListener('pointerup', this.pointerUpHandler);
      this.pointerUpHandler = undefined;
    }
  }
}
