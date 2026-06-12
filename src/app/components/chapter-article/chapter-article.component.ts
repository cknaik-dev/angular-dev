import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ChapterDefinition } from '../../models/chapter';
import { DomRunnerComponent } from '../dom-runner/dom-runner.component';
import { NgRunnerComponent } from '../ng-runner/ng-runner.component';
import { SafeSvgComponent } from '../safe-svg/safe-svg.component';

// Renders one chapter's article (hero + sections + content blocks).
// Reused by the single-chapter page and the print-all view.
@Component({
  selector: 'app-chapter-article',
  imports: [NgTemplateOutlet, DomRunnerComponent, NgRunnerComponent, SafeSvgComponent],
  templateUrl: './chapter-article.component.html',
  styleUrl: './chapter-article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChapterArticleComponent {
  readonly chapter = input.required<ChapterDefinition>();
}
