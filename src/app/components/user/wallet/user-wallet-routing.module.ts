import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserWalletComponent } from './user-wallet.component';

const routes: Routes = [
  {
    path: '',
    component: UserWalletComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserWalletRoutingModule { }
