import { PreviewInputValue, PreviewSnapshot } from '../models/lesson';

interface RenderContext {
  state: Record<string, unknown>;
  scope: Record<string, unknown>;
  rerender: () => void;
}

export class PreviewEngine {
  private readonly domParser = new DOMParser();

  render(
    host: HTMLElement,
    tsCode: string,
    htmlCode: string,
    onSnapshot: (snapshot: PreviewSnapshot) => void
  ): void {
    // Component state is created ONCE here and reused across event re-renders,
    // so values like a click counter persist. It only resets when render() is
    // called again (e.g. the user edits the code and presses Run).
    const state = this.createComponentState(tsCode);

    const renderInto = (): void => {
      host.innerHTML = '';
      const processedHtml = this.convertControlFlow(htmlCode);
      const body = this.domParser.parseFromString(`<body>${processedHtml}</body>`, 'text/html').body;
      const fragment = document.createDocumentFragment();
      const context: RenderContext = { state, scope: {}, rerender: rerenderWithFocus };

      for (const childNode of Array.from(body.childNodes)) {
        this.processNode(childNode, fragment, context);
      }

      host.appendChild(fragment);
      onSnapshot(this.createSnapshot(host));
    };

    // Re-render on events, but keep focus/caret so live typing isn't interrupted.
    const rerenderWithFocus = (): void => {
      const active = host.ownerDocument.activeElement as HTMLInputElement | null;
      const activeId = active && host.contains(active) ? active.id : '';
      const selStart = active ? active.selectionStart : null;
      const selEnd = active ? active.selectionEnd : null;

      renderInto();

      if (activeId) {
        const restored = host.querySelector<HTMLInputElement>(`#${CSS.escape(activeId)}`);
        if (restored) {
          restored.focus();
          try {
            if (selStart != null) {
              restored.setSelectionRange(selStart, selEnd ?? selStart);
            }
          } catch {
            // some input types don't support selection range; ignore
          }
        }
      }
    };

    renderInto();
  }

  // Convert modern @if / @for blocks into the *ngIf / *ngFor the engine runs,
  // so chapter examples can use the syntax we actually teach.
  private convertControlFlow(template: string): string {
    let result = '';
    let i = 0;

    while (i < template.length) {
      if (template.startsWith('@if', i) && /[\s(]/.test(template[i + 3] ?? '')) {
        const cond = this.readDelimited(template, i + 3, '(', ')');
        const block = this.readDelimited(template, cond.end, '{', '}');
        const condition = cond.value.trim();
        result += `<ng-container *ngIf="${condition}">${this.convertControlFlow(block.value)}</ng-container>`;
        i = block.end;

        const afterIf = this.skipWhitespace(template, i);
        if (template.startsWith('@else', afterIf)) {
          const elseBlock = this.readDelimited(template, afterIf + 5, '{', '}');
          result += `<ng-container *ngIf="!(${condition})">${this.convertControlFlow(elseBlock.value)}</ng-container>`;
          i = elseBlock.end;
        }
        continue;
      }

      if (template.startsWith('@switch', i) && /[\s(]/.test(template[i + 7] ?? '')) {
        const head = this.readDelimited(template, i + 7, '(', ')');
        const block = this.readDelimited(template, head.end, '{', '}');
        result += this.convertSwitch(head.value.trim(), block.value);
        i = block.end;
        continue;
      }

      if (template.startsWith('@for', i) && /[\s(]/.test(template[i + 4] ?? '')) {
        const head = this.readDelimited(template, i + 4, '(', ')');
        const block = this.readDelimited(template, head.end, '{', '}');
        let expression = head.value.trim();
        const trackIndex = expression.indexOf(';');
        if (trackIndex >= 0) {
          expression = expression.slice(0, trackIndex).trim();
        }
        result += `<ng-container *ngFor="let ${expression}">${this.convertControlFlow(block.value)}</ng-container>`;
        i = block.end;

        const afterFor = this.skipWhitespace(template, i);
        if (template.startsWith('@empty', afterFor)) {
          const emptyBlock = this.readDelimited(template, afterFor + 6, '{', '}');
          const iterable = expression.split(/\sof\s/)[1]?.trim() ?? '[]';
          result += `<ng-container *ngIf="!(${iterable}).length">${this.convertControlFlow(emptyBlock.value)}</ng-container>`;
          i = emptyBlock.end;
        }
        continue;
      }

      result += template[i];
      i += 1;
    }

    return result;
  }

  // Convert @switch / @case / @default into a chain of *ngIf comparisons.
  private convertSwitch(switchExpr: string, body: string): string {
    const cases: { value: string; content: string }[] = [];
    let defaultContent: string | null = null;
    let i = 0;

    while (i < body.length) {
      if (body.startsWith('@case', i) && /[\s(]/.test(body[i + 5] ?? '')) {
        const value = this.readDelimited(body, i + 5, '(', ')');
        const block = this.readDelimited(body, value.end, '{', '}');
        cases.push({ value: value.value.trim(), content: block.value });
        i = block.end;
        continue;
      }
      if (body.startsWith('@default', i)) {
        const block = this.readDelimited(body, i + 8, '{', '}');
        defaultContent = block.value;
        i = block.end;
        continue;
      }
      i += 1;
    }

    let result = '';
    for (const branch of cases) {
      result += `<ng-container *ngIf="(${switchExpr}) === (${branch.value})">${this.convertControlFlow(branch.content)}</ng-container>`;
    }
    if (defaultContent != null) {
      const noneMatch =
        cases.map((c) => `(${switchExpr}) !== (${c.value})`).join(' && ') || 'true';
      result += `<ng-container *ngIf="${noneMatch}">${this.convertControlFlow(defaultContent)}</ng-container>`;
    }
    return result;
  }

  private readDelimited(
    source: string,
    start: number,
    open: string,
    close: string
  ): { value: string; end: number } {
    let i = this.skipWhitespace(source, start);
    if (source[i] !== open) {
      return { value: '', end: i };
    }

    let depth = 0;
    let value = '';
    for (; i < source.length; i++) {
      const character = source[i];
      if (character === open) {
        depth += 1;
        if (depth === 1) {
          continue;
        }
      } else if (character === close) {
        depth -= 1;
        if (depth === 0) {
          return { value, end: i + 1 };
        }
      }
      value += character;
    }

    return { value, end: i };
  }

  private skipWhitespace(source: string, start: number): number {
    let i = start;
    while (i < source.length && /\s/.test(source[i])) {
      i += 1;
    }
    return i;
  }

  private createComponentState(tsCode: string): Record<string, unknown> {
    const state: Record<string, unknown> = {};

    for (const statement of this.splitTopLevelStatements(tsCode)) {
      const trimmedStatement = statement.trim();
      if (!trimmedStatement) {
        continue;
      }

      const propertyMatch = trimmedStatement.match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
      if (propertyMatch) {
        const [, propertyName, expression] = propertyMatch;
        state[propertyName] = this.evaluateScriptExpression(expression, state);
        continue;
      }

      const methodMatch = trimmedStatement.match(/^([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
      if (methodMatch) {
        const [, methodName, parameters, body] = methodMatch;
        const args = parameters
          .split(',')
          .map((param) => param.trim())
          .filter(Boolean);

        state[methodName] = new Function(...args, `with (this) { ${body} }`).bind(state);
        continue;
      }

      throw new Error(`Unsupported component.ts syntax: ${trimmedStatement}`);
    }

    return state;
  }

  private processNode(node: Node, target: ParentNode, context: RenderContext): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = this.interpolate(node.textContent ?? '', context);
      if (value.trim().length === 0 && !(node.textContent ?? '').includes('\n')) {
        return;
      }

      target.appendChild(document.createTextNode(value));
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const ifExpression = node.getAttribute('*ngIf');
    if (ifExpression && !this.evaluateExpression(ifExpression, context)) {
      return;
    }

    const forExpression = node.getAttribute('*ngFor');
    if (forExpression) {
      this.renderLoop(node, forExpression, target, context);
      return;
    }

    const element = document.createElement(node.tagName.toLowerCase());
    const eventBindings: Array<{ eventName: string; expression: string }> = [];
    const propertyBindings: Array<{ propertyName: string; expression: string }> = [];

    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name === '*ngIf' || attribute.name === '*ngFor') {
        continue;
      }

      const eventMatch = attribute.name.match(/^\((.+)\)$/);
      if (eventMatch) {
        eventBindings.push({ eventName: eventMatch[1], expression: attribute.value });
        continue;
      }

      const propertyMatch = attribute.name.match(/^\[(.+)\]$/);
      if (propertyMatch) {
        propertyBindings.push({ propertyName: propertyMatch[1], expression: attribute.value });
        continue;
      }

      element.setAttribute(attribute.name, this.interpolate(attribute.value, context));
    }

    for (const binding of propertyBindings) {
      const value = this.evaluateExpression(binding.expression, context);

      if (binding.propertyName === 'ngClass') {
        this.applyNgClass(element, value);
        continue;
      }
      if (binding.propertyName === 'ngStyle') {
        this.applyNgStyle(element, value);
        continue;
      }

      (element as unknown as Record<string, unknown>)[binding.propertyName] = value as unknown;
      if (typeof value === 'boolean') {
        // Boolean attributes are presence-based: add when true, remove when false.
        if (value) {
          element.setAttribute(binding.propertyName, '');
        } else {
          element.removeAttribute(binding.propertyName);
        }
      } else if (typeof value === 'string' || typeof value === 'number') {
        element.setAttribute(binding.propertyName, `${value}`);
      }
    }

    for (const childNode of Array.from(node.childNodes)) {
      this.processNode(childNode, element, context);
    }

    for (const binding of eventBindings) {
      element.addEventListener(binding.eventName, (event) => {
        this.executeStatement(binding.expression, {
          ...context,
          scope: {
            ...context.scope,
            $event: event
          }
        });
        context.rerender();
      });
    }

    target.appendChild(element);
  }

  private renderLoop(
    node: HTMLElement,
    expression: string,
    target: ParentNode,
    context: RenderContext
  ): void {
    const match = expression.match(/^let\s+(\w+)\s+of\s+(.+)$/);
    if (!match) {
      throw new Error(`Invalid *ngFor syntax: ${expression}`);
    }

    const [, itemName, iterableExpression] = match;
    const iterable = this.evaluatePiped(iterableExpression, context);
    const values = Array.isArray(iterable) ? iterable : [];

    values.forEach((value, index) => {
      const clonedNode = node.cloneNode(true) as HTMLElement;
      clonedNode.removeAttribute('*ngFor');
      this.processNode(clonedNode, target, {
        ...context,
        scope: {
          ...context.scope,
          [itemName]: value,
          index
        }
      });
    });
  }

  private interpolate(template: string, context: RenderContext): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression: string) => {
      const value = this.evaluatePiped(expression, context);
      return value == null ? '' : String(value);
    });
  }

  // Evaluate an expression that may end with one or more pipes: `value | a | b:arg`.
  private evaluatePiped(expression: string, context: RenderContext): unknown {
    const parts = this.splitTopLevel(expression, '|').filter((p) => p.length > 0);
    if (parts.length <= 1) {
      return this.evaluateExpression(expression, context);
    }

    let value = this.evaluateExpression(parts[0], context);
    for (let i = 1; i < parts.length; i++) {
      const segments = this.splitTopLevel(parts[i], ':');
      const name = segments[0].trim();
      const args = segments.slice(1).map((arg) => this.evaluateExpression(arg, context));
      value = this.applyPipe(name, value, args);
    }
    return value;
  }

  // Split on a single-character separator at top level (not inside quotes,
  // parens, brackets or braces). Collapses '||' so it isn't treated as a pipe.
  private splitTopLevel(input: string, separator: '|' | ':'): string[] {
    const parts: string[] = [];
    let current = '';
    let quote: string | null = null;
    let depth = 0;

    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (quote) {
        current += c;
        if (c === quote) {
          quote = null;
        }
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        current += c;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') {
        depth += 1;
      } else if (c === ')' || c === ']' || c === '}') {
        depth -= 1;
      }
      if (
        c === separator &&
        depth === 0 &&
        (separator !== '|' || (input[i + 1] !== '|' && input[i - 1] !== '|'))
      ) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += c;
    }
    parts.push(current.trim());
    return parts;
  }

  private applyPipe(name: string, value: unknown, args: unknown[]): unknown {
    switch (name) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'titlecase':
        return String(value).replace(/\b\w/g, (c) => c.toUpperCase());
      case 'json':
        return JSON.stringify(value, null, 2);
      case 'slice':
        return (value as unknown[] | string).slice(
          Number(args[0] ?? 0),
          args[1] === undefined ? undefined : Number(args[1])
        );
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: (args[0] as string) || 'USD'
        }).format(Number(value));
      case 'percent':
        return new Intl.NumberFormat('en-US', { style: 'percent' }).format(Number(value));
      case 'number': {
        const info = /^(\d+)\.(\d+)-(\d+)$/.exec(String(args[0] ?? ''));
        const opts: Intl.NumberFormatOptions = info
          ? { minimumFractionDigits: Number(info[2]), maximumFractionDigits: Number(info[3]) }
          : {};
        return new Intl.NumberFormat('en-US', opts).format(Number(value));
      }
      case 'date': {
        const date = value instanceof Date ? value : new Date(value as string);
        const fmt = args[0] as string | undefined;
        if (fmt === 'shortTime') {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (fmt === 'fullDate') {
          return date.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        return date.toLocaleDateString();
      }
      default:
        return value;
    }
  }

  private applyNgClass(element: HTMLElement, value: unknown): void {
    if (typeof value === 'string') {
      value
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => element.classList.add(cls));
    } else if (Array.isArray(value)) {
      value.forEach((cls) => element.classList.add(String(cls)));
    } else if (value && typeof value === 'object') {
      for (const [cls, on] of Object.entries(value)) {
        if (on) {
          element.classList.add(cls);
        }
      }
    }
  }

  private applyNgStyle(element: HTMLElement, value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }
    for (const [rawKey, raw] of Object.entries(value)) {
      const dot = rawKey.indexOf('.');
      const prop = dot >= 0 ? rawKey.slice(0, dot) : rawKey;
      const styleValue = dot >= 0 ? `${raw}${rawKey.slice(dot + 1)}` : String(raw);
      element.style.setProperty(prop, styleValue);
    }
  }

  private evaluateExpression(expression: string, context: RenderContext): unknown {
    const evaluator = new Function(
      'state',
      'scope',
      `with (state) { with (scope) { return (${expression}); } }`
    ) as (state: Record<string, unknown>, scope: Record<string, unknown>) => unknown;

    return evaluator(context.state, context.scope);
  }

  private executeStatement(statement: string, context: RenderContext): void {
    const executor = new Function(
      'state',
      'scope',
      `with (state) { with (scope) { ${statement}; } }`
    ) as (state: Record<string, unknown>, scope: Record<string, unknown>) => void;

    executor(context.state, context.scope);
  }

  private createSnapshot(host: HTMLElement): PreviewSnapshot {
    const inputValues: PreviewInputValue[] = Array.from(host.querySelectorAll('input')).map((input) => ({
      selector: input.tagName.toLowerCase(),
      value: input.value
    }));

    return {
      textContent: host.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      html: host.innerHTML,
      inputValues
    };
  }

  private evaluateScriptExpression(expression: string, state: Record<string, unknown>): unknown {
    const evaluator = new Function(
      'state',
      `with (state) { return (${expression.trim().replace(/;$/, '')}); }`
    ) as (state: Record<string, unknown>) => unknown;

    return evaluator.call(state, state);
  }

  private splitTopLevelStatements(source: string): string[] {
    const statements: string[] = [];
    let current = '';
    let quote: "'" | '"' | '`' | null = null;
    let escapeNext = false;
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;

    for (const character of source) {
      current += character;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (character === '\\') {
        escapeNext = true;
        continue;
      }

      if (quote) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }

      if (character === '\'' || character === '"' || character === '`') {
        quote = character;
        continue;
      }

      if (character === '{') {
        braceDepth += 1;
        continue;
      }

      if (character === '}') {
        braceDepth -= 1;
        continue;
      }

      if (character === '[') {
        bracketDepth += 1;
        continue;
      }

      if (character === ']') {
        bracketDepth -= 1;
        continue;
      }

      if (character === '(') {
        parenDepth += 1;
        continue;
      }

      if (character === ')') {
        parenDepth -= 1;
        continue;
      }

      if (character === ';' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        statements.push(current.slice(0, -1));
        current = '';
      }
    }

    if (current.trim()) {
      statements.push(current);
    }

    return statements;
  }
}
