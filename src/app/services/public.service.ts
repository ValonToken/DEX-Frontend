import { Injectable } from "@angular/core";
import { ethers, providers, BigNumber } from 'ethers';
import { environment } from '../../environments/environment';
import { BEP20 } from '../abis/IBEP20.json';
import { UniswapV2Router } from '../abis/IUniswapV2Router02.json';
import { UniswapV2Pair } from '../abis/IUniswapV2Pair.json';
import { UniswapV2Factory } from '../abis/IUniswapV2Factory.json';
import { ValonStaking } from '../abis/ValonStaking.json';
import { ValonToken } from '../abis/ValonToken.json';
import { from, Observable, of, zip } from "rxjs";
import { catchError, first, map, switchMap, take } from "rxjs/operators";
import { each } from "lodash";
import { PairReserves } from "../interfaces/liquidity.interface";
import { Pair, Token, TokenAmount } from "@pancakeswap/sdk";
import { FarmPair, PoolInfo, ValonFarm } from "../interfaces/farm.interface";
import { SUPPORTED_COINS as supportedCoinsTest } from '../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../json/mainnet/supported-coins.json';
import { PriceSymbol } from "./price.service";
import { HttpClient } from "@angular/common/http";
import { bignumberDivToNum } from "../utils/common";

@Injectable({ providedIn: 'root' })
export class PublicService {
    public chainID = parseInt(environment.chainId, 10);
    public BbnanceApiUrl = 'https://api.binance.com/api/v3/ticker/price?symbol=';
    public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
    public provider: ethers.providers.JsonRpcProvider;
    public stakingContract: ethers.Contract;
    public valonContract: ethers.Contract;
    public factoryContract: ethers.Contract;
    public bnbPrice = '0';
    public tokens: Token[] = [];
    public pairs: Pair[] = [];

    constructor(
        private http: HttpClient,
    ) {
        const rand = Math.floor(Math.random() * 3) + 1;
        const node = environment['bscNode' + rand];
        this.provider = new ethers.providers.JsonRpcProvider(node);

        this.stakingContract = new ethers.Contract(
            environment.valonStakingContract,
            JSON.stringify(ValonStaking.abi),
            this.provider
        );

        this.valonContract = new ethers.Contract(
            this.supportedCoins['Valon'].address,
            JSON.stringify(ValonToken.abi),
            this.provider
        );

        this.factoryContract = new ethers.Contract(
            environment.factoryContract,
            JSON.stringify(UniswapV2Factory.abi),
            this.provider
        );
    }

    ngOnInit() {
    }

    public getTotalRewards(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getTotalRewards()) as Observable<ethers.BigNumber>;
    }

    public getTotalStakes(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getTotalStakes()) as Observable<ethers.BigNumber>;
    }

    public getValonSupply() {
        return from(this.valonContract.totalSupply()) as Observable<ethers.BigNumber>;
    }

    public getRewardsPerBlock(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getRewardsPerBlock()) as Observable<ethers.BigNumber>;
    }

    public getDifficulty(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getDifficulty()) as Observable<ethers.BigNumber>;
    }

    public getMaxDifficulty(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getMaxDifficulty()) as Observable<ethers.BigNumber>;
    }

    public getActivePoolsCount(): Observable<ethers.BigNumber> {
        return from(this.stakingContract.getActivePoolsCount()) as Observable<ethers.BigNumber>;
    }

    public getPoolInfo(poolAddress: string): Observable<PoolInfo> {
        return from(this.stakingContract.getPoolInfo(poolAddress)) as Observable<PoolInfo>;
    }

    public getPair(tokenAddress1: string, tokenAddress2: string): Observable<string> {
        return from(this.factoryContract.getPair(tokenAddress1, tokenAddress2)) as Observable<string>;
    }

    public getPairTotalSupply(pairAddress: string): Observable<BigNumber> {
        const pairContract = new ethers.Contract(
            pairAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.provider
        );
        return from(pairContract.totalSupply()) as Observable<BigNumber>;
    }

    public getAvgPoolShare(poolAddress: string): Observable<number> {
        return this.getPoolInfo(poolAddress)
        .pipe(switchMap(poolInfo => {
            const totalStakes = parseFloat(ethers.utils.formatEther(poolInfo.totalPoolStakes));
            const result = (totalStakes / parseFloat(poolInfo.stakeHolderCount)) / totalStakes;
            return of(result);
        }));
    }

    public getReserves(token1Address: string, token2Address: string): Observable<[string, string, PairReserves]> {
        return this.getPair(token1Address, token2Address)
        .pipe(switchMap(pairAddress => {
            const pairContract = new ethers.Contract(
                pairAddress,
                JSON.stringify(UniswapV2Pair.abi),
                this.provider
            );
            return zip(
                from(pairContract.token0()),
                from(pairContract.token1()),
                from(pairContract.getReserves())
            ) as Observable<[string, string, PairReserves]>;
        }));
    }

    public getBnbUsdt(): Observable<any> {
        return this.http.get(this.BbnanceApiUrl + 'BNBUSDT')
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

    public getValonPrice(): Observable<number> {
        return this.getPair(
            this.supportedCoins['Wrapped BNB'].address,
            this.supportedCoins['Valon'].address
        ).pipe(switchMap(pairAddress => {
            if (pairAddress && pairAddress != ethers.constants.AddressZero) {
                return this.getReserves(
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

    public buildTokenList() {
        this.tokens = [];
        Object.keys(this.supportedCoins).forEach(key => {
            this.tokens.push(new Token(
                this.chainID,
                this.supportedCoins[key].address,
                this.supportedCoins[key]?.decimals || 18,
                this.supportedCoins[key].symbol,
                key
            ));
        });
    }

    public getPairList(): Observable<any> {
        const pairList$: Observable<any>[] = [];

        each(this.tokens, token0 => {
            each(this.tokens, token1 => {
                if (token0.symbol !== token1.symbol) {
                    pairList$.push(zip(
                        of({ token0: token0, token1: token1 }),
                        this.getPair(token0.address, token1.address),
                        this.getPair(token0.address, token1.address).pipe(switchMap(pairAddress => {
                            if (pairAddress != ethers.constants.AddressZero) {
                                return this.getReserves(token0.address, token1.address)
                            } else {
                                return of(null)
                            }
                        }))
                    ));
                }
            });
        });

        return zip(...pairList$);
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
            ));
        });

        return zip(...pairs$).pipe(
            switchMap(zip => {
                const result: ValonFarm[] = [];
                each(zip, row => {
                    const [poolInfo] = row;
                    if (poolInfo.lpToken != ethers.constants.AddressZero && pairMap[poolInfo.lpToken]) {
                        result.push({
                            lptAddress: poolInfo.lpToken,
                            totalPoolStakes: ethers.BigNumber.from(poolInfo.totalPoolStakes),
                            totalPoolRewards: ethers.BigNumber.from(poolInfo.totalPoolRewards),
                            bonusMultiplier: ethers.BigNumber.from(poolInfo.bonusMultiplier),
                            stakeHolderCount: ethers.BigNumber.from(poolInfo.stakeHolderCount),
                            active: poolInfo.active,
                            lptBalance: ethers.BigNumber.from(0),
                            lptAllowance: ethers.BigNumber.from(0),
                            stakeAmount: ethers.BigNumber.from(0),
                            actualRewards: ethers.BigNumber.from(0),
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
