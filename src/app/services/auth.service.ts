import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { UserLoginResponse, UserLogin, UserLogoutResponse, GetAuthUserResponse, ChangePassword } from '../interfaces/auth.interface';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = environment.server + '/';

    constructor(private http: HttpClient) { }

    public login(username: string, passwordHash: string): Observable<UserLoginResponse> {
        const endpoint = this.apiUrl + 'login';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        const payload: UserLogin = {
            username: username,
            password: passwordHash
        };

        return this.http.post<UserLoginResponse>(endpoint, payload, httpOptions);
    }

    public logout(): Observable<UserLogoutResponse> {
        const endpoint = this.apiUrl + 'logout';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        return this.http.get<UserLogoutResponse>(endpoint, httpOptions);
    }

    public getAuthUser(): Observable<GetAuthUserResponse> {
        const endpoint = this.apiUrl + 'getAuthUser';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        return this.http.get<GetAuthUserResponse>(endpoint, httpOptions);
    }

    public changePassword(sessionId: string, passwordHash: string): Observable<any> {
        const endpoint = this.apiUrl + 'changePassword';
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
            withCredentials: true
        };

        const payload: ChangePassword = {
            sessionId: sessionId,
            passwordHash: passwordHash
        };

        return this.http.post<any>(endpoint, payload, httpOptions);
    }
}
