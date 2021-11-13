import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { GetWalletAddressResponse, LoggedInUser } from '../interfaces/user.interface';
import { CookieService } from 'ngx-cookie';
import { UpdateResponse } from '../interfaces/auth.interface';

@Injectable({ providedIn: 'root' })
export class UserService {
    private apiUrl = environment.server + '/user';

    constructor(
        private http: HttpClient,
        private cookieService: CookieService,
    ) {
    }

    public getLoggedInUser(): LoggedInUser {
        return JSON.parse(this.cookieService.get('USER'));
    }

    public getWalletAddress(): Observable<GetWalletAddressResponse> {
        const endpoint = this.apiUrl + '/getWalletAddress';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        return this.http.get<GetWalletAddressResponse>(endpoint, httpOptions);
    }

    public saveWalletAddress(walletAddress: string): Observable<UpdateResponse> {
        const endpoint = this.apiUrl + '/saveWalletAddress';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        const payload: GetWalletAddressResponse = {
            walletAddress: walletAddress
        };

        return this.http.post<UpdateResponse>(endpoint, payload, httpOptions);
    }
}
