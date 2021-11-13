import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserLiquidityRoutingModule } from './user-liquidity-routing.module';
import { UserLiquidityComponent } from './user-liquidity.component';
import { SharedModule } from '../../../theme/shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { QrCodeModule } from 'ng-qrcode';
import { FormatNumberPipeModule } from 'src/app/pipes/format-number.module';
import { BignumberToEthersPipeModule } from 'src/app/pipes/bignumber-to-ethers.module';

@NgModule({
  declarations: [UserLiquidityComponent],
  imports: [
    CommonModule,
    UserLiquidityRoutingModule,
    SharedModule,
    ReactiveFormsModule,
    ClipboardModule,
    QrCodeModule,
    FormatNumberPipeModule,
    BignumberToEthersPipeModule,
  ]
})
export class UserLiquidityModule { }
