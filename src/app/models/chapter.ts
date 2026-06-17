// Block-based, data-driven chapter content.
// A chapter lives in public/chapters/<id>.json and renders generically,
// so adding 100 more chapters means adding JSON files, not HTML/CSS.

export type ChapterGroup = 'JavaScript' | 'TypeScript' | 'Angular';

export interface ChapterSummary {
  id: string;
  number: number;
  title: string;
  summary: string;
  group: ChapterGroup;
}

// Inline text may contain simple HTML (<code>, <strong>); it is author-owned.
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ListBlock {
  type: 'list';
  items: string[];
}

export interface NoteBlock {
  type: 'note';
  text: string;
}

// "Want more?" reference, e.g. a deeper javascript.info page.
export interface LinkBlock {
  type: 'link';
  url: string;
  label: string;
}

// Inline SVG diagram. Uses currentColor so it follows the theme.
export interface SvgBlock {
  type: 'svg';
  svg: string;
  caption?: string;
}

// External image (PNG/SVG by URL), e.g. from the internet.
export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  maxWidth?: number;
}

// A single code snippet with an optional label.
export interface CodeBlock {
  type: 'code';
  label?: string;
  code: string;
}

// An editable, runnable HTML/JS example (rendered in a sandboxed iframe).
export interface RunBlock {
  type: 'run';
  code: string;
  height?: number;
  rows?: number;
}

// An editable, runnable Angular example (component.ts + component.html),
// rendered live by the mini Angular preview engine.
export interface NgBlock {
  type: 'ng';
  ts: string;
  html: string;
}

// Side-by-side labelled code cards (the old "code-compare").
export interface CompareBlock {
  type: 'compare';
  cards: { title: string; code: string }[];
}

// A row of small boxes, each a term and its value/meaning (old "diagram-box").
export interface BoxesBlock {
  type: 'boxes';
  boxes: { title: string; detail?: string }[];
}

// Stacked layers, top to bottom (old "stack-diagram").
export interface StackBlock {
  type: 'stack';
  layers: { title: string; detail?: string }[];
}

// Left-to-right steps joined by arrows (old "flow-diagram").
export interface FlowBlock {
  type: 'flow';
  steps: string[];
}

export type ContentBlock =
  | TextBlock
  | ListBlock
  | NoteBlock
  | LinkBlock
  | SvgBlock
  | ImageBlock
  | CodeBlock
  | RunBlock
  | NgBlock
  | CompareBlock
  | BoxesBlock
  | StackBlock
  | FlowBlock;

export interface ChapterSection {
  id: string;
  title: string;
  blocks: ContentBlock[];
  // When true, the section renders collapsed (a "show more" details block).
  collapsed?: boolean;
}

export interface ChapterDefinition extends ChapterSummary {
  kicker: string;
  heading: string;
  sections: ChapterSection[];
}
