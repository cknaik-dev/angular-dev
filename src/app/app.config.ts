import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { LessonRepositoryService } from './core/lesson-repository.service';
import { ProgressService } from './core/progress.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    LessonRepositoryService,
    ProgressService
  ]
};
