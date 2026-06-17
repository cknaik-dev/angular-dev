import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';

@Component({
  selector: 'app-monaco-editor',
  imports: [CommonModule],
  template: '<div #editorHost class="editor-host"></div>',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .editor-host {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonacoEditorComponent implements AfterViewInit, OnChanges {
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) value = '';
  @Input({ required: true }) language: 'typescript' | 'html' = 'typescript';
  @Input({ required: true }) theme: 'dark' | 'light' = 'dark';
  @Output() readonly valueChange = new EventEmitter<string>();
  @ViewChild('editorHost') private readonly editorHost?: ElementRef<HTMLElement>;

  private monaco?: typeof Monaco;
  private editor?: Monaco.editor.IStandaloneCodeEditor;
  private suppressChange = false;

  async ngAfterViewInit(): Promise<void> {
    loader.config({
      paths: {
        vs: new URL('assets/monaco/vs', document.baseURI).toString()
      }
    });

    const monaco = await loader.init();
    this.monaco = monaco;

    // These editors show teaching snippets (often class-body fragments), not
    // full programs — so turn off the red error squiggles from the language service.
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });

    if (!this.editorHost) {
      return;
    }

    const editor = monaco.editor.create(this.editorHost.nativeElement, {
      value: this.value,
      language: this.language,
      theme: this.theme === 'dark' ? 'vs-dark' : 'vs',
      automaticLayout: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      minimap: { enabled: false },
      lineNumbersMinChars: 3,
      padding: { top: 16, bottom: 16 },
      roundedSelection: true,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    });
    this.editor = editor;

    editor.onDidChangeModelContent(() => {
      if (this.suppressChange) {
        return;
      }

      this.valueChange.emit(editor.getValue());
    });

    this.destroyRef.onDestroy(() => {
      this.editor?.dispose();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor || !this.monaco) {
      return;
    }

    if (changes['theme']) {
      this.monaco.editor.setTheme(this.theme === 'dark' ? 'vs-dark' : 'vs');
    }

    if (changes['language']) {
      const model = this.editor.getModel();
      if (model) {
        this.monaco.editor.setModelLanguage(model, this.language);
      }
    }

    if (changes['value'] && this.editor.getValue() !== this.value) {
      this.suppressChange = true;
      this.editor.setValue(this.value);
      this.suppressChange = false;
    }
  }
}
