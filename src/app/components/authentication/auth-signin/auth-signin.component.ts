import { Component, OnInit } from '@angular/core';
import { CryptoService } from 'src/app/services/crypto.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { take } from 'rxjs/operators';
import { ROLES, UserLoginResponse } from 'src/app/interfaces/auth.interface';
import { Router } from '@angular/router';
import { CookieOptions, CookieService } from 'ngx-cookie';

@Component({
  selector: 'app-auth-signin',
  templateUrl: './auth-signin.component.html',
  styleUrls: ['./auth-signin.component.scss']
})
export class AuthSigninComponent implements OnInit {
  public form: FormGroup;
  public loading: boolean;

  constructor(
    private cryptoService: CryptoService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private cookieService: CookieService,
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });

    this.loading = false;
  }

  public ngOnInit() {
  }

  public login() {
    this.loading = true;
    const passwordHash = this.cryptoService.sha256(this.form.get('password').value);
    this.authService.login(this.form.get('username').value, passwordHash).pipe(take(1))
    .subscribe((res: UserLoginResponse) => {
      if (res && res.data) {
        switch (res.data.role) {
          case ROLES.USER: {
            this.router.navigate(['user']);
            break;
          }

          case ROLES.AGENT: {
            this.router.navigate(['agent']);
            break;
          }

          case ROLES.ADMIN: {
            this.router.navigate(['admin']);
            break;
          }
        }

        const expires = new Date();
        expires.setMinutes( expires.getMinutes() + 30 );
        const cookieOptions: CookieOptions = {
          expires: expires
        };

        this.cookieService.put('USER', JSON.stringify({
          id: res.data._id,
          role: res.data.role
        }), cookieOptions);
      }
      this.loading = false;
    }, err => {
      this.loading = false;
    });
  }

}
