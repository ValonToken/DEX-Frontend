import { User, UserStripped } from "./user.interface";

export interface UserLogin {
    username: string;
    password: string;
}

export interface UserLoginResponse {
    data: UserStripped;
    message: string;
}

export interface UserLogoutResponse {
    data: string;
    message: string;
}

export interface GetAuthUserResponse {
    data: User;
    message: string;
}

export interface ChangePassword {
    sessionId: string;
    passwordHash: string;
}

export interface UpdateResponse {
    data: { n: number, nModified: number, ok: number };
    message: string;
}

export const ROLES = {
    GUEST: 0,
    USER: 1,
    AGENT: 2,
    ADMIN: 3
};
