export interface LessonSummary {
  id: string;
  title: string;
  learningObjective: string;
}

export interface CompletionCheck {
  type: 'textIncludes';
  value: string;
}

export interface MultiTextCompletionCheck {
  type: 'allTextIncluded';
  values: string[];
}

export interface InputValueCompletionCheck {
  type: 'inputValue';
  selector?: string;
  value: string;
}

export type LessonCheck = CompletionCheck | MultiTextCompletionCheck | InputValueCompletionCheck;

export interface LessonDefinition extends LessonSummary {
  description: string;
  hint: string;
  expectedOutput: string;
  ts: string;
  html: string;
  checks: LessonCheck[];
}

export interface PlaygroundLesson extends LessonDefinition {
  studentTs: string;
  studentHtml: string;
}

export interface LessonEdits {
  ts: string;
  html: string;
}

export interface ProgressState {
  version: number;
  theme: 'dark' | 'light';
  selectedLessonId: string | null;
  completedLessonIds: string[];
  edits: Record<string, LessonEdits>;
}

export interface PreviewInputValue {
  selector: string;
  value: string;
}

export interface PreviewSnapshot {
  textContent: string;
  html: string;
  inputValues: PreviewInputValue[];
}
