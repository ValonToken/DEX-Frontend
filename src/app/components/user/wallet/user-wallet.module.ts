import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserWalletRoutingModule } from './user-wallet-routing.module';
import { UserWalletComponent } from './user-wallet.component';
import { SharedModule } from '../../../theme/shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { QrCodeModule } from 'ng-qrcode';
import { FormatNumberPipeModule } from 'src/app/pipes/format-number.module';

@NgModule({
  declarations: [UserWalletComponent],
  imports: [
    CommonModule,
    UserWalletRoutingModule,
    SharedModule,
    ReactiveFormsModule,
    ClipboardModule,
    QrCodeModule,
    FormatNumberPipeModule,
  ],
})
export class UserWalletModule { }
