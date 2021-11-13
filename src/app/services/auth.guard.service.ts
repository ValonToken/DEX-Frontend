import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { GetAuthUserResponse } from '../interfaces/auth.interface';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuardService implements CanActivate {
    constructor(public auth: AuthService, public router: Router) {}

    public canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
        return this.auth.getAuthUser().pipe(
            take(1),
            switchMap((res: GetAuthUserResponse) => {
                if (!res || !res.data || route.data.role !== res.data.role) {
                    this.router.navigate(['auth', 'login']);
                    return of(false);
                }
                return of(true);
            }),
            catchError(err => {
                this.router.navigate(['auth', 'login']);
                return of(false);
            })
        );
    }
}