export interface User {
    _id: string;
    username: string;
    password: string;
    salt: string;
    role: number;
    email: string;
    phone: string;
    fullname: string;
    active: boolean;
}
  
export interface UpdateUser {
    username?: string;
    password?: string;
    salt?: string;
    role?: number;
    email?: string;
    phone?: string;
    fullname?: string;
    active?: boolean;
}
  
export interface NewUser {
    username: string;
    password: string;
    salt: string;
    role: number;
    email: string;
    phone: string;
    fullname: string;
    active: false;
}
  
export interface UserStripped {
    _id: string;
    username: string;
    role: number;
    email: string;
    phone: string;
    fullname: string;
    active: boolean;
}

export interface LoggedInUser {
    _id: string;
    role: number;
}

export interface GetWalletAddressResponse {
    walletAddress: string;
}
