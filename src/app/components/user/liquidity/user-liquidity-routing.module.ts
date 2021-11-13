import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserLiquidityComponent } from './user-liquidity.component';

const routes: Routes = [
  {
    path: '',
    component: UserLiquidityComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserLiquidityRoutingModule { }
