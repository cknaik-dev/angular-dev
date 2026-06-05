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
    host.innerHTML = '';
    const componentState = this.createComponentState(tsCode);
    const body = this.domParser.parseFromString(`<body>${htmlCode}</body>`, 'text/html').body;
    const fragment = document.createDocumentFragment();
    const context: RenderContext = {
      state: componentState,
      scope: {},
      rerender: () => this.render(host, tsCode, htmlCode, onSnapshot)
    };

    for (const childNode of Array.from(body.childNodes)) {
      this.processNode(childNode, fragment, context);
    }

    host.appendChild(fragment);
    onSnapshot(this.createSnapshot(host));
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
