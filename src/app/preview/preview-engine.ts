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
      (element as unknown as Record<string, unknown>)[binding.propertyName] = value as unknown;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
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
    const iterable = this.evaluateExpression(iterableExpression, context);
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
      const value = this.evaluateExpression(expression, context);
      return value == null ? '' : String(value);
    });
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
