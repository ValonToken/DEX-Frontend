import { Injectable } from "@angular/core";
import { ethers, providers, BigNumber } from 'ethers';
import { environment } from '../../environments/environment';
import { WalletConnectService } from './wallet-connect.service';
import { BEP20 } from '../abis/IBEP20.json';
import { UniswapV2Router } from '../abis/IUniswapV2Router02.json';
import { UniswapV2Pair } from '../abis/IUniswapV2Pair.json';
import { from, Observable, of, zip } from "rxjs";
import { first, switchMap, take } from "rxjs/operators";
import { each } from "lodash";
import { PairReserves } from "../interfaces/liquidity.interface";
import { ValonStaking } from '../abis/ValonStaking.json';
import { Pair } from "@pancakeswap/sdk";
import { FarmPair, PoolInfo, ValonFarm } from "../interfaces/farm.interface";
import { SUPPORTED_COINS as supportedCoinsTest } from '../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../json/mainnet/supported-coins.json';

@Injectable({ providedIn: 'root' })
export class StakingService {
    public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
    public stakingContract: ethers.Contract;

    constructor(
        private walletConnectService: WalletConnectService,
    ) {
    }

    ngOnInit() {
    }

    public connect() {
        this.stakingContract = new ethers.Contract(
            environment.valonStakingContract,
            JSON.stringify(ValonStaking.abi),
            this.walletConnectService.web3Provider
        );
    }

    public getRewardsPerBlock(): Observable<number> {
        return from(this.stakingContract.getRewardsPerBlock()) as Observable<number>;
    }

    public getDifficulty(): Observable<number> {
        return from(this.stakingContract.getDifficulty()) as Observable<number>;
    }

    public getMaxDifficulty(): Observable<number> {
        return from(this.stakingContract.getMaxDifficulty()) as Observable<number>;
    }

    public getActivePoolsCount(): Observable<number> {
        return from(this.stakingContract.getActivePoolsCount()) as Observable<number>;
    }

    public getPoolInfo(poolAddress: string): Observable<PoolInfo> {
        return from(this.stakingContract.getPoolInfo(poolAddress)) as Observable<PoolInfo>;
    }

    public getStake(poolAddress: string) {
        const walletAddress = this.walletConnectService.getState().address;
        return from(this.stakingContract.getStake(poolAddress, walletAddress)) as Observable<string>;
    }

    public getActualRewards(poolAddress: string) {
        const walletAddress = this.walletConnectService.getState().address;
        return from(this.stakingContract.getActualRewards(poolAddress, walletAddress)) as Observable<string>;
    }

    public getLptBalance(poolAddress: string) {
        const walletAddress = this.walletConnectService.getState().address;
        return from(this.stakingContract.getLptBalance(poolAddress, walletAddress)) as Observable<string>;
    }

    public getLptAllowance(poolAddress: string) {
        const pairContract = new ethers.Contract(
            poolAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.walletConnectService.web3Provider
        );
        const walletAddress = this.walletConnectService.getState().address;
        return from(pairContract.allowance(walletAddress, environment.valonStakingContract)) as Observable<string>;
    }

    public setLptAllowance(poolAddress: string, amountWei: ethers.BigNumber): Observable<ethers.providers.TransactionResponse> {
        const pairContract = new ethers.Contract(
            poolAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.walletConnectService.web3Provider
        );
        const connectedContract = pairContract.connect(this.walletConnectService.signer);
        return from(
            connectedContract.approve(
                environment.valonStakingContract,
                amountWei,
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public addStake(poolAddress: string, lptAmountWei: ethers.BigNumber): Observable<ethers.providers.TransactionResponse> {
        const connectedContract = this.stakingContract.connect(this.walletConnectService.signer);
        return from(
            connectedContract.addStake(
                poolAddress,
                lptAmountWei,
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public claimRewards(poolAddress: string): Observable<ethers.providers.TransactionResponse> {
        const connectedContract = this.stakingContract.connect(this.walletConnectService.signer);
        return from(
            connectedContract.claimRewards(poolAddress)
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public removeStake(poolAddress: string, lptAmountWei: ethers.BigNumber): Observable<ethers.providers.TransactionResponse> {
        const connectedContract = this.stakingContract.connect(this.walletConnectService.signer);
        return from(
            connectedContract.removeStake(
                poolAddress,
                lptAmountWei,
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public buildPairList(pairList: any[]): FarmPair[] {
        const pairMap = {};
        each(pairList, pairData => {
            const [tokens, pairAddress, reserves] = pairData;
            if (!tokens || pairAddress == ethers.constants.AddressZero || !reserves) { return; }
            
            const reserve0 = reserves[0] === tokens.token0.address ? reserves[2].reserve0 : reserves[2].reserve1;
            const reserve1 = reserves[1] === tokens.token1.address ? reserves[2].reserve1 : reserves[2].reserve0;

            pairMap[pairAddress] = {
                token0: tokens.token0,
                token1: tokens.token1,
                reserve0: reserve0,
                reserve1: reserve1,
                lptAddress: pairAddress,
            } as FarmPair;
        });

        const pairs: FarmPair[] = [];
        Object.keys(pairMap).forEach(address => {
            pairs.push(pairMap[address]);
        });
        return pairs;
    }

    public buildFarms(pairList: FarmPair[]): Observable<ValonFarm[]> {
        const pairMap = {};
        each(pairList, pair => {
            pairMap[pair.lptAddress] = pair;
        });

        const pairs$: Observable<any>[] = [];
        each(pairList, pair => {
            pairs$.push(zip(
                this.stakingContract.getPoolInfo(pair.lptAddress),
                this.getStake(pair.lptAddress),
                this.getActualRewards(pair.lptAddress),
                this.getLptAllowance(pair.lptAddress),
                this.getLptBalance(pair.lptAddress),
            ));
        });

        return zip(...pairs$).pipe(
            switchMap(zip => {
                const result: ValonFarm[] = [];
                each(zip, row => {
                    const [poolInfo, stake, actualRewards, allowance, lptBalance] = row;
                    if (poolInfo.lpToken != ethers.constants.AddressZero && pairMap[poolInfo.lpToken]) {
                        result.push({
                            lptAddress: poolInfo.lpToken,
                            totalPoolStakes: ethers.BigNumber.from(poolInfo.totalPoolStakes),
                            totalPoolRewards: ethers.BigNumber.from(poolInfo.totalPoolRewards),
                            bonusMultiplier: ethers.BigNumber.from(poolInfo.bonusMultiplier),
                            stakeHolderCount: ethers.BigNumber.from(poolInfo.stakeHolderCount),
                            active: poolInfo.active,
                            lptBalance: ethers.BigNumber.from(lptBalance),
                            lptAllowance: ethers.BigNumber.from(allowance),
                            stakeAmount: ethers.BigNumber.from(stake),
                            actualRewards: ethers.BigNumber.from(actualRewards),
                            liquidity: '0',
                            pairLiquidity: '0',
                            apy: '0',
                            apr: '0',
                            poolShare: '0',
                            token0: pairMap[poolInfo.lpToken].token0,
                            token1: pairMap[poolInfo.lpToken].token1,
                            reserve0: pairMap[poolInfo.lpToken].reserve0,
                            reserve1: pairMap[poolInfo.lpToken].reserve1,
                            unlocking: false,
                            staking: false,
                            claiming: false,
                            showDetails: false,
                        });
                    }
                });
                return of(result);
            })
        )
    }

}
