import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserLptRoutingModule } from './user-lpt-routing.module';
import { UserLptComponent } from './user-lpt.component';
import { SharedModule } from '../../../theme/shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { QrCodeModule } from 'ng-qrcode';
import { FormatNumberPipeModule } from 'src/app/pipes/format-number.module';
import { BignumberToEthersPipeModule } from 'src/app/pipes/bignumber-to-ethers.module';

@NgModule({
  declarations: [UserLptComponent],
  imports: [
    CommonModule,
    UserLptRoutingModule,
    SharedModule,
    ReactiveFormsModule,
    ClipboardModule,
    QrCodeModule,
    FormatNumberPipeModule,
    BignumberToEthersPipeModule,
  ]
})
export class UserLptModule { }
