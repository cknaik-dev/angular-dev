# Angular Learning Playground

A completely static, open-source Angular playground for learning Angular concepts by editing only `component.ts` and `component.html`.

## Features

- Angular 21 standalone application compatible with the Angular 20+ requirement
- Monaco Editor with `component.ts` and `component.html` tabs
- Instant preview powered by a lightweight Angular-style renderer
- JSON lesson engine with one manifest file and per-lesson JSON payloads
- LocalStorage autosave and progress restore
- Dark mode, resizable panes, mobile-responsive layout
- Reset lesson, show solution, progress tracker, completed indicators
- Export/import progress as JSON
- GitHub Pages deployment workflow

## Supported Preview Syntax

The preview engine intentionally avoids Angular CLI recompilation for each keystroke and currently supports:

- Interpolation: `{{name}}`
- Event binding: `(click)="count++"`
- Property binding: `[value]="name"`
- Conditional rendering: `*ngIf="show"`
- Loops: `*ngFor="let item of items"`

## Lesson Structure

Lesson content lives in [`public/lessons`](./public/lessons). Add new lessons by:

1. Adding a new entry to [`public/lessons/index.json`](./public/lessons/index.json)
2. Creating a matching `public/lessons/<lesson-id>.json` file

Example:

```json
{
  "id": "interpolation",
  "title": "Interpolation",
  "learningObjective": "Display a variable with Angular-style interpolation.",
  "description": "Display a variable value.",
  "hint": "Use {{variableName}}",
  "ts": "name = 'Angular';",
  "html": "<h1>Hello {{name}}</h1>",
  "expectedOutput": "Hello Angular",
  "checks": [
    {
      "type": "textIncludes",
      "value": "Hello Angular"
    }
  ]
}
```

## Development

```bash
npm install
npm start
```

The app serves at `http://localhost:4200/`.

## Production Build

```bash
npm run build
```

For a portable static build that works well in local previews and GitHub Pages-style hosting:

```bash
npm run build:static
```

## GitHub Pages Deployment

This repository includes [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which:

1. Installs dependencies
2. Builds the Angular app
3. Detects the correct `baseHref`
4. Uploads the static `dist` output to GitHub Pages

To enable deployment:

1. Push the project to GitHub
2. Open `Settings > Pages`
3. Set `Source` to `GitHub Actions`

## Project Structure

- [`src/app/app.ts`](./src/app/app.ts): top-level layout, lesson navigation, autosave, progress management
- [`src/app/components/monaco-editor/monaco-editor.component.ts`](./src/app/components/monaco-editor/monaco-editor.component.ts): Monaco integration
- [`src/app/components/preview-pane/preview-pane.component.ts`](./src/app/components/preview-pane/preview-pane.component.ts): live preview container
- [`src/app/preview/preview-engine.ts`](./src/app/preview/preview-engine.ts): lightweight Angular-style renderer
- [`src/app/core/lesson-repository.service.ts`](./src/app/core/lesson-repository.service.ts): lesson loading
- [`src/app/core/progress.service.ts`](./src/app/core/progress.service.ts): LocalStorage persistence and import/export

## Notes

- The project runs entirely on the client with no backend, database, or authentication layer.
- Monaco assets are bundled locally from `monaco-editor`, so the editor works in a fully static deployment.
- The preview engine evaluates lesson code in-browser and is designed for educational sandbox scenarios, not untrusted multi-user execution.
