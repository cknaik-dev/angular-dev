# Angular Learning

A free, data-driven course that takes you from JavaScript fundamentals to building real Angular apps — with runnable examples, diagrams, and a downloadable PDF.

**▶ Live site: https://cknaik-dev.github.io/angular-dev/**

## What's inside

- **42 chapters** grouped into **JavaScript → TypeScript → Angular**, written in plain, beginner-friendly language.
- **Runnable examples** — edit code in a Monaco editor and see it run live (sandboxed HTML/JS, plus a mini Angular preview engine for `{{ }}`, `[prop]`, `(event)`, `@if`/`@for`/`@switch`, pipes, `ngClass`/`ngStyle`).
- **Inline SVG diagrams** that adapt to light/dark theme.
- **Angular Router** — every chapter has its own URL; grouped, collapsible sidebar with on-this-page navigation.
- **Downloadable course PDF** generated from the same content (cover + contents page).

## Topics covered

- **JavaScript:** values & variables, conditions/loops, DOM, functions & arrow functions, arrays, strings, objects, classes, modules, promises/async-await, a taste of REST.
- **TypeScript:** types, interfaces & object types, typed functions & generics.
- **Angular:** CLI & project structure, signals, components, templates & binding, inputs/outputs, two-way binding, control flow, lifecycle, styles & content projection, pipes, directives, forms (template-driven, reactive, custom `ControlValueAccessor`), routing & guards, REST & CRUD with JSON Server, RxJS, `HttpClient`, services & DI, environments, HTTP interceptors, and a full authentication flow.

## Run locally

```bash
npm install
npm start            # dev server at http://localhost:4200
```

## Build

```bash
npm run build        # output in dist/angular-learning-playground/browser
```

## Adding / editing chapters

Chapters are plain JSON in [`public/chapters/`](public/chapters/) rendered from a block model
(`text`, `list`, `note`, `link`, `code`, `compare`, `boxes`, `stack`, `flow`,
`svg`, `image`, `run`, `ng`). Add a chapter by dropping a `chapter-NN.json` file
and adding its entry to `index.json` — no code changes needed.

## Regenerate the course PDF

The PDF is rendered from the built app with headless Chromium (Playwright):

```bash
npm run build
npm run pdf          # writes public/course.pdf
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds with `--base-href /angular-dev/`, publishes to the `gh-pages` branch, and
adds a `404.html` SPA fallback so deep links work. Then enable Pages once:
repo **Settings → Pages → Source: branch `gh-pages` / root**. Live at
https://cknaik-dev.github.io/angular-dev/.

> Run `npm run deploy` (not the raw `ng build --base-href /angular-dev/` inside **Git Bash**).
> Git Bash rewrites the leading-slash `/angular-dev/` into a Windows path, producing a
> broken `<base href>`. The npm script runs through `cmd`, which doesn't do that.
