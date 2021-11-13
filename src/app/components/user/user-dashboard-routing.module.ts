import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserFarmComponent } from './farm/user-farm.component';
import { UserLiquidityComponent } from './liquidity/user-liquidity.component';
import { UserLptComponent } from './lpt/user-lpt.component';
import { UserSwapComponent } from './swap/user-swap.component';
import { UserDashboardComponent } from './user-dashboard.component';
import { UserWalletComponent } from './wallet/user-wallet.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    component: UserDashboardComponent
  },
  {
    path: 'profile',
    component: UserWalletComponent
  },
  {
    path: 'liquidity',
    component: UserLiquidityComponent
  },
  {
    path: 'swap',
    component: UserSwapComponent
  },
  {
    path: 'farms',
    component: UserFarmComponent
  },
  {
    path: 'lpt',
    component: UserLptComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserDashboardRoutingModule { }
