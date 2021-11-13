import { ethers } from 'ethers';

export interface Coin {
    symbol: string;
    name: string;
    icon: string;
    address: string;
    contract?: ethers.Contract;
    data?: any;
    decimals?: number;
}
