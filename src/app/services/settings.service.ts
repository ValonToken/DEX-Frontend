import { Injectable } from '@angular/core';
import { BigNumber } from '@ethersproject/bignumber';
import { DexSettings } from '../interfaces/common.interface';
import { ethers } from 'ethers';
import { WalletConnectService } from './wallet-connect.service';
import { from, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { DEFAULT_SETTINGS } from '../constants/swap.constants';

@Injectable({ providedIn: 'root' })
export class SettingsService {
    public LOCAL_STORAGE_KEY = 'VALON_DEX_SETTINGS';
    public settings: DexSettings = {
        deadline: 10,
        slippage: 0.1,
        gas: null,
        enableGasOverride: false,
    };

    constructor(private connectService: WalletConnectService) {
    }

    public getSettings(): DexSettings {
        return this.settings;
    }

    public updateSettings(settings: DexSettings) {
        this.settings = settings;
    }

    public saveSettings() {
        window.localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this.settings));
    }

    public loadSettings() {
        const settings = JSON.parse(window.localStorage.getItem(this.LOCAL_STORAGE_KEY)) as DexSettings;
        if (!settings) { return; }
        this.settings = settings;
    }

    public estimateGas(): Observable<ethers.BigNumber> {
        if (this.connectService.web3Provider) {
            return from(this.connectService.web3Provider.getGasPrice());
        }
        return null;
    }

    public resetToDefault() {
        this.settings = DEFAULT_SETTINGS;
    }
}
