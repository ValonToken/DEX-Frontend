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
import { SUPPORTED_COINS as supportedCoinsTest } from '../../../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../../../json/mainnet/supported-coins.json';
import { environment } from '../../../../environments/environment';
import { Coin } from 'src/app/interfaces/coins.interface';
import { each, orderBy } from 'lodash';
import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { formatDecimals, WalletConnectorState, WalletConnectService } from 'src/app/services/wallet-connect.service';
import { ethers, providers } from 'ethers';
import { BEP20 } from 'src/app/abis/IBEP20.json'; 
import { UniswapV2Pair } from 'src/app/abis/IUniswapV2Pair.json'; 
import { UiModalComponent } from 'src/app/theme/shared/components/modal/ui-modal/ui-modal.component';
import { LiquidityService } from 'src/app/services/liquidity.service';
import { PairReserves, PairToken } from 'src/app/interfaces/liquidity.interface';
import { TransactionError } from 'src/app/interfaces/errors.interface';
import { CryptoService } from 'src/app/services/crypto.service';
import { FormatNumberPipe } from 'src/app/pipes/format-number.pipe';
import { DecimalPipe } from '@angular/common';
import { formatNumber } from 'src/app/utils/common';
import { isNumeric } from 'rxjs/util/isNumeric';
import { SwapService } from 'src/app/services/swap.service';
import { StakingService } from 'src/app/services/staking.service';
import { FarmPair, LptPair } from 'src/app/interfaces/farm.interface';

@AutoUnsubscribe()
@Component({
  selector: 'app-user-lpt',
  templateUrl: './user-lpt.component.html',
  styleUrls: ['./user-lpt.component.scss'],
})
export class UserLptComponent implements OnInit, OnDestroy {
  @ViewChild('modalDefault') modalDefault: UiModalComponent;
  @ViewChild('modalHelp') modalHelp: UiModalComponent;
  @ViewChild('modalAllowance') modalAllowance: UiModalComponent;
  
  public form: FormGroup;
  public loading = false;
  public loadingPairs = false;
  public loadingAllowance = false;
  public loadingMined = false;
  public loadingPair = false;
  public isNewPair = false;
  public pairLoaded = false;
  public transactionMined = false;
  public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
  public supportedCoinsMap: { [address: string]: Coin } = {};
  public supportedCoinsList: Coin[] = [];
  public supportedCoinsListFiltered: Coin[] = [];
  public coinsLoaded = 0;
  public state: WalletConnectorState;
  public selectedCoinIndex: number; // 0 or 1
  public pairList: PairToken[] = [];
  public toastMsg: string;
  public pairReserves: PairReserves;
  public pairInfo: { address: string, token1Amount: string, token2Amount: string, ownedLiquidity: string, totalLiquidity: string } = null;
  public addingLiquidity = false;
  public removingLiquidity = false;
  public removeLiquidityBN: ethers.BigNumber;
  public removeLiquidityHasAllowance = false;
  public allowances: { coin1Allowance: ethers.BigNumber, coin2Allowance: ethers.BigNumber, lptAllowance: ethers.BigNumber} = {
    coin1Allowance: ethers.BigNumber.from(0),
    coin2Allowance: ethers.BigNumber.from(0),
    lptAllowance: ethers.BigNumber.from(0)
  };
  public lptPairs: LptPair[] = [];
  public lptPairsFiltered: LptPair[] = [];
  public selectedLpt: LptPair;
  public resettingAllowance = false;

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
  ) {
    this.form = this.fb.group({
      coin1Amount: [0],
      coin1Range: [0],
      coin1Approved: [true],
      coin1: [],
      coin2Amount: [0],
      coin2Range: [0],
      coin2Approved: [true],
      coin2: [],
      selectedCoin: [],
      selectedCoinAmount: [0],
      selectedCoinRange: [0],
      search: [''],
      removeLiquidityRange: [0],
      removeLiquidity: ['0'],
      lptRange: [0],
      lptAmount: ['0'],
    });
  }

  ngOnInit() {
    this.loadingPairs = true;
    this.buildSupportedCoinsMap();

    this.walletConnectService.state$.subscribe((state: WalletConnectorState) => {
      if (state && state.connected) {
        this.state = state;
        this.liquidityService.connect();
        this.stakingService.connect();
        this.swapService.buildTokenList();
        this.loadLptPairs();
      }
      this.cRef.detectChanges();
    });

    this.registerFormListeners();
  }

  private loadLptPairs() {
    this.form.get('lptRange').setValue(0, { emitEvent: false });
    this.form.get('lptAmount').setValue('0', { emitEvent: false });
    this.swapService.getPairList().pipe(take(1)).subscribe(pairlist => {
      const farmPairs = this.stakingService.buildPairList(pairlist);
      const list$: Observable<[string, any, any]>[] = [];
      each(farmPairs, farmPair => {
        const contract = new ethers.Contract(
          farmPair.lptAddress,
          JSON.stringify(UniswapV2Pair.abi), this.walletConnectService.web3Provider
        );

        list$.push(
          zip(
            of(farmPair.lptAddress),
            from(contract.balanceOf(this.state.address)),
            this.liquidityService.getAllowance(contract)
          )
        );
      });

      zip(...list$).pipe(take(1))
      .subscribe(res => {
        const balanceMap = {};
        each(res, value => {
          const [address, balance, allowance] = value;
          balanceMap[address] = { balance: balance, allowance: allowance };
        });

        const lpts: LptPair[] = [];
        farmPairs.forEach(farmPair => {
          const pair: LptPair = {
            token0: farmPair.token0,
            token1: farmPair.token1,
            reserve0: farmPair.reserve0,
            reserve1: farmPair.reserve1,
            lptAddress: farmPair.lptAddress,
            icon0: '../../../../assets/images/tokens/' + farmPair.token0.symbol.toLowerCase() + '.png',
            icon1: '../../../../assets/images/tokens/' + farmPair.token1.symbol.toLowerCase() + '.png',
            balance: balanceMap[farmPair.lptAddress].balance,
            allowance: balanceMap[farmPair.lptAddress].allowance,
          }

          if (this.selectedLpt && this.selectedLpt.lptAddress === pair.lptAddress) {
            this.selectedLpt = pair;
          }

          lpts.push(pair);
        });

        this.lptPairs = lpts;
        this.loadingPairs = false;
        this.filterLpt('');
        console.log('PAIRS', this.lptPairs, pairlist, res)
      });
    }, (err) => {
      this.loadingPairs = false;
      this.handleError(err);
    });
  }

  public registerFormListeners() {
    this.form.get('search').valueChanges
    .subscribe(res => {
      this.filterLpt(res);
    });

    // lpt
    this.form.get('lptRange').valueChanges
    .subscribe(res => {
      if (!this.selectedLpt?.balance) { return; }
      const max = parseFloat(ethers.utils.formatEther(this.selectedLpt.balance));

      if (res < 1) {
        this.form.get('lptAmount').setValue(
          this.cryptoService.roundCurrency(res * max)
        );
      } else {
        this.form.get('lptAmount').setValue(ethers.utils.formatEther(this.selectedLpt.balance));
      }
    });

    this.form.get('lptAmount').valueChanges
    .subscribe(res => {
      if (!this.selectedLpt?.balance) { return; }
      const max = parseFloat(ethers.utils.formatEther(this.selectedLpt.balance));
      if (Number.isNaN(res) || !isNumeric(res)) { res = -1; }
      if (res > max) {
        this.form.get('lptAmount').setValue(ethers.utils.formatEther(this.selectedLpt.balance));
      }
      if (res < 0) { this.form.get('lptAmount').setValue(0); }
      this.form.get('lptRange').setValue(
        this.form.get('lptAmount').value / max,
        { emitEvent: false }
      );
    });

    // coin2
    this.form.get('coin2Range').valueChanges
    .subscribe(res => {
      this.form.get('coin2Amount').setValue(
        this.cryptoService.roundCurrency(res * this.form.get('coin2').value?.data?.balance)
      );
    });

    this.form.get('coin2Amount').valueChanges
    .subscribe(res => {
      if (Number.isNaN(res) || !isNumeric(res)) { res = -1; }
      if (res > this.form.get('coin2')?.value?.data?.balance) {
        this.form.get('coin2Amount').setValue(this.form.get('coin2')?.value?.data?.balance);
      }
      if (res < 0) { this.form.get('coin2Amount').setValue(0); }
      this.form.get('coin2Range').setValue(
        this.form.get('coin2Amount').value / this.form.get('coin2')?.value?.data?.balance,
        { emitEvent: false }
      );
    });

    this.form.get('coin2Amount').valueChanges
    .pipe(debounceTime(200))
    .subscribe(res => {
      const coin2 = this.form.get('coin2')?.value as Coin;
      this.isCoinApproved(coin2, 2);
      if (this.coinsSelected()) {
        this.adjustCoinRatio(0);
        const coin1 = this.form.get('coin1')?.value as Coin;
        this.isCoinApproved(coin1, 1);
      }
    });

    // selected coin
    this.form.get('selectedCoinRange').valueChanges
    .subscribe(res => {
      this.form.get('selectedCoinAmount').setValue(
        this.cryptoService.roundCurrency(res * this.form.get('selectedCoin').value?.data?.balance)
      );
    });

    this.form.get('selectedCoinAmount').valueChanges
    .subscribe(res => {
      if (Number.isNaN(res)) { res = -1; }
      if (res > this.form.get('selectedCoin')?.value?.data?.balance) {
        this.form.get('selectedCoinAmount').setValue(this.form.get('selectedCoin')?.value?.data?.balance);
      }
      if (res < 0) { this.form.get('selectedCoinAmount').setValue(0); }
    });

    //remove liquidity
    this.form.get('removeLiquidityRange').valueChanges
    .subscribe(res => {
      if (!this.pairReserves?.ownedLiquidity || this.pairReserves?.ownedLiquidity?.isZero()) {
        this.form.get('removeLiquidity').setValue('0');
        return; 
      }

      const val = ethers.BigNumber.from(res * 1000);
      this.removeLiquidityBN = val.mul(this.pairReserves.ownedLiquidity).div(1000);
      this.form.get('removeLiquidity').setValue(
        formatNumber(ethers.utils.formatEther(this.removeLiquidityBN), ' ')
      );
    });
  }

  public buildSupportedCoinsMap() {
    Object.entries(this.supportedCoins).forEach(coin => {
      this.supportedCoinsMap[coin[1].address.toUpperCase()] = {
        name: coin[0],
        symbol: coin[1].symbol,
        address: coin[1].address,
        icon: coin[1].icon,
        decimals: coin[1].decimals,
      }
    });
    console.log('this.supportedCoinsMap', this.supportedCoinsMap)
  }

  /**
   * zip[0] = list of pair addresses
   * zip[1] = list of token addresses for the pair
   * @param pairAddressList 
   * @returns 
   */
  public buildPairList(pairAddressList: string[]): Observable<PairToken[]> {
    return zip(
      of(pairAddressList),
      this.liquidityService.getTokenAddressList()
    ).pipe(first(), switchMap(pairToken => {
      let i = 0;
      const pairList: PairToken[] = [];
      for (let pairAddress of pairToken[0]) {
        const tokenAddress1 = pairToken[1][i][0].toUpperCase();
        const tokenAddress2 = pairToken[1][i][1].toUpperCase();
        if (this.supportedCoinsMap[tokenAddress1] && this.supportedCoinsMap[tokenAddress2]) {
          pairList.push({
            pairAddress: pairAddress,
            tokens: {
              token0: pairToken[1][i][0],
              token1: pairToken[1][i][1]
            }
          });
        }
        i++;
      }
      return of(pairList);
    }));
  }

  public buildCoinsList() {
    this.loading = true;
    this.supportedCoinsList = [];
    
    each(Object.entries(this.supportedCoins), (coin) => {
      this.supportedCoinsList.push({
        address: coin[1].address,
        symbol: coin[1].symbol,
        name: coin[0],
        icon: coin[1].icon,
        contract: coin[1].address ? new ethers.Contract(coin[1].address, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider) : null
      });
    });

    this.walletConnectService.getBnbBalance()
    .pipe(first())
    .subscribe(balance => {
      this.supportedCoinsList.unshift({
        address: '',
        symbol: 'BNB',
        name: 'Binance',
        icon: '',
        data: {
          balance: this.cryptoService.formatCurrency(balance, 18),
          decimals: 18
        },
        contract: null
      });

      each(this.supportedCoinsList, coin => {
        if(coin.contract) {
          zip(
            from(coin.contract.balanceOf(this.state.address)),
            from(coin.contract.decimals()),
          )
          .pipe(first())
          .subscribe(res => {
            if (res && res[0] && res[1]) {
              const balance = res[0] as ethers.BigNumber;
              const decimals = res[1] as number;
              if (!coin.data) { coin.data = {}; }
              coin.data.balance = this.cryptoService.formatCurrency(balance, decimals);
              coin.data.decimals = decimals;
              coin.icon = '../../../../assets/images/tokens/' + coin.symbol.toLowerCase() + '.png';
              this.loadCoin();
            }
          });
        }
      });
    });
  }

  public loadCoin() {
    this.coinsLoaded++;
    if (this.coinsLoaded >= this.supportedCoinsList.length - 1) {
      this.loading = false;
      this.filterCoins('');
      this.cRef.detectChanges();
    }
  }

  public filterCoins(str: string) {
    console.warn('this.supportedCoinsList', this.supportedCoinsList)
    if (!str) { this.supportedCoinsListFiltered = this.supportedCoinsList; }
    this.supportedCoinsListFiltered = this.supportedCoinsList.filter(
      coin => (coin.name + ' ' + coin.symbol).toLowerCase().indexOf(str.toLowerCase()) !== -1
      && coin.address !== this.form.get('coin1')?.value?.address
      && coin.address !== this.form.get('coin2')?.value?.address
    );
    this.supportedCoinsListFiltered = orderBy(this.supportedCoinsListFiltered, ['name'], ['asc']);
  }

  public filterLpt(str: string, haveBalance = true) {
    if (!str) { this.supportedCoinsListFiltered = this.supportedCoinsList; }
    this.lptPairsFiltered = this.lptPairs.filter(
      pair => (pair.token0.symbol + ' ' + pair.token1.symbol + ' ' + pair.token0.name + ' ' + pair.token1.name)
      .toLowerCase().indexOf(str.toLowerCase()) !== -1
    );

    if (haveBalance) {
      this.lptPairsFiltered = this.lptPairsFiltered.filter(
        pair => !pair.balance.isZero()
      );
    }
    this.lptPairsFiltered = orderBy(this.lptPairsFiltered, ['token0']['name'], ['asc']);
  }

  public selectCoin(coin: Coin) {
    if (this.selectedCoinIndex === 0) {
      this.form.get('coin1').setValue(coin);
      this.form.get('coin1Amount').setValidators([Validators.min(0), Validators.max(coin.data.balance)]);
      this.form.get('coin1Range').setValue(0);
      this.isCoinApproved(coin, 1);

    } else if (this.selectedCoinIndex === 1) {
      this.form.get('coin2').setValue(coin);
      this.form.get('coin2Amount').setValidators([Validators.min(0), Validators.max(coin.data.balance)]);
      this.form.get('coin2Range').setValue(0);
      this.isCoinApproved(coin, 2);
    }
    this.modalShow(false, -1);

    if (this.coinsSelected()) {
      this.reloadPairData();
    }
  }

  public selectLpt(lpt: LptPair) {
    this.selectedLpt = lpt;
    this.modalDefault.hide();
    console.log('lp', lpt)
  }

  public coinsSelected(): boolean {
    return this.form.get('coin1').value && this.form.get('coin2').value;
  }

  public coinsHaveAmountSet(): boolean {
    return this.form.get('coin1Amount')?.value > 0 && this.form.get('coin2Amount')?.value > 0;
  }

  public resetInfoBox() {
    this.loadingPair = false;
    this.isNewPair = false;
    this.pairLoaded = false;
    this.pairInfo = null;
    this.pairReserves = null;
    this.allowances  = {
      coin1Allowance: ethers.BigNumber.from(0),
      coin2Allowance: ethers.BigNumber.from(0),
      lptAllowance: ethers.BigNumber.from(0)
    };
    this.cRef.detectChanges();
  }

  public isCoinApproved(coin: Coin, coinIndex: number) {
    const str = coinIndex === 1 ? 'coin1' : 'coin2';
    if (!coin) { return; }
    if (coin.symbol === 'BNB') { this.form.get(str + 'Approved').setValue(true); this.cRef.detectChanges(); return; }
    if (!coin.contract) { this.form.get(str + 'Approved').setValue(false); this.cRef.detectChanges(); return; }

    this.liquidityService.getAllowance(coin.contract).pipe(first())
    .subscribe(allowanceWei => {
      console.warn('allowancewei222', allowanceWei)
      const val = this.form.get(str + 'Amount')?.value?.toString();
      if (!val) { return; }
      const amountWei = ethers.utils.parseEther(val);
      const hasAllowance = !allowanceWei.sub(amountWei).isNegative() && !allowanceWei.isZero();
      this.allowances['coin' + coinIndex + 'Allowance'] = allowanceWei;
      console.warn('allowanceWei', amountWei.toString(), allowanceWei.toString())

      if (hasAllowance) {
        console.warn('APPROVED', coinIndex)
        this.form.get(str + 'Approved').setValue(true);
      } else {
        console.warn('DISAPPROVED', coinIndex)
        this.form.get(str + 'Approved').setValue(false);
      }

      this.cRef.detectChanges();
    });
  }

  public reloadApproved() {
    const coin1 = this.form.get('coin1').value as Coin;
    const coin2 = this.form.get('coin2').value as Coin;
    if (coin1 && coin2) {
      this.isCoinApproved(coin1, 0);
      this.isCoinApproved(coin2, 1);
      this.cRef.detectChanges();
    }
  }

  public removeCoin(index: number) {
    this.resetInfoBox();
    if (index === 0) {
      this.form.get('coin1').setValue(null);
      this.form.get('coin1Amount').setValue(0);
      this.form.get('coin1Range').setValue(0);
    } else if (index === 1) {
      this.form.get('coin2').setValue(null);
      this.form.get('coin2Amount').setValue(0);
      this.form.get('coin2Range').setValue(0);
    }
  }

  public modalShow(visible: boolean, coinIndex: number) {
    if (visible) {
      this.filterLpt('');
      this.selectedCoinIndex = coinIndex;
      this.modalDefault.show();
    } else {
      this.selectedCoinIndex = null;
      this.modalDefault.hide();
    }
  }

  public openAllowanceDialog(coinIndex: number) {
    this.resetLoaders();
    if (coinIndex === 0) {
      this.form.get('selectedCoin').setValue(
        this.form.get('coin1').value
      );
      this.form.get('selectedCoinRange').setValue(
        this.form.get('coin1Range').value
      );
      this.form.get('selectedCoinAmount').setValue(
        this.form.get('coin1Amount').value
      );
    } else {
      this.form.get('selectedCoin').setValue(
        this.form.get('coin2').value
      );
      this.form.get('selectedCoinRange').setValue(
        this.form.get('coin2Range').value
      );
      this.form.get('selectedCoinAmount').setValue(
        this.form.get('coin2Amount').value
      );
    }
    this.modalAllowance.show();
  }

  public setAllowance(type: 'MAX' | 'ZERO') {
    this.loadingAllowance = true;
    const lptContract = new ethers.Contract(
      this.selectedLpt.lptAddress,
      JSON.stringify(UniswapV2Pair.abi), this.walletConnectService.web3Provider
    );
    
    const val = type === 'MAX' ? ethers.constants.MaxUint256 : ethers.constants.Zero;
    this.liquidityService.setAllowance(lptContract, val)
    .pipe(first())
    .subscribe(tx => {
      this.loadingAllowance = false;
      this.loadingMined = true;

      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.loadingMined = false;
        this.transactionMined = true;
        this.loadLptPairs();
      });
    }, (err: TransactionError) => {
      this.handleError(err);
    });
  }

  public handleError(err: TransactionError) {
    this.resetLoaders();
    this.toastMsg = err.message;
    this.toastEvent.toast({uid: 'toastError', delay: 4000});
  }

  public handleSuccess(msg: string) {
    this.resetLoaders();
    this.toastMsg = msg;
    this.toastEvent.toast({uid: 'toastSuccess', delay: 4000});
  }

  public resetLoaders() {
    this.loadingMined = false;
    this.loadingAllowance = false;
    this.loadingPairs = false;
    this.transactionMined = false;
  }

  public adjustCoinRatio(targetCoinIndex: number) {
    console.warn('this.form.get)', this.form.get('coin1').value)
    if (targetCoinIndex === 0) {
      if (!this.pairReserves) { return; }
      const ratio = this.pairReserves.coin1Amount / this.pairReserves.coin2Amount;
      const newAmount = this.form.get('coin2Amount').value * ratio;
      const range = newAmount / this.form.get('coin1').value.data.balance;
      console.log('coin1 new val', newAmount, range)
      this.form.get('coin1Amount').setValue(newAmount, { emitEvent: false });
      this.form.get('coin1Range').setValue(range, { emitEvent: false });
    } else {
      if (!this.pairReserves) { return; }
      const ratio = this.pairReserves.coin2Amount / this.pairReserves.coin1Amount;
      const newAmount = this.form.get('coin1Amount').value * ratio;
      const range = newAmount / this.form.get('coin2').value.data.balance;
      console.log('coin2 new val', newAmount, range)
      this.form.get('coin2Amount').setValue(newAmount, { emitEvent: false });
      this.form.get('coin2Range').setValue(range, { emitEvent: false });
    }
    this.cRef.detectChanges();
  }

  public addLiquidity() {
    const isBNB = this.form.get('coin1').value.symbol === 'BNB' || this.form.get('coin2').value.symbol === 'BNB';
    if (isBNB) {
      this.addingLiquidity = true;
      const tokenKey = this.form.get('coin1').value.symbol === 'BNB' ? 'coin2' : 'coin1';
      const bnbKey = this.form.get('coin1').value.symbol === 'BNB' ? 'coin1' : 'coin2';

      const connectState = this.walletConnectService.getState();
      const data = {
        tokenAddress: this.form.get(tokenKey).value.address,
        tokenAmount: ethers.utils.parseEther(this.form.get(tokenKey + 'Amount').value.toString()),
        amountTokenMin: ethers.BigNumber.from('0'),
        amountETHMin: ethers.BigNumber.from('0'),
        lpTokensToAddress: connectState.address,
        deadline: Date.now() + 360,
        overrides: { value: ethers.utils.parseEther(this.form.get(bnbKey + 'Amount').value.toString()) }
      };

      this.liquidityService.addLiquidityBNB(
        data.tokenAddress,
        data.tokenAmount,
        data.amountTokenMin,
        data.amountETHMin,
        data.lpTokensToAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.addingLiquidity = false;
          this.handleSuccess('Liquidity added');
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.addingLiquidity = false;
        this.handleError(err);
      });
    } else {
      this.addingLiquidity = true;
      const connectState = this.walletConnectService.getState();
      const data = {
        token1Address: this.form.get('coin1').value.address,
        token2Address: this.form.get('coin2').value.address,
        token1Amount: ethers.utils.parseEther(this.form.get('coin1Amount').value.toString()),
        token2Amount: ethers.utils.parseEther(this.form.get('coin2Amount').value.toString()),
        amountToken1Min: ethers.BigNumber.from('0'),
        amountToken2Min: ethers.BigNumber.from('0'),
        lpTokensToAddress: connectState.address,
        deadline: Date.now() + 360,
        overrides: {}
      };

      this.liquidityService.addLiquidity(
        data.token1Address,
        data.token2Address,
        data.token1Amount,
        data.token2Amount,
        data.amountToken1Min,
        data.amountToken2Min,
        data.lpTokensToAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.addingLiquidity = false;
          this.handleSuccess('Liquidity added');
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.addingLiquidity = false;
        this.handleError(err);
      });
    }
  }

  public reloadPairData() {
    this.resetInfoBox();
    this.loadingPair = true;
    this.pairLoaded = true;
    this.form.get('coin1Range').setValue(0);
    this.form.get('coin2Range').setValue(0);
    this.form.get('removeLiquidityRange').setValue(0);

    const coin1 = this.form.get('coin1').value as Coin;
    const coin2 = this.form.get('coin2').value as Coin;
    const address1 = coin1?.symbol === 'BNB' ? this.supportedCoins['Wrapped BNB'].address : coin1.address;
    const address2 = coin2?.symbol === 'BNB' ? this.supportedCoins['Wrapped BNB'].address : coin2.address;

    this.liquidityService.getPair(address1, address2)
      .pipe(first())
      .subscribe(pairAddress => {
        console.warn('pairAddress', pairAddress)
        if (pairAddress == ethers.constants.AddressZero) {
          this.resetInfoBox();
          this.isNewPair = true;
          this.pairLoaded = true;
        } else {
          // reserves
          zip(
            this.liquidityService.getPairLiquidity(pairAddress),
            this.liquidityService.getPairTotalSupply(pairAddress),
            this.liquidityService.getReserves(address1, address2),
          ).pipe(first())
          .subscribe(res => {
            console.warn('RESSSSSI', res)
            const [ownedLiquidity, totalSupply, reserves] = res;
            const token0 = this.supportedCoinsMap[reserves[0].toUpperCase()];
            const token1 = this.supportedCoinsMap[reserves[1].toUpperCase()];

            this.pairReserves = { ...reserves[2] };
            if (this.pairReserves.reserve0.isZero() || this.pairReserves.reserve1.isZero()) {
              this.resetInfoBox();
              this.isNewPair = true;
              this.pairLoaded = true;
              return;
            }

            this.pairReserves.data = {};
            this.pairReserves.data[token0.address.toUpperCase()] = this.cryptoService.formatCurrency(this.pairReserves.reserve0, token0.decimals);
            this.pairReserves.data[token1.address.toUpperCase()] = this.cryptoService.formatCurrency(this.pairReserves.reserve1, token1.decimals);
            this.pairReserves.coin1Amount = this.pairReserves.data[address1.toUpperCase()];
            this.pairReserves.coin2Amount = this.pairReserves.data[address2.toUpperCase()];
            this.pairReserves.ownedLiquidity = ownedLiquidity.isZero() ? null : ownedLiquidity;
            this.pairReserves.totalSupply = totalSupply;
            this.pairReserves.poolShare = totalSupply.isZero() ? 0 : ownedLiquidity.mul(10000).div(totalSupply).toNumber() / 100;

            const coinReserves = {};
            coinReserves[token0.address.toUpperCase()] = this.pairReserves.reserve0;
            coinReserves[token1.address.toUpperCase()] = this.pairReserves.reserve1;
            this.pairReserves.data[token1.address.toUpperCase()] = this.cryptoService.formatCurrency(this.pairReserves.reserve1, token1.decimals);
            this.pairInfo = {
              address: pairAddress,
              token1Amount: formatNumber(ethers.utils.formatEther(coinReserves[address1.toUpperCase()]), ' '),
              token2Amount: formatNumber(ethers.utils.formatEther(coinReserves[address2.toUpperCase()]), ' '),
              ownedLiquidity: formatNumber(ethers.utils.formatEther(ownedLiquidity), ' '),
              totalLiquidity: formatNumber(ethers.utils.formatEther(totalSupply), ' ')
            };
            console.warn('ownedLiquidity', ownedLiquidity.toString(), this.pairReserves.ownedLiquidity)
            console.warn('totalSupply', totalSupply.toString())
            console.warn('this.pairReserves.poolShare', this.pairReserves.poolShare.toString())
            console.warn('this.pairReserves.coin1Amount', this.pairReserves.coin1Amount.toString())
            console.warn('this.pairReserves.coin2Amount', this.pairReserves.coin2Amount.toString())
            console.warn('this.pairReserves.reserve0', this.pairReserves.reserve0.toString())
            console.warn('this.pairReserves.reserve1', this.pairReserves.reserve1.toString())
            console.warn('reserves', this.pairReserves, this.pairReserves.reserve0.toString(), this.pairReserves.reserve1.toString())
            console.warn('this.pairInfo', this.pairInfo)

            const lpContract = new ethers.Contract(pairAddress, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider);
            this.removeLiquidityHasAllowance = false;
            this.liquidityService.getAllowance(lpContract).pipe(first())
            .subscribe(lpAllowance => {
              this.allowances.lptAllowance = lpAllowance;
              this.removeLiquidityHasAllowance = !lpAllowance.isZero();
              this.cRef.detectChanges();
            });
            this.loadingPair = false;
            this.cRef.detectChanges();
          }, (err) => { this.loadingPair = false; });
        }
      }, (err) => { this.loadingPair = false; });
  }

  public reloadCoinAndPairData() {
    this.buildCoinsList();
    this.reloadPairData();
  }

  public removeLiquidity() {
    const isBNB = this.selectedLpt.token0.symbol === 'WBNB' || this.selectedLpt.token1.symbol === 'WBNB';
    if (isBNB) {
      const tokenBnb = this.selectedLpt.token0.symbol === 'WBNB' ? this.selectedLpt.token0 : this.selectedLpt.token1;
      const token = this.selectedLpt.token0.symbol !== 'WBNB' ? this.selectedLpt.token0 : this.selectedLpt.token1;

      const connectState = this.walletConnectService.getState();
      const data = {
        tokenAddress: token.address,
        liquidityAmount: ethers.utils.parseEther(this.form.get('lptAmount').value?.toString()),
        amountTokenMin: ethers.BigNumber.from('0'),
        amountETHMin: ethers.BigNumber.from('0'),
        tokensToAddress: connectState.address,
        deadline: Date.now() + 360,
        overrides: {}
      };

      this.removingLiquidity = true;
      this.liquidityService.removeLiquidityBNB(
        data.tokenAddress,
        data.liquidityAmount,
        data.amountTokenMin,
        data.amountETHMin,
        data.tokensToAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.removingLiquidity = false;
          this.handleSuccess('Liquidity removed');
          this.loadLptPairs();
        });
      }, (err: TransactionError) => {
        this.removingLiquidity = false;
        this.handleError(err);
      });
    } else {
      const connectState = this.walletConnectService.getState();
      const data = {
        token1Address: this.selectedLpt.token0.address,
        token2Address: this.selectedLpt.token1.address,
        liquidityAmount: ethers.utils.parseEther(this.form.get('lptAmount').value?.toString()),
        amountToken1Min: ethers.BigNumber.from('0'),
        amountToken2Min: ethers.BigNumber.from('0'),
        tokensToAddress: connectState.address,
        deadline: Date.now() + 360,
        overrides: {}
      };

      this.removingLiquidity = true;
      this.liquidityService.removeLiquidity(
        data.token1Address,
        data.token2Address,
        data.liquidityAmount,
        data.amountToken1Min,
        data.amountToken2Min,
        data.tokensToAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.removingLiquidity = false;
          this.handleSuccess('Liquidity removed');
          this.loadLptPairs();
        });
      }, (err: TransactionError) => {
        this.removingLiquidity = false;
        this.handleError(err);
      });
    }
  }

  public setAllowanceForLiquidity() {
    const lpContract = new ethers.Contract(this.pairInfo.address, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider);
    this.liquidityService.setAllowance(lpContract, ethers.constants.MaxUint256)
    .pipe(first())
    .subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.removeLiquidityHasAllowance = true;
        this.handleSuccess('Allowance set for Liquidity Pool Token');
        this.cRef.detectChanges();
      });
    }, (err: TransactionError) => {
      this.handleError(err);
    });
  }

  public resetLPAllowances() {
    this.resettingAllowance = true;
    const lpContract = new ethers.Contract(this.selectedLpt.lptAddress, JSON.stringify(UniswapV2Pair.abi), this.walletConnectService.web3Provider);
    this.liquidityService.setAllowance(lpContract, ethers.BigNumber.from(0))
    .pipe(first())
    .subscribe(tx => {
      this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
        this.handleSuccess('Resetted Liquidity Pool Token allowance');
        this.resettingAllowance = false;
        this.loadLptPairs();
      });
    }, (err: TransactionError) => {
      this.handleError(err);
      this.resettingAllowance = false;
    });
  }

  public resetCoin1Allowances() {
    if (this.form.get('coin1').value.symbol !== 'BNB') {
      const tokenContract = new ethers.Contract(this.form.get('coin1').value.address, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider);
      this.liquidityService.setAllowance(tokenContract, ethers.BigNumber.from(0))
      .pipe(first())
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.handleSuccess('Resetted ' + this.form.get('coin1').value.symbol + ' allowance');
        });
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    }
  }

  public resetCoin2Allowances() {
    if (this.form.get('coin2').value.symbol !== 'BNB') {
      const tokenContract = new ethers.Contract(this.form.get('coin2').value.address, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider);
      this.liquidityService.setAllowance(tokenContract, ethers.BigNumber.from(0))
      .pipe(first())
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.handleSuccess('Resetted ' + this.form.get('coin2').value.symbol + ' allowance');
        });
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    }
  }

  public setCoinRange(coin: number, range: number) {
    if (coin === 3) { this.form.get('removeLiquidityRange')?.setValue(range); return; }
    this.form.get('coin' + coin + 'Range')?.setValue(range);
  }

  public setLptRange(coin: number, range: number) {
    if (coin === 3) { this.form.get('lptRange')?.setValue(range); return; }
    this.form.get('lptRange')?.setValue(range);
  }

  public hasAllowances(): boolean {
    if (this.selectedLpt.allowance.isZero()) { return false; }
    const lptAmount = ethers.utils.parseEther(this.form.get('lptAmount').value.toString());
    return this.selectedLpt.allowance.gte(lptAmount);
  }

  public setDefaultIcon(coin: Coin) {
    if (coin.symbol.toLowerCase() === 'bnb') {
      coin.icon = '../../../../assets/images/tokens/wbnb.png';
      return;
    }
    coin.icon = '../../../../assets/images/tokens/empty.png';
  }

  public copyPairAddress() {
    this.clipboardService.copy(this.pairInfo?.address);
    this.handleSuccess('Pair address copied to clipboard');
  }

  public openHelp() {
    this.modalHelp.show();
  }

  ngOnDestroy() {
  }

}
