import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthSigninRoutingModule } from './auth-signin-routing.module';
import { AuthSigninComponent } from './auth-signin.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    AuthSigninRoutingModule,
    ReactiveFormsModule,
  ],
  declarations: [AuthSigninComponent]
})
export class AuthSigninModule { }
