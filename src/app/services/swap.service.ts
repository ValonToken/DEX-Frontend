import { Injectable } from '@angular/core';
import { BigNumber } from '@ethersproject/bignumber';
import { DexSettings } from '../interfaces/common.interface';
import { ethers } from 'ethers';
import { WalletConnectService } from './wallet-connect.service';
import { from, Observable, of, zip } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { ChainId, Token, TokenAmount, Pair, TradeType, Route, Trade, BestTradeOptions, CurrencyAmount, Currency, JSBI, Percent, Fraction, currencyEquals } from '@pancakeswap/sdk';
import { environment } from '../../environments/environment';
import { SUPPORTED_COINS as supportedCoinsTest } from '../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../json/mainnet/supported-coins.json';
import { Coin } from '../interfaces/coins.interface';
import { each } from 'lodash';
import { LiquidityService } from './liquidity.service';
import { getAddress } from 'ethers/lib/utils';
import { ONE_HUNDRED_PERCENT, INPUT_FRACTION_AFTER_FEE, Field, BASE_BSC_SCAN_URLS, ALLOWED_PRICE_IMPACT_HIGH, BLOCKED_PRICE_IMPACT, ALLOWED_PRICE_IMPACT_MEDIUM, ALLOWED_PRICE_IMPACT_LOW, ZERO_PERCENT } from '../constants/swap.constants';
import { UniswapV2Router } from '../abis/IUniswapV2Router02.json';

@Injectable({ providedIn: 'root' })
export class SwapService {
    public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
    public chainID = parseInt(environment.chainId, 10);
    public tokens: Token[] = [];
    public pairs: Pair[] = [];

    constructor(
        private walletConnectService: WalletConnectService,
        private liquidityService: LiquidityService,
    ) {
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
                        this.liquidityService.getPair(token0.address, token1.address),
                        this.liquidityService.getPair(token0.address, token1.address).pipe(switchMap(pairAddress => {
                            if (pairAddress != ethers.constants.AddressZero) {
                                return this.liquidityService.getReserves(token0.address, token1.address)
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

    public buildPairList(pairList: any[]): Pair[] {
        const pairMap = {};
        this.pairs = [];
        each(pairList, pairData => {
            const [tokens, pairAddress, reserves] = pairData;
            if (!tokens || pairAddress == ethers.constants.AddressZero || !reserves) { return; }
            
            const reserve0 = reserves[0] === tokens.token0.address ? reserves[2].reserve0 : reserves[2].reserve1;
            const reserve1 = reserves[1] === tokens.token1.address ? reserves[2].reserve1 : reserves[2].reserve0;

            pairMap[pairAddress] = {
                token0: tokens.token0,
                token1: tokens.token1,
                reserve0: reserve0,
                reserve1: reserve1
            };
        });

        Object.keys(pairMap).forEach(pairAddress => {
            const pair = new Pair(
                new TokenAmount(pairMap[pairAddress].token0, pairMap[pairAddress].reserve0.toString(10)),
                new TokenAmount(pairMap[pairAddress].token1, pairMap[pairAddress].reserve1.toString(10))
            );
            this.pairs.push(pair);
        });

        return this.pairs;
    }

    public getRouteIn(
        pairlist: Pair[],
        inputCoin: Coin,
        outputCoin: Coin,
        amountIn: ethers.BigNumber
    ): Trade[] {
        const tokenIn = new Token(
            this.chainID,
            inputCoin.address,
            inputCoin?.decimals || 18,
            inputCoin.symbol === 'BNB' ? 'WBNB' : inputCoin.symbol,
            inputCoin.name === 'Binance' ? 'Wrapped BNB' : inputCoin.name
        );

        const tokenOut = new Token(
            this.chainID,
            outputCoin.address,
            outputCoin?.decimals || 18,
            outputCoin.symbol === 'BNB' ? 'WBNB' : outputCoin.symbol,
            outputCoin.name === 'Binance' ? 'Wrapped BNB' : outputCoin.name
        );

        return Trade.bestTradeExactIn(
            pairlist,
            new TokenAmount(tokenIn, amountIn.toString()),
            tokenOut,
            { maxNumResults: 3, maxHops: 3 }
        );
    }

    public routeTestIn() {
        const tokenIn = new Token(
            this.chainID,
            '0xbBfc98DBA371fd3f2E2670c8610813ba5473135B',
            18,
            'VALO',
            'Valon'
        );

        const tokenOut = new Token(
            this.chainID,
            '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
            18,
            'WBNB',
            'Wrapped BNB'
        );

        const pair = new Pair(
            new TokenAmount(tokenIn, '100000000000000000000'),
            new TokenAmount(tokenOut, '100000000000000000000')
        );

        console.log('TESTI', [pair],
        new TokenAmount(tokenIn, '100000000000000000000').toFixed(18),
        tokenOut)

        const trades = Trade.bestTradeExactIn(
            [pair],
            new TokenAmount(tokenIn, '100000000000000000000'),
            tokenOut,
            { maxNumResults: 3, maxHops: 3 }
        );
        console.log('TEST TRADES', trades, trades[0].executionPrice.toFixed(18))
    }

    computeTradePriceBreakdown(trade?: Trade): {
        priceImpactWithoutFee: Percent,
        realizedLPFee: CurrencyAmount
    } {
        // for each hop in our trade, take away the x*y=k price impact from 0.3% fees
        // e.g. for 3 tokens/2 hops: 1 - ((1 - .03) * (1-.03))
        const realizedLPFee = !trade
            ? undefined
            : ONE_HUNDRED_PERCENT.subtract(
                trade.route.pairs.reduce<Fraction>(
                (currentFee: Fraction): Fraction => currentFee.multiply(INPUT_FRACTION_AFTER_FEE),
                ONE_HUNDRED_PERCENT,
                ),
            );
      
        // remove lp fees from price impact
        const priceImpactWithoutFeeFraction = trade && realizedLPFee ? trade.priceImpact.subtract(realizedLPFee) : undefined;
      
        // the x*y=k impact
        const priceImpactWithoutFeePercent = priceImpactWithoutFeeFraction
            ? new Percent(priceImpactWithoutFeeFraction?.numerator, priceImpactWithoutFeeFraction?.denominator)
            : undefined;
      
        // the amount of the input that accrues to LPs
        const realizedLPFeeAmount =
            realizedLPFee &&
            trade &&
            (trade.inputAmount instanceof TokenAmount
                ? new TokenAmount(trade.inputAmount.token, realizedLPFee.multiply(trade.inputAmount.raw).quotient)
                : CurrencyAmount.ether(realizedLPFee.multiply(trade.inputAmount.raw).quotient));
      
        return { priceImpactWithoutFee: priceImpactWithoutFeePercent, realizedLPFee: realizedLPFeeAmount };
    }

    basisPointsToPercent(num: number): Percent {
        return new Percent(JSBI.BigInt(num), JSBI.BigInt(10000))
    }

    computeSlippageAdjustedAmounts(
        trade: Trade,
        allowedSlippage: number,
    ): { [field in Field]?: CurrencyAmount } {
        const pct = this.basisPointsToPercent(allowedSlippage);

        return {
            [Field.INPUT]: trade?.maximumAmountIn(pct),
            [Field.OUTPUT]: trade?.minimumAmountOut(pct),
        }
    }

    // returns the checksummed address if the address is valid, otherwise returns false
    isAddress(value: any): string | false {
        try {
            return getAddress(value)
        } catch {
            return false
        }
    }

    warningSeverity(priceImpact: Percent): 0 | 1 | 2 | 3 | 4 {
        if (!priceImpact?.lessThan(BLOCKED_PRICE_IMPACT)) return 4;
        if (!priceImpact?.lessThan(ALLOWED_PRICE_IMPACT_HIGH)) return 3;
        if (!priceImpact?.lessThan(ALLOWED_PRICE_IMPACT_MEDIUM)) return 2;
        if (!priceImpact?.lessThan(ALLOWED_PRICE_IMPACT_LOW)) return 1;
        return 0;
    }

    getRoutePathStr(trade: Trade, coin1Symbol: string, coin2Symbol) {
        if (!trade?.route?.path) { return 'Invalid route'; }

        let result = '';
        for(let i = 0; i<trade.route.path.length; i++) {
            result += trade.route.path[i].symbol === 'WBNB' ? 'BNB' : trade.route.path[i].symbol;
            if (trade.route.path[i+1]) {
                result += ' <i class="feather icon-arrow-right"></i> ';
            } else {
                result += ` <i class="feather icon-help-circle valon-help valon-tooltip">
                    <span class="valon-tooltiptext">The transaction will go through this route to convert
                      ${coin1Symbol} into ${coin2Symbol}
                    </span>
                </i>`
            }
        }
        return result;
    }

    isTradeBetter(
        tradeA: Trade,
        tradeB: Trade,
        minimumDelta: Percent = ZERO_PERCENT,
    ): boolean | undefined {
        if (tradeA && !tradeB) return false;
        if (tradeB && !tradeA) return true;
        if (!tradeA || !tradeB) return undefined;
      
        if (
            tradeA.tradeType !== tradeB.tradeType ||
            !currencyEquals(tradeA.inputAmount.currency, tradeB.inputAmount.currency) ||
            !currencyEquals(tradeB.outputAmount.currency, tradeB.outputAmount.currency)
        ) {
            throw new Error('Trades are not comparable')
        }
      
        if (minimumDelta.equalTo(ZERO_PERCENT)) {
            return tradeA.executionPrice.lessThan(tradeB.executionPrice);
        }

        return tradeA.executionPrice.raw.multiply(minimumDelta.add(ONE_HUNDRED_PERCENT)).lessThan(tradeB.executionPrice);
    }

    public swapBNBForToken(
        amountOutMin: ethers.BigNumber,
        path: string[],
        recipientAddress: string,
        deadline: number,
        overrides: any
    ): Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            environment.routerContract,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
                amountOutMin,
                path,
                recipientAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public swapTokenForBNB(
        amountIn: ethers.BigNumber,
        amountOutMin: ethers.BigNumber,
        path: string[],
        recipientAddress: string,
        deadline: number,
        overrides: any
    ): Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            environment.routerContract,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
                amountIn,
                amountOutMin,
                path,
                recipientAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

    public swapTokenForToken(
        amountIn: ethers.BigNumber,
        amountOutMin: ethers.BigNumber,
        path: string[],
        recipientAddress: string,
        deadline: number,
        overrides: any
    ): Observable<ethers.providers.TransactionResponse> {
        const signer = this.walletConnectService.web3Provider.getSigner();
        const pancakeRouter = new ethers.Contract(
            environment.routerContract,
            JSON.stringify(UniswapV2Router.abi),
            this.walletConnectService.web3Provider
        ).connect(signer);

        return from(
            pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountIn,
                amountOutMin,
                path,
                recipientAddress,
                deadline,
                overrides
            )
        ) as Observable<ethers.providers.TransactionResponse>;
    }

}
