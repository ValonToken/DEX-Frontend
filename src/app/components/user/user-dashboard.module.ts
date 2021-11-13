import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserDashboardRoutingModule } from './user-dashboard-routing.module';
import { UserDashboardComponent } from './user-dashboard.component';
import { SharedModule } from '../../theme/shared/shared.module';
import { UserWalletModule } from './wallet/user-wallet.module';
import { UserLiquidityModule } from './liquidity/user-liquidity.module';
import { UserSwapModule } from './swap/user-swap.module';
import { UserFarmModule } from './farm/user-farm.module';
import { UserLptModule } from './lpt/user-lpt.module';
import { NgbDropdownModule, NgbProgressbarModule, NgbTabsetModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    UserDashboardComponent,
  ],
  imports: [
    CommonModule,
    UserDashboardRoutingModule,
    SharedModule,
    UserWalletModule,
    UserLiquidityModule,
    UserSwapModule,
    UserFarmModule,
    UserLptModule,
    NgbProgressbarModule,
    NgbDropdownModule,
    NgbTabsetModule,
  ]
})
export class UserDashboardModule { }
