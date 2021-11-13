import { NgModule } from '@angular/core';
import { BignumberToEthersPipe } from './bignumber-to-ethers.pipe';

@NgModule({
    imports:        [],
    declarations:   [BignumberToEthersPipe],
    exports:        [BignumberToEthersPipe],
})
export class BignumberToEthersPipeModule {
  static forRoot() {
     return {
         ngModule: BignumberToEthersPipeModule,
         providers: [],
     };
  }
}
