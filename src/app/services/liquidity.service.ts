import { Injectable } from "@angular/core";
import { ethers, providers, BigNumber } from 'ethers';
import { environment } from '../../environments/environment';
import { WalletConnectService } from './wallet-connect.service';
import { UniswapV2Factory } from '../abis/IUniswapV2Factory.json';
import { UniswapV2Router } from '../abis/IUniswapV2Router02.json';
import { UniswapV2Pair } from '../abis/IUniswapV2Pair.json';
import { from, Observable, zip } from "rxjs";
import { first, switchMap } from "rxjs/operators";
import { each } from "jquery";
import { PairReserves } from "../interfaces/liquidity.interface";

@Injectable({ providedIn: 'root' })
export class LiquidityService {

    public factoryContract: ethers.Contract;
    public routerContract: ethers.Contract;

    constructor(
        private walletConnectService: WalletConnectService,
    ) {
    }

    ngOnInit() {
    }

    public connect() {
        this.factoryContract = new ethers.Contract(
            environment.factoryContract,
            JSON.stringify(UniswapV2Factory.abi),
            this.walletConnectService.web3Provider
        );

        this.routerContract = new ethers.Contract(
            environment.routerContract,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        );
    }

    public getPair(tokenAddress1: string, tokenAddress2: string): Observable<string> {
        return from(this.factoryContract.getPair(tokenAddress1, tokenAddress2)) as Observable<string>;
    }

    public getPairs(index: number): Observable<string> {
        return from(this.factoryContract.allPairs(index)) as Observable<string>;
    }

    public getPairsLength(): Observable<BigNumber> {
        return from(this.factoryContract.allPairsLength()) as Observable<BigNumber>;
    }

    public getPairsList(): Observable<string[]> {
        return this.getPairsLength()
        .pipe(
            switchMap(length => {
                const list: Observable<string>[] = [];
                const len = length.toNumber();
                for (let i = 0; i < len; i++) {
                    list.push( from(this.getPairs(i)) );
                }
                return zip(...list);
            })
        )
    }

    public getPairLiquidity(pairAddress: string): Observable<BigNumber> {
        const pairContract = new ethers.Contract(
            pairAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.walletConnectService.web3Provider
        );
        const walletAddress = this.walletConnectService.getState().address;
        return from(pairContract.balanceOf(walletAddress)) as Observable<BigNumber>;
    }

    public getPairTotalSupply(pairAddress: string): Observable<BigNumber> {
        const pairContract = new ethers.Contract(
            pairAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.walletConnectService.web3Provider
        );
        return from(pairContract.totalSupply()) as Observable<BigNumber>;
    }

    public getPairTokenAddresses(pairAddress: string): Observable<string[]> {
        const pairContract = new ethers.Contract(
            pairAddress,
            JSON.stringify(UniswapV2Pair.abi),
            this.walletConnectService.web3Provider
        );
        console.log('CONTRACT', pairContract)

        return zip(
            from(pairContract.token0()) as Observable<string>,
            from(pairContract.token1()) as Observable<string>
        );
    }

    public getTokenAddressList(): Observable<string[][]> {
        return this.getPairsList().pipe(
            switchMap(pairsList => {
                const list: Observable<string[]>[] = [];
                for (let pair of pairsList) {
                    list.push(
                        this.getPairTokenAddresses(pair)
                    )
                }
                return zip(...list);
            })
        )
    }

    public getAllowance(tokenContract: ethers.Contract): Observable<BigNumber> {
        const address = this.walletConnectService.getState().address;
        return from(tokenContract.allowance(address, environment.routerContract)) as Observable<BigNumber>;
    }

    public setAllowance(tokenContract: ethers.Contract, amountWei: ethers.BigNumber): Observable<ethers.providers.TransactionResponse> {
        const connectedContract = tokenContract.connect(this.walletConnectService.signer);
        return from(
            connectedContract.approve(
                environment.routerContract,
                amountWei,
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public getAmountsOut(inputAmount: ethers.BigNumber, addressList: string[]): Observable<BigNumber> {
        return from(
            this.routerContract.getAmountsOut(
                BigNumber.from(inputAmount),
                addressList
            )
        ) as Observable<BigNumber>;
    }

    public getReserves(token1Address: string, token2Address: string): Observable<[string, string, PairReserves]> {
        return this.getPair(token1Address, token2Address)
        .pipe(switchMap(pairAddress => {
            const pairContract = new ethers.Contract(
                pairAddress,
                JSON.stringify(UniswapV2Pair.abi),
                this.walletConnectService.web3Provider
            );
            return zip(
                from(pairContract.token0()),
                from(pairContract.token1()),
                from(pairContract.getReserves())
            ) as Observable<[string, string, PairReserves]>;
        }));
    }

    public addLiquidityBNB(tokenAddress: string, tokenAmount: BigNumber, amountTokenMin: BigNumber,
        amountETHMin: BigNumber, lpTokensToAddress: string, deadline: number, overrides: any):
        Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            this.routerContract.address,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.addLiquidityETH(
                tokenAddress,
                tokenAmount,
                amountTokenMin,
                amountETHMin,
                lpTokensToAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public addLiquidity(token1Address: string, token2Address: string,
        token1Amount: BigNumber, token2Amount: BigNumber,
        amountToken1Min: BigNumber, amountToken2Min: BigNumber,
        lpTokensToAddress: string, deadline: number, overrides: any):
        Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            this.routerContract.address,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.addLiquidity(
                token1Address,
                token2Address,
                token1Amount,
                token2Amount,
                amountToken1Min,
                amountToken2Min,
                lpTokensToAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public removeLiquidityBNB(tokenAddress: string, liquidityAmount: BigNumber, amountTokenMin: BigNumber,
        amountETHMin: BigNumber, tokensToAddress: string, deadline: number, overrides: any):
        Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            this.routerContract.address,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.removeLiquidityETHSupportingFeeOnTransferTokens(
                tokenAddress,
                liquidityAmount,
                amountTokenMin,
                amountETHMin,
                tokensToAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public removeLiquidity(token1Address: string, token2Address: string, liquidityAmount: BigNumber,
        amountToken1Min: BigNumber, amountToken2Min: BigNumber,
        tokensToAddress: string, deadline: number, overrides: any):
        Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            this.routerContract.address,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.removeLiquidity(
                token1Address,
                token2Address,
                liquidityAmount,
                amountToken1Min,
                amountToken2Min,
                tokensToAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }
}
