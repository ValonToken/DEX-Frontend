import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs/operators';
import { Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { ChangePassword, UpdateResponse } from 'src/app/interfaces/auth.interface';
import { CryptoService } from 'src/app/services/crypto.service';

@Component({
  selector: 'app-auth-change-password',
  templateUrl: './auth-change-password.component.html',
  styleUrls: ['./auth-change-password.component.scss']
})
export class AuthChangePasswordComponent implements OnInit {
  public sessionId = '';
  public form: FormGroup;
  public loading: boolean;
  public error = null;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authService: AuthService,
    private cryptoService: CryptoService,
  ) {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.sessionId = params['sessionId'];
    });

    this.form = this.fb.group({
      currentPassword: [''],
      password: ['', [Validators.required, Validators.minLength(9)]],
      password2: ['', Validators.required],
    });
  }

  ngOnInit() {
  }

  public passwordsMatch(): boolean {
    return this.form.get('password').value === this.form.get('password2').value;
  }

  public changePassword(): boolean {
    console.warn('form', this.form)
    this.loading = true;
    if (!this.passwordsMatch()) {
      this.error = { msg: 'Passwords need to match' };
      this.loading = false;
      return false;
    }

    if (this.form.status === 'INVALID') {
      this.loading = false;
      return false;
    }

    const passwordHash = this.cryptoService.sha256(this.form.get('password').value);
    this.authService.changePassword(this.sessionId, passwordHash).pipe(take(1))
    .subscribe((res: UpdateResponse) => {
      this.loading = false;
      return true;
    }, (err) => {
      this.loading = false;
      return false;
    });
  }

}
