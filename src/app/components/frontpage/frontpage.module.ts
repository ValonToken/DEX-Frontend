import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FrontpageRoutingModule } from './frontpage-routing.module';
import { FrontpageComponent } from './frontpage.component';

@NgModule({
  declarations: [FrontpageComponent],
  imports: [
    CommonModule,
    FrontpageRoutingModule,
  ]
})
export class FrontpageModule { }
