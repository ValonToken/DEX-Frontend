import { Injectable } from '@angular/core';
import { BigNumber } from '@ethersproject/bignumber';
import * as CryptoJS from 'crypto-js';

@Injectable({ providedIn: 'root' })
export class CryptoService {
    constructor() { }

    public sha256(data: string): string {
        return CryptoJS.SHA256(data).toString();
    }

    public formatCurrency(value: BigNumber, decimals: number): number {
        return parseInt(value.toString(), 10) / Math.pow(10, decimals);
    }

    public roundCurrency(value: number) {
        if (value.toString().slice(0, value.toString().indexOf('.')).length > 3) {
            return Math.round(value * 100) / 100;
          } else {
            return Math.round(value * 10000) / 10000;
          }
    }
}
