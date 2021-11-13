import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { from, Observable, zip } from 'rxjs';
import { take } from 'rxjs/operators';
import { ValonFeed, ValonPost } from 'src/app/interfaces/common.interface';
import { StakingService } from 'src/app/services/staking.service';
import { ethers } from 'ethers';
import { BEP20 } from '../../abis/IBEP20.json';
import { PublicService } from 'src/app/services/public.service';
import { BignumberToEthersPipe } from 'src/app/pipes/bignumber-to-ethers.pipe';
import { formatNumber } from 'src/app/utils/common';
import { each } from 'lodash';
import { FarmPair, PoolInfo, PriceInputOutput, ValonFarm } from 'src/app/interfaces/farm.interface';
import { REWARDS_PER_BLOCK } from 'src/app/constants/swap.constants';
import { PriceService } from 'src/app/services/price.service';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit {
  public posts: ValonPost[] = [];
  public showMore = false;
  public totalSupply: string;
  public difficulty: string;
  public maxDifficulty: string;
  public rewardsPerBlock: string;
  public totalRewards: string;
  public totalStakes: string;
  public apr = '0';
  public totalValueLockedInPairs = '0';

  constructor(
    private http: HttpClient,
    private publicService: PublicService,
    private priceService: PriceService,
  ) {

  }

  ngOnInit() {
    this.getPosts().pipe(take(1)).subscribe(res => {
      this.posts = res.items;
    });

    // stats
    zip(
      this.publicService.getDifficulty(),
      this.publicService.getMaxDifficulty(),
      this.publicService.getValonSupply(),
      this.publicService.getRewardsPerBlock(),
      this.publicService.getTotalRewards(),
      this.publicService.getValonPrice(),
      this.publicService.getActivePoolsCount(),
    ).pipe(take(1)).subscribe((res: any) => {
      const [difficulty, maxDifficulty, totalSupply, rewardsPerBlock, totalRewards, valonPrice, activePoolsCount] = res;
      this.totalSupply = formatNumber(BignumberToEthersPipe.trimDecimals(ethers.utils.formatEther(totalSupply), 2), ' ');
      this.rewardsPerBlock = formatNumber(BignumberToEthersPipe.trimDecimals(ethers.utils.formatEther(rewardsPerBlock), 2), ' ');
      this.difficulty = maxDifficulty.sub(difficulty).toString();
      this.maxDifficulty = maxDifficulty.toString();
      this.totalRewards = (parseFloat(ethers.utils.formatEther(totalRewards)) * valonPrice).toFixed(2);

        //farms
        this.publicService.buildTokenList();
        this.publicService.getPairList().pipe(take(1)).subscribe(pairlist => {
          const farmPairs = this.publicService.buildPairList(pairlist);
          console.log('PAIRS', farmPairs, pairlist)

          this.publicService.buildFarms(farmPairs).pipe(take(1)).subscribe(farms => {
            console.log('farms', farms)

            each(farms, farm => {
              let prices: PriceInputOutput = null;

              // bnb pair
              if (this.isBnbPair(farm)) {
                prices = this.getBnbPrices(farm);
              } else {
                // valon pair
                if (this.pairHasToken('VALO', farm)) {
                  prices = this.getValoPrices(farm, valonPrice.toString());
                } else {
                  // other than VALO or BNB pair
                  const pair = this.findPair(farms, farm.token0.symbol, ['VALO'])
                  || this.findPair(farms, farm.token1.symbol, ['VALO']);

                  if (pair) {
                    if (pair.token0.symbol === 'WBNB' || pair.token1.symbol === 'WBNB') {
                      const pricesFromBnb = this.getBnbPrices({
                        token0: pair.token0,
                        token1: pair.token1,
                        reserve0: pair.reserve0,
                        reserve1: pair.reserve1,
                        lptAddress: null
                      });

                      const output = farm.token0.symbol === pricesFromBnb.output.symbol
                      ? { token: farm.token1, reserve: farm.reserve1 }
                      : { token: farm.token0, reserve: farm.reserve0 };

                      prices = this.getTokenPrices(
                        {
                          token0: pricesFromBnb.output,
                          token1: output.token,
                          reserve0: pricesFromBnb.output.reserve,
                          reserve1: output.reserve,
                          lptAddress: null
                        },
                        pricesFromBnb.output.symbol,
                        pricesFromBnb.output.price
                      );
                    } else {
                      const pricesFromValo = this.getValoPrices(
                        {
                          token0: pair.token0,
                          token1: pair.token1,
                          reserve0: pair.reserve0,
                          reserve1: pair.reserve1,
                          lptAddress: null
                        },
                        valonPrice.toString()
                      );

                      const output = farm.token0.symbol === pricesFromValo.output.symbol
                      ? { token: farm.token1, reserve: farm.reserve1 }
                      : { token: farm.token0, reserve: farm.reserve0 };

                      prices = this.getTokenPrices(
                        {
                          token0: pricesFromValo.output,
                          token1: output.token,
                          reserve0: pricesFromValo.output.reserve,
                          reserve1: output.reserve,
                          lptAddress: null
                        },
                        pricesFromValo.output.symbol,
                        pricesFromValo.output.price
                      );
                    }
                  }
                }
              }

              if (prices && !ethers.BigNumber.from(farm.reserve0).isZero() && !ethers.BigNumber.from(farm.reserve1).isZero()) {
                zip(
                  this.publicService.getAvgPoolShare(farm.lptAddress),
                  this.publicService.getPoolInfo(farm.lptAddress),
                  this.publicService.getPairTotalSupply(farm.lptAddress),
                ).pipe(take(1)).subscribe(res => {
                  const [avgPoolShare, poolInfo, pairTotalSupply] = res;
                    this.updateFarmDetails(
                      farm,
                      prices,
                      pairTotalSupply,
                      difficulty,
                      maxDifficulty,
                      poolInfo,
                      activePoolsCount,
                      avgPoolShare,
                      valonPrice
                    );
                });
              } else {
                console.error('Prices couldnt be determined for the farm', prices, farm);
              }
            });
          }, (err) => {
            //this.handleError(err);
          });
          //this.reloadFarms(true);
        }, (err) => {
          //this.handleError(err);
        });
    });
  }

  public getBnbPrices(farm: ValonFarm | FarmPair ): {
    input: { symbol: string, reserve: ethers.BigNumber, price: string},
    output: { symbol: string, reserve: ethers.BigNumber, price: string}
  } {
    let inputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    let outputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    if (farm.token0.symbol === 'WBNB' || farm.token0.symbol === 'BNB') {
      inputToken = {
        symbol: 'BNB',
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: this.publicService.bnbPrice,
      }

      outputToken = {
        symbol: farm.token1.symbol,
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: '',
      }
    } else {
      inputToken = {
        symbol: 'BNB',
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: this.publicService.bnbPrice,
      }

      outputToken = {
        symbol: farm.token0.symbol,
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: '',
      }
    }

    outputToken.price = this.publicService.getOutputPrice(
      this.publicService.bnbPrice,
      inputToken.reserve,
      outputToken.reserve
    );

    return {
      input: inputToken,
      output: outputToken
    }
  }

  private findPair(pairsList: FarmPair[], inputSymbol: string, outputSymbols: string[]): FarmPair {
    let result: FarmPair = null;
    each(pairsList, pair => {
      if (inputSymbol === pair.token0.symbol || inputSymbol === pair.token1.symbol) {
        if (outputSymbols.includes(pair.token0.symbol) || outputSymbols.includes(pair.token1.symbol)) {
          if (!pair.reserve0.isZero() && !pair.reserve1.isZero()) {
            result = pair;
            return false;
          }
        }
      }
    });
    return result;
  }

  private updateFarmDetails(
    farm: ValonFarm,
    prices: PriceInputOutput,
    totalSupply: ethers.BigNumber,
    difficulty: number,
    maxDifficulty: number,
    poolInfo: PoolInfo,
    activePoolsCount: number,
    avgPoolShare: number,
    valonPrice: string,
  ) {
    const totalPairLiquidityValue = this.priceService.getTotalLiquidityPrice(
      prices.input.price,
      prices.output.price,
      prices.input.reserve,
      prices.output.reserve,
    );

    const stakeAmountEth = parseFloat(ethers.utils.formatEther(farm.stakeAmount));
    const totalPoolStakesEth = parseFloat(ethers.utils.formatEther(farm.totalPoolStakes));
    const totalSupplyEth = parseFloat(ethers.utils.formatEther(totalSupply));
    const poolStakeFromTotalSupply = totalPoolStakesEth / totalSupplyEth;
    const totalPoolLiquidityValue = parseFloat(totalPairLiquidityValue) * poolStakeFromTotalSupply;
    const bonus = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from('1000000000000000000').add(poolInfo.bonusMultiplier)));
    const difficultyVal = difficulty / maxDifficulty;

    const yearlyRewards = this.priceService.getEstimatedYearlyRewards(
      REWARDS_PER_BLOCK,                    // rewards per block
      activePoolsCount,                     // pool count
      bonus,                                // bonus
      difficultyVal,                        // difficulty
      avgPoolShare,                         // pool share
    );

    const apr = this.priceService.getApr(
      valonPrice,                             // valon price - using value from valon-bnb pool
      yearlyRewards,                          // yearly rewards
      avgPoolShare,                           // pool share
      totalPoolLiquidityValue.toString(),     // total liquidity
    );

    farm.liquidity = totalPoolLiquidityValue.toFixed(2);
    farm.pairLiquidity = totalPairLiquidityValue;
    farm.poolShare = (stakeAmountEth / totalPoolStakesEth * 100).toFixed(2);
    farm.apr = apr;

    if (parseFloat(apr) > parseFloat(this.apr)) {
      this.apr = apr;
    }

    let totalValueLocked = parseFloat(this.totalValueLockedInPairs);
    totalValueLocked += totalPoolLiquidityValue;
    this.totalValueLockedInPairs = totalValueLocked.toFixed(2);
  }

  private isBnbPair(farm: ValonFarm): boolean {
    return farm.token0.symbol === 'WBNB' || farm.token0.symbol === 'BNB' || farm.token1.symbol === 'WBNB' || farm.token1.symbol === 'BNB';
  }

  private pairHasToken(symbol: string, farm: ValonFarm): boolean {
    return farm.token0.symbol === symbol ||  farm.token1.symbol === symbol;
  }

  public getValoPrices(farm: ValonFarm | FarmPair, valoPrice: string): PriceInputOutput {
    let inputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    let outputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    if (farm.token0.symbol === 'VALO') {
      inputToken = {
        symbol: 'VALO',
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: valoPrice,
      }

      outputToken = {
        symbol: farm.token1.symbol,
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: '',
      }
    } else {
      inputToken = {
        symbol: 'VALO',
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: valoPrice,
      }

      outputToken = {
        symbol: farm.token0.symbol,
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: '',
      }
    }

    outputToken.price = this.priceService.getOutputPrice(
      valoPrice,
      inputToken.reserve,
      outputToken.reserve
    );

    return {
      input: inputToken,
      output: outputToken
    }
  }

  public getTokenPrices(farm: ValonFarm | FarmPair, inputSymbol: string, inputPrice: string): PriceInputOutput {
    let inputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    let outputToken = {
      symbol: '',
      reserve: ethers.BigNumber.from(0),
      price: '',
    }

    if (farm.token0.symbol === inputSymbol) {
      inputToken = {
        symbol: inputSymbol,
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: inputPrice,
      }

      outputToken = {
        symbol: farm.token1.symbol,
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: '',
      }
    } else {
      inputToken = {
        symbol: inputSymbol,
        reserve: ethers.BigNumber.from(farm.reserve1),
        price: inputPrice,
      }

      outputToken = {
        symbol: farm.token0.symbol,
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: '',
      }
    }

    outputToken.price = this.priceService.getOutputPrice(
      inputPrice,
      inputToken.reserve,
      outputToken.reserve
    );

    return {
      input: inputToken,
      output: outputToken
    }
  }

  public getPosts(): Observable<ValonFeed> {
    const endpoint = 'https://valon.info/index.php/feed/json/?cat=18';
    const httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
        withCredentials: false
    };

    return this.http.get<ValonFeed>(endpoint, httpOptions);
  }

  public toggleShowMore() {
    this.showMore = !this.showMore;
  }

}
