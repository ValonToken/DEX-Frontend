import { NgModule } from '@angular/core';
import { FormatNumberPipe } from './format-number.pipe';

@NgModule({
    imports:        [],
    declarations:   [FormatNumberPipe],
    exports:        [FormatNumberPipe],
})
export class FormatNumberPipeModule {
  static forRoot() {
     return {
         ngModule: FormatNumberPipeModule,
         providers: [],
     };
  }
}
