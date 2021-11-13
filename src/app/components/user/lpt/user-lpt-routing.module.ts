import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserLptComponent } from './user-lpt.component';

const routes: Routes = [
  {
    path: '',
    component: UserLptComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserLptRoutingModule { }
