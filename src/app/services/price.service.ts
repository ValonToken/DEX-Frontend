import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { ethers, providers, BigNumber } from 'ethers';
import { Observable, of, zip } from "rxjs";
import { catchError, map, switchMap, take } from "rxjs/operators";
import { environment } from '../../environments/environment';
import { ValonFarm } from "../interfaces/farm.interface";
import { bignumberDivToNum } from "../utils/common";
import { LiquidityService } from "./liquidity.service";
import { StakingService } from "./staking.service";
import { SUPPORTED_COINS as supportedCoinsTest } from '../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../json/mainnet/supported-coins.json';

export interface PriceSymbol {
    symbol: string;
    price: string;
}

@Injectable({ providedIn: 'root' })
export class PriceService {
    public apiUrl = 'https://api.binance.com/api/v3/ticker/price?symbol=';
    public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
    public bnbPrice = '0';

    constructor(
        private stakingService: StakingService,
        private liquidityService: LiquidityService,
        private http: HttpClient,
    ) {
    }

    ngOnInit() {
    }

    public getBnbUsdt(): Observable<any> {
        return this.http.get(this.apiUrl + 'BNBUSDT')
        .pipe(
            map((response: PriceSymbol) => {
                this.bnbPrice = response.price;
                return response as PriceSymbol;
            }),
            catchError(error => {
                return of(error);
            })
        );
    }

    public getOutputPrice(
        inputTokenPrice: string,
        inputReserve: ethers.BigNumber,
        outputReserve: ethers.BigNumber
    ): string {
        const inputPrice = parseFloat(inputTokenPrice);
        const div = bignumberDivToNum(inputReserve, outputReserve);
        return (inputPrice * div).toString();
    }

    public getTotalLiquidityPrice(
        inputTokenPrice: string,
        outputTokenPrice: string,
        inputReserve: ethers.BigNumber,
        outputReserve: ethers.BigNumber
    ): string {
        const inputEth = parseFloat(ethers.utils.formatEther(inputReserve));
        const outputEth = parseFloat(ethers.utils.formatEther(outputReserve));
        const inputLiquidity = inputEth * parseFloat(inputTokenPrice);
        const outputLiquidity = outputEth * parseFloat(outputTokenPrice);
        const totalLiquidity = inputLiquidity + outputLiquidity;
        return totalLiquidity.toFixed(2);
    }

    public getAvgPoolShare(poolAddress: string): Observable<number> {
        return this.stakingService.getPoolInfo(poolAddress)
        .pipe(switchMap(poolInfo => {
            const totalStakes = parseFloat(ethers.utils.formatEther(poolInfo.totalPoolStakes));
            const result = (totalStakes / parseFloat(poolInfo.stakeHolderCount)) / totalStakes;
            return of(result);
        }));
    }

    public getEstimatedYearlyRewards(
        rewardsPerBlock: string,
        poolCount: number,
        poolBonus: number,
        difficulty: number,
        poolShare: number,
    ): number {
        const rewardsPerBlockEth = ethers.utils.formatEther(rewardsPerBlock);
        const rewardsPerDay = parseFloat(rewardsPerBlockEth) * 28800;
        const rewards = (rewardsPerDay / poolCount) * poolBonus * difficulty * poolShare;
        const rewardsPerYear = rewards * 365;
        return rewardsPerYear;
    }

    public getApr(
        rewardPrice: string,
        rewardsPerYear: number,
        poolShare: number,
        totalLiquidityValue: string,
    ): string {
        const valuePerYear = rewardsPerYear * parseFloat(rewardPrice);
        const stakeValue = poolShare * parseFloat(totalLiquidityValue);
        return (((stakeValue + valuePerYear) / stakeValue) * 100).toFixed(2);
    }

    public getValonPrice(): Observable<number> {
        return this.liquidityService.getPair(
            this.supportedCoins['Wrapped BNB'].address,
            this.supportedCoins['Valon'].address
        ).pipe(switchMap(pairAddress => {
            if (pairAddress && pairAddress != ethers.constants.AddressZero) {
                return this.liquidityService.getReserves(
                    this.supportedCoins['Wrapped BNB'].address,
                    this.supportedCoins['Valon'].address
                ).pipe(switchMap(reserves => {
                    return this.getBnbUsdt().pipe(switchMap(bnbPrice => {
                        const price = bnbPrice.price;
                        const bnbReserve = this.supportedCoins['Wrapped BNB'].address === reserves[0] ? reserves[2].reserve0 : reserves[2].reserve1;
                        const valoReserve = this.supportedCoins['Valon'].address === reserves[0] ? reserves[2].reserve0 : reserves[2].reserve1;
                        const valoPriceRaw = parseFloat(this.getOutputPrice(price, bnbReserve, valoReserve));
                        return of(+valoPriceRaw.toPrecision(2));
                    }));
                }));
            } else {
                return of(0);
            }
        }));
    }

}
