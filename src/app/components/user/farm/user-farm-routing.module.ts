import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserFarmComponent } from './user-farm.component';

const routes: Routes = [
  {
    path: '',
    component: UserFarmComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserFarmRoutingModule { }
