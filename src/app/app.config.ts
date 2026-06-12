import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, Routes } from '@angular/router';
import { LessonRepositoryService } from './core/lesson-repository.service';
import { ChapterRepositoryService } from './core/chapter-repository.service';
import { ProgressService } from './core/progress.service';
import { ChapterPageComponent } from './components/chapter-page/chapter-page.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chapter/chapter-01' },
  { path: 'chapter/:id', component: ChapterPageComponent },
  { path: '**', redirectTo: 'chapter/chapter-01' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })
    ),
    LessonRepositoryService,
    ChapterRepositoryService,
    ProgressService
  ]
};
