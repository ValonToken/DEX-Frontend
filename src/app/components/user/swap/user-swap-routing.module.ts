import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserSwapComponent } from './user-swap.component';

const routes: Routes = [
  {
    path: '',
    component: UserSwapComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserSwapRoutingModule { }
