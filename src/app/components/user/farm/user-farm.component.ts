import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import { debounce, debounceTime, first, switchMap, take } from 'rxjs/operators';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';
import 'sweetalert2/src/sweetalert2.scss';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import { UserService } from 'src/app/services/user.service';
import { from, Observable, of, Subscription, timer, zip } from 'rxjs';
import { DexSettings } from 'src/app/interfaces/common.interface';
import { SUPPORTED_COINS as supportedCoinsTest } from '../../../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../../../json/mainnet/supported-coins.json';
import { environment } from '../../../../environments/environment';
import { Coin } from 'src/app/interfaces/coins.interface';
import { each, orderBy } from 'lodash';
import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { formatDecimals, WalletConnectorState, WalletConnectService } from 'src/app/services/wallet-connect.service';
import { ethers, providers } from 'ethers';
import { BEP20 } from 'src/app/abis/IBEP20.json'; 
import { UiModalComponent } from 'src/app/theme/shared/components/modal/ui-modal/ui-modal.component';
import { LiquidityService } from 'src/app/services/liquidity.service';
import { PairReserves, PairToken } from 'src/app/interfaces/liquidity.interface';
import { TransactionError } from 'src/app/interfaces/errors.interface';
import { CryptoService } from 'src/app/services/crypto.service';
import { FormatNumberPipe } from 'src/app/pipes/format-number.pipe';
import { DecimalPipe } from '@angular/common';
import { bignumberDivToNum, bignumberMulByPercentageToEtherStr, formatNumber, getBscScanLink } from 'src/app/utils/common';
import { SettingsService } from 'src/app/services/settings.service';
import { SwapService } from 'src/app/services/swap.service';
import { Percent, Token, TokenAmount, Trade } from '@pancakeswap/sdk';
import { isNumeric } from 'rxjs/util/isNumeric';
import { StakingService } from 'src/app/services/staking.service';
import { FarmPair, PoolInfo, PriceInputOutput, ValonFarm } from 'src/app/interfaces/farm.interface';
import { PriceService } from 'src/app/services/price.service';
import { REWARDS_PER_BLOCK } from 'src/app/constants/swap.constants';

@AutoUnsubscribe()
@Component({
  selector: 'app-user-farm',
  templateUrl: './user-farm.component.html',
  styleUrls: ['./user-farm.component.scss'],
})
export class UserFarmComponent implements OnInit, OnDestroy {
  @ViewChild('modalDefault') modalDefault: UiModalComponent;
  @ViewChild('modalHelp') modalHelp: UiModalComponent;
  @ViewChild('modalStake') modalStake: UiModalComponent;
  
  public form: FormGroup;
  public settingsForm: FormGroup;
  public loading = false;
  public state: WalletConnectorState;
  public toastMsg: string;
  public farms: ValonFarm[] = [];
  public loadingFarms = false;
  public farmPairs: FarmPair[] = [];
  public selectedFarm: ValonFarm;
  public transactionMined = false;
  public updateFarmsId = null;
  public dialogType: 'ADD_STAKE' | 'REMOVE_STAKE' = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private clipboardService: ClipboardService,
    public toastEvent: ToastService,
    private walletConnectService: WalletConnectService,
    private liquidityService: LiquidityService,
    private cRef: ChangeDetectorRef,
    private cryptoService: CryptoService,
    private swapService: SwapService,
    private stakingService: StakingService,
    private priceService: PriceService,
  ) {
    this.form = this.fb.group({
      stakeAmount: [0, [Validators.required, Validators.pattern(/^\-?\d+((\.|\,)\d+)?$/)]],
      stakeRange: [0]
    });
  }

  ngOnInit() {
    this.loadingFarms = true;

    this.walletConnectService.state$.subscribe((state: WalletConnectorState) => {
      if (state && state.connected) {
        this.state = state;
        this.liquidityService.connect();
        this.stakingService.connect();

        //route
        this.swapService.buildTokenList();
        this.swapService.getPairList().pipe(take(1)).subscribe(pairlist => {
          this.farmPairs = this.stakingService.buildPairList(pairlist);
          console.log('PAIRS', this.farmPairs, pairlist)
          this.reloadFarms(true);
        }, (err) => {
          this.handleError(err);
        });
      }
    });

    this.registerFormListeners();
    const _this = this;
    this.updateFarmsId = setInterval(() => { _this.updateFarms(); }, 30000);
  }

  /*public updateValonPrice() {
    this.priceService.getValonPrice().pipe(take(1))
    .subscribe(price => {
      this.valonPrice = price;
    });
  }*/

  public registerFormListeners() {
    this.form.get('stakeRange').valueChanges
    .subscribe(res => {
      if (!this.selectedFarm) { return; }
      const max = this.dialogType === 'ADD_STAKE'
      ? parseFloat(ethers.utils.formatEther(this.selectedFarm.lptBalance))
      : parseFloat(ethers.utils.formatEther(this.selectedFarm.stakeAmount));

      if (res < 1) {
        this.form.get('stakeAmount').setValue(
          this.cryptoService.roundCurrency(res * max)
        );
      } else {
        if (this.dialogType === 'ADD_STAKE') {
          this.form.get('stakeAmount').setValue(
            ethers.utils.formatEther(this.selectedFarm.lptBalance)
          );
        } else {
          this.form.get('stakeAmount').setValue(
            ethers.utils.formatEther(this.selectedFarm.stakeAmount)
          );
        }
      }
    });

    this.form.get('stakeAmount').valueChanges
    .subscribe(res => {
      let val = parseFloat(res);
      if (Number.isNaN(val)) { val = -1; }

      const max = this.dialogType === 'ADD_STAKE'
      ? parseFloat(ethers.utils.formatEther(this.selectedFarm.lptBalance))
      : parseFloat(ethers.utils.formatEther(this.selectedFarm.stakeAmount));

      if (val > max) {
        if (this.dialogType === 'ADD_STAKE') {
          this.form.get('stakeAmount').setValue(ethers.utils.formatEther(this.selectedFarm.lptBalance));
        } else {
          this.form.get('stakeAmount').setValue(ethers.utils.formatEther(this.selectedFarm.stakeAmount));
        }
      }
      if (val < 0) { this.form.get('stakeAmount').setValue('', { emitEvent: false }); }
      this.form.get('stakeRange').setValue(
        val / max,
        { emitEvent: false }
      );
    });
  }

  public reloadFarms(showLoading: boolean) {
    if (showLoading) {
      this.loadingFarms = true;
    }
    if (this.farmPairs.length === 0) { return; }

    this.stakingService.buildFarms(this.farmPairs).pipe(take(1)).subscribe(res => {
      this.farms = res;
      this.updateFarms();
      console.log('farms', this.farms)
      if (showLoading) {
        this.loadingFarms = false;
      }
    }, (err) => {
      if (showLoading) {
        this.loadingFarms = false;
      }
      this.handleError(err);
    });
  }

  public handleError(err: TransactionError) {
    this.toastMsg = err.message;
    this.toastEvent.toast({uid: 'toastError', delay: 4000});
  }

  public handleSuccess(msg: string) {
    this.toastMsg = msg;
    this.toastEvent.toast({uid: 'toastSuccess', delay: 4000});
  }

  public getSymbol(token: Token): string {
    if (token.symbol.toUpperCase() === 'WBNB') {
      return 'BNB';
    } else {
      return token.symbol.toUpperCase();
    }
  }

  public getIcon(token: Token): string {
    let symbol = token.symbol.toLowerCase();
    if (symbol === 'bnb') { symbol = 'wbnb'; }
    return '../../assets/images/tokens/' + symbol + '.png';
  }

  public getBonus(value: ethers.BigNumber): string {
    return ((value.toNumber() / 10000) + 1).toFixed(2);
  }

  public getStake(value: ethers.BigNumber): string {
    return parseFloat(ethers.utils.formatEther(value)).toFixed(2);
  }

  public getLptBalance(value: ethers.BigNumber): string {
    return parseFloat(ethers.utils.formatEther(value)).toFixed(2);
  }

  public hasFarmAllowance(farm: ValonFarm): boolean {
    return farm.lptAllowance.gte(farm.lptBalance);
  }

  public approveFarm(farm: ValonFarm) {
    farm.unlocking = true;
    this.stakingService.setLptAllowance(farm.lptAddress, ethers.constants.MaxUint256)
    .pipe(take(1)).subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.handleSuccess(farm.token0.symbol + '-' + farm.token1.symbol + ' Farm was unlocked');
        this.reloadFarms(false);
        farm.unlocking = false;
      });
    }, (err: TransactionError) => {
      this.handleError(err);
      farm.unlocking = false;
    });
  }

  public openAddStakeModal(farm: ValonFarm) {
    this.selectedFarm = farm;
    this.dialogType = 'ADD_STAKE';
    this.selectedFarm.staking = false;
    this.transactionMined = false;
    this.form.get('stakeAmount').setValue(0);
    this.form.get('stakeRange').setValue(0);
    this.modalStake.show();
  }

  public openRemoveStakeModal(farm: ValonFarm) {
    this.selectedFarm = farm;
    this.dialogType = 'REMOVE_STAKE';
    this.selectedFarm.staking = false;
    this.transactionMined = false;
    this.form.get('stakeAmount').setValue(0);
    this.form.get('stakeRange').setValue(0);
    this.modalStake.show();
  }

  public addStake() {
    this.selectedFarm.staking = true;
    this.transactionMined = false;
    const amountWei = ethers.utils.parseEther(this.form.get('stakeAmount').value.toString());

    this.stakingService.addStake(this.selectedFarm.lptAddress, amountWei)
    .pipe(take(1)).subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.selectedFarm.staking = false;
        this.transactionMined = true;
        this.reloadFarms(false);
      });
    }, (err: TransactionError) => {
      this.handleError(err);
      this.selectedFarm.staking = false;
    });
  }

  public removeStake() {
    this.selectedFarm.staking = true;
    this.transactionMined = false;
    const amountWei = ethers.utils.parseEther(this.form.get('stakeAmount').value.toString());

    this.stakingService.removeStake(this.selectedFarm.lptAddress, amountWei)
    .pipe(take(1)).subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.selectedFarm.staking = false;
        this.transactionMined = true;
        this.reloadFarms(false);
      });
    }, (err: TransactionError) => {
      this.handleError(err);
      this.selectedFarm.staking = false;
    });
  }

  public updateFarms() {
    each(this.farms, farm => {
      zip(
        this.liquidityService.getPairTotalSupply(farm.lptAddress),
        this.priceService.getAvgPoolShare(farm.lptAddress),
        this.priceService.getBnbUsdt(),
        this.stakingService.getActivePoolsCount(),
        this.stakingService.getPoolInfo(farm.lptAddress),
        this.stakingService.getDifficulty(),
        this.stakingService.getMaxDifficulty(),
        this.priceService.getValonPrice(),
      ).pipe(take(1))
      .subscribe(res => {
        const [totalSupply, avgPoolShare, bnbPrice, activePoolsCount, poolInfo, difficulty, maxDifficulty, valonPrice] = res;
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
            const pair = this.findPair(this.farmPairs, farm.token0.symbol, ['VALO'])
            || this.findPair(this.farmPairs, farm.token1.symbol, ['VALO']);

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

        if (prices) {
          this.updateFarmDetails(
            farm,
            prices,
            totalSupply,
            difficulty,
            maxDifficulty,
            poolInfo,
            activePoolsCount,
            avgPoolShare,
            valonPrice
          );
        } else {
          console.error('Prices couldnt be determined for the farm', prices, farm);
        }
      });

      if (!farm.active) { return; }
      this.stakingService.getActualRewards(farm.lptAddress).pipe(take(1))
      .subscribe(rewards => {
        const oldReward = farm.actualRewards;
        const newReward = ethers.BigNumber.from(rewards);

        if (newReward.gt(oldReward)) {
          const intervalId = setInterval(() => {
            const increment = (newReward.sub(oldReward)).div(100);
            farm.actualRewards = farm.actualRewards.add(increment);
            if (farm.actualRewards.gte(newReward)) {
              farm.actualRewards = newReward;
              clearInterval(intervalId);
            }
          }, 10);
        }
        this.cRef.detectChanges();
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    });
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
  }

  private isBnbPair(farm: ValonFarm): boolean {
    return farm.token0.symbol === 'WBNB' || farm.token0.symbol === 'BNB' || farm.token1.symbol === 'WBNB' || farm.token1.symbol === 'BNB';
  }

  private pairHasToken(symbol: string, farm: ValonFarm): boolean {
    return farm.token0.symbol === symbol ||  farm.token1.symbol === symbol;
  }

  public getBnbPrices(farm: ValonFarm | FarmPair): PriceInputOutput {
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
        price: this.priceService.bnbPrice,
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
        price: this.priceService.bnbPrice,
      }

      outputToken = {
        symbol: farm.token0.symbol,
        reserve: ethers.BigNumber.from(farm.reserve0),
        price: '',
      }
    }

    outputToken.price = this.priceService.getOutputPrice(
      this.priceService.bnbPrice,
      inputToken.reserve,
      outputToken.reserve
    );

    return {
      input: inputToken,
      output: outputToken
    }
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


  public setStakeRange(range: number) {
    this.form.get('stakeRange').setValue(range);
  }

  public showDetails(farm: ValonFarm, show: boolean) {
    farm.showDetails = show;
  }

  public claimRewards(farm: ValonFarm) {
    farm.claiming = true;

    this.stakingService.claimRewards(farm.lptAddress)
    .pipe(take(1)).subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        farm.claiming = false;
        this.reloadFarms(false);
        this.handleSuccess('Rewards claimed');
      });
    }, (err: TransactionError) => {
      this.handleError(err);
      farm.claiming = false;
    });
  }

  public resetFarmAllowance(farm: ValonFarm) {
    this.stakingService.setLptAllowance(farm.lptAddress, ethers.BigNumber.from(0))
    .pipe(take(1)).subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.handleSuccess(farm.token0.symbol + '-' + farm.token1.symbol + ' Farm allowance resetted');
        this.reloadFarms(false);
      });
    }, (err: TransactionError) => {
      this.handleError(err);
    });
  }

  public openBscScanUrl(farm: ValonFarm) {
    window.open(getBscScanLink(farm.lptAddress, 'address'), '_blank');
  }

  public openHelp() {
    this.modalHelp.show();
  }

  ngOnDestroy() {
    clearInterval(this.updateFarmsId);
  }

}
