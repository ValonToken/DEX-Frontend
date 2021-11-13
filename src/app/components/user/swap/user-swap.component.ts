import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import { debounce, debounceTime, first, switchMap, take } from 'rxjs/operators';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';
import 'sweetalert2/src/sweetalert2.scss';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import { UserService } from 'src/app/services/user.service';
import { from, interval, Observable, of, Subscription, timer, zip } from 'rxjs';
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
import { Percent, Trade } from '@pancakeswap/sdk';
import { isNumeric } from 'rxjs/util/isNumeric';

@AutoUnsubscribe()
@Component({
  selector: 'app-user-swap',
  templateUrl: './user-swap.component.html',
  styleUrls: ['./user-swap.component.scss'],
})
export class UserSwapComponent implements OnInit, OnDestroy {
  @ViewChild('modalDefault') modalDefault: UiModalComponent;
  @ViewChild('modalHelp') modalHelp: UiModalComponent;
  @ViewChild('modalAllowance') modalAllowance: UiModalComponent;
  @ViewChild('modalSettings') modalSettings: UiModalComponent;
  
  public form: FormGroup;
  public settingsForm: FormGroup;
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
  public trades: Trade[] = [];
  public swapping = false;
  public moreDetails = false;
  public pairAddress = null;
  public interval$ = null;
  public loadingPreselectedCoins = false;

  public allowances: { coin1Allowance: ethers.BigNumber, coin2Allowance: ethers.BigNumber, lptAllowance: ethers.BigNumber} = {
    coin1Allowance: ethers.BigNumber.from(0),
    coin2Allowance: ethers.BigNumber.from(0),
    lptAllowance: ethers.BigNumber.from(0)
  };

  public tokenInfo = {
    inputValueBN: ethers.BigNumber.from(0),
    outputValueBN: ethers.BigNumber.from(0),
    outputValueMaxBN: ethers.BigNumber.from(0),
    price: '',
    price2: '',
    minimumReceived: '',
    slippage: '',
    priceImpact: '',
    priceImpactColor: '',
    liquidityFee: '',
    route: '',
  };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private clipboardService: ClipboardService,
    public toastEvent: ToastService,
    private walletConnectService: WalletConnectService,
    private liquidityService: LiquidityService,
    private cRef: ChangeDetectorRef,
    private cryptoService: CryptoService,
    private settingsService: SettingsService,
    private swapService: SwapService,
    private activatedRoute: ActivatedRoute,
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
    });

    this.settingsForm = this.fb.group({
      deadline:  [{value: 0}, Validators.required],
      slippage:  [{value: 0}, Validators.required],
      gas:  [{value: 0}, Validators.required],
      gasGwei:  [''],
      enableGas: [false],
    });
  }

  ngOnInit() {
    this.loadingPairs = true;
    this.activatedRoute.queryParams.subscribe(params => {
      if (params.token1 && params.token2) {
        this.loadingPreselectedCoins = true;
      }
    });
    this.buildSupportedCoinsMap();

    this.walletConnectService.state$.subscribe((state: WalletConnectorState) => {
      if (state && state.connected) {
        this.state = state;
        this.buildCoinsList();
        this.liquidityService.connect();
        this.loadSettings();

        //update output token
        this.interval$ = interval(10000).subscribe(() => {
          if (this.coinsSelected() && this.swapService.tokens.length > 0) {
            this.swapService.getPairList().pipe(take(1)).subscribe(pairlist => {
              this.swapService.buildPairList(pairlist);
              this.getCoinOutputAmount();
              this.cRef.detectChanges();
            }, (err) => {
              console.error('interval: this.swapService.getPairList()', err);
              this.handleError({code: 0, message: 'Error updating the token prices', stack: null});
            });
          }
        });
      }
      this.cRef.detectChanges();
    });

    this.registerFormListeners();
  }

  private updateTokens() {
    this.swapService.buildTokenList();
    this.swapService.getPairList().pipe(take(1)).subscribe(pairlist => {
      this.swapService.buildPairList(pairlist);
      this.activatedRoute.queryParams.subscribe(params => {
        if (params.token1 && params.token2) {
          this.loadCoins(params.token1, params.token2);
        }
      });
      console.log('PAIRS', this.swapService.pairs, pairlist)
    }, (err) => {
      console.error('this.swapService.getPairList()', err);
      this.handleError({code: 0, message: 'Error updating the token prices', stack: null});
    });
  }

  private loadCoins(address1: string, address2: string) {
    let coin1 = this.supportedCoinsList.find(coin => coin.address.toUpperCase() === address1.toUpperCase());
    let coin2 = this.supportedCoinsList.find(coin => coin.address.toUpperCase() === address2.toUpperCase());
    if (coin1.symbol === 'WBNB') { coin1 = this.supportedCoinsList[0]; }
    if (coin2.symbol === 'WBNB') { coin2 = this.supportedCoinsList[0]; }

    if (coin1 && coin2) {
      this.selectedCoinIndex = 0;
      this.selectCoin(coin1);
      this.selectedCoinIndex = 1;
      this.selectCoin(coin2);
      this.loadingPreselectedCoins = false;
    }
  }

  public registerFormListeners() {
    this.form.get('search').valueChanges
    .subscribe(res => {
      this.filterCoins(res);
    });

    // coin1
    this.form.get('coin1Range').valueChanges
    .subscribe(res => {
      this.form.get('coin1Amount').setValue(
        this.cryptoService.roundCurrency(res * this.form.get('coin1').value?.data?.balance)
      );
    });

    this.form.get('coin1Amount').valueChanges
    .subscribe(res => {
      if (Number.isNaN(res) || !isNumeric(res)) { res = -1; }
      if (res > this.form.get('coin1')?.value?.data?.balance) {
        this.form.get('coin1Amount').setValue(this.form.get('coin1')?.value?.data?.balance);
      }
      if (res < 0) { this.form.get('coin1Amount').setValue(0); }
      this.form.get('coin1Range').setValue(
        this.form.get('coin1Amount').value / this.form.get('coin1')?.value?.data?.balance,
        { emitEvent: false }
      );
    });

    this.form.get('coin1Amount').valueChanges
    .pipe(debounceTime(200))
    .subscribe(res => {
      const coin1 = this.form.get('coin1')?.value as Coin;
      const coin2 = this.form.get('coin2')?.value as Coin;
      this.isCoinApproved(coin1, 1);
      this.isCoinApproved(coin2, 2);
      if (this.coinsSelected()) {
        if (this.form.get('coin1Amount').value <= 0) {
          this.resetInfoBox();
        } else {
          this.getCoinOutputAmount();
          this.pairLoaded = true;
        }
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

    //gas
    this.settingsForm.get('gas').valueChanges
    .subscribe(res => {
      if (res) {
        this.settingsForm.get('gasGwei').setValue(ethers.utils.formatUnits(res.toString(), 'gwei'));
        this.cRef.detectChanges();
      }
    });
  }

  public getCoinOutputAmount() {
    if (this.form.get('coin1Amount')?.value <= 0) { return; }

    //route
    const coinInput: Coin = {
      address: this.form.get('coin1').value.address || this.supportedCoins['Wrapped BNB'].address,
      name: this.form.get('coin1').value.name,
      symbol: this.form.get('coin1').value.symbol,
      decimals: this.form.get('coin1').value.decimals,
      icon: '',
    }

    const coinOutput: Coin = {
      address: this.form.get('coin2').value.address || this.supportedCoins['Wrapped BNB'].address,
      name: this.form.get('coin2').value.name,
      symbol: this.form.get('coin2').value.symbol,
      decimals: this.form.get('coin2').value.decimals,
      icon: '',
    }

    //update pair address
    this.liquidityService.getPair(coinInput.address, coinOutput.address)
    .pipe(first())
    .subscribe(pairAddress => {
      this.pairAddress = pairAddress;
    });

    const coin1InputAmountBN = ethers.utils.parseEther(this.form.get('coin1Amount')?.value?.toString());

    this.trades = this.swapService.getRouteIn(
      this.swapService.pairs,
      coinInput,
      coinOutput,
      coin1InputAmountBN
    );
    console.warn('trades', this.trades)

    if (this.trades?.length > 0) {
      this.trades.sort(function(a, b) {
        return a.route.path.length - b.route.path.length;
      });

      const trade = this.trades[0];
      const tradePriceBreakdown = this.swapService.computeTradePriceBreakdown(trade);

      // set info
      this.tokenInfo.inputValueBN = ethers.utils.parseEther(this.form.get('coin1Amount')?.value?.toString());
      this.tokenInfo.outputValueBN = ethers.utils.parseEther(trade.outputAmount.toFixed(18));
      this.tokenInfo.slippage = this.settingsForm.get('slippage')?.value?.toString();
      this.tokenInfo.price = bignumberDivToNum(this.tokenInfo.inputValueBN, this.tokenInfo.outputValueBN).toFixed(18);
      this.tokenInfo.price2 = bignumberDivToNum(this.tokenInfo.outputValueBN, this.tokenInfo.inputValueBN).toFixed(18);
      this.tokenInfo.priceImpact = trade.priceImpact.toFixed(2);
      this.tokenInfo.priceImpactColor = this.priceImpactToColor(trade.priceImpact);
      this.tokenInfo.liquidityFee = tradePriceBreakdown.realizedLPFee.toSignificant(4);
      this.tokenInfo.route = 'Route: ' + this.swapService.getRoutePathStr(trade, this.form.get('coin1').value.symbol, this.form.get('coin2').value.symbol);

      this.tokenInfo.minimumReceived = bignumberMulByPercentageToEtherStr(
        this.tokenInfo.outputValueBN,
        this.settingsForm.get('slippage').value
      );
    }
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
      this.updateTokens();
      this.loading = false;
      this.filterCoins('');
      this.cRef.detectChanges();
    }
  }

  public filterCoins(str: string) {
    if (!str) { this.supportedCoinsListFiltered = this.supportedCoinsList; }
    this.supportedCoinsListFiltered = this.supportedCoinsList.filter(
      coin => (coin.name + ' ' + coin.symbol).toLowerCase().indexOf(str.toLowerCase()) !== -1
      && coin.address !== this.form.get('coin1')?.value?.address
      && coin.address !== this.form.get('coin2')?.value?.address
    );
    this.supportedCoinsListFiltered = orderBy(this.supportedCoinsListFiltered, ['name'], ['asc']);
  }

  public selectCoin(coin: Coin) {
    if (this.selectedCoinIndex === 0) {
      this.form.get('coin1').setValue(coin);
      this.form.get('coin1Amount').setValidators([Validators.min(0), Validators.max(coin.data.balance)]);
      this.form.get('coin1Range').setValue(0);
      this.isCoinApproved(coin, 1);
    } else if (this.selectedCoinIndex === 1) {
      this.form.get('coin1Amount').setValue(0);
      this.form.get('coin2').setValue(coin);
      this.form.get('coin2Amount').setValidators([Validators.min(0), Validators.max(coin.data.balance)]);
      this.form.get('coin2Range').setValue(0);
      this.isCoinApproved(coin, 2);
    }
    this.modalShow(false, -1);
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
    this.tokenInfo = {
      inputValueBN: ethers.BigNumber.from(0),
      outputValueBN: ethers.BigNumber.from(0),
      outputValueMaxBN: ethers.BigNumber.from(0),
      price: '',
      price2: '',
      minimumReceived: '',
      slippage: '',
      priceImpact: '',
      priceImpactColor: '',
      liquidityFee: '',
      route: '',
    }
    this.trades = [];
    this.cRef.detectChanges();
  }

  public isCoinApproved(coin: Coin, coinIndex: number) {
    console.warn('iscoinapproved', coin)
    const str = coinIndex === 1 ? 'coin1' : 'coin2';
    if (!coin) { return; }
    if (coin.symbol === 'BNB') { this.form.get(str + 'Approved').setValue(true); this.cRef.detectChanges(); return; }
    if (!coin.contract) { this.form.get(str + 'Approved').setValue(false); this.cRef.detectChanges(); return; }

    this.liquidityService.getAllowance(coin.contract).pipe(first())
    .subscribe(allowanceWei => {
      const amountWei = this.tokenInfo.outputValueBN;
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
      this.filterCoins('');
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

  public setAllowance(isMax?: boolean) {
    const coin = this.form.get('selectedCoin').value as Coin;
    this.loadingAllowance = true;
    if (isMax) {
      this.liquidityService.setAllowance(coin.contract, ethers.constants.MaxUint256)
      .pipe(first())
      .subscribe(tx => {
        this.loadingAllowance = false;
        this.loadingMined = true;

        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.loadingMined = false;
          this.transactionMined = true;
          this.reloadApproved();
        });
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    } else {
      const amountInWei = ethers.utils.parseEther(Math.ceil(this.form.get('selectedCoinAmount').value).toString());
      console.log('SET ALLOWANCE', amountInWei)
      this.liquidityService.setAllowance(coin.contract, amountInWei)
      .pipe(first())
      .subscribe(tx => {
        this.loadingAllowance = false;
        this.loadingMined = true;

        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.loadingMined = false;
          this.transactionMined = true;
          this.reloadApproved();
        });
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    }
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

  /*public reloadPairData() {
    this.resetInfoBox();
    this.loadingPair = true;
    this.pairLoaded = true;
    this.form.get('coin1Range').setValue(0);
    this.form.get('coin2Range').setValue(0);

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

            this.loadingPair = false;
            this.cRef.detectChanges();
          }, (err) => { this.loadingPair = false; });
        }
      }, (err) => { this.loadingPair = false; });
  }*/

  public reloadCoinAndPairData() {
    this.buildCoinsList();
    this.form.get('coin1Range').setValue(0);
  }

  public resetCoin1Allowances() {
    if (this.form.get('coin1').value.symbol !== 'BNB') {
      const tokenContract = new ethers.Contract(this.form.get('coin1').value.address, JSON.stringify(BEP20.abi), this.walletConnectService.web3Provider);
      this.liquidityService.setAllowance(tokenContract, ethers.BigNumber.from(0))
      .pipe(first())
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.handleSuccess('Resetted ' + this.form.get('coin1').value.symbol + ' allowance');
          this.reloadCoinAndPairData();
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
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.handleError(err);
      });
    }
  }

  public setCoinRange(coin: number, range: number) {
    this.form.get('coin' + coin + 'Range')?.setValue(range);
  }

  public hasAllowances(): boolean {
    return !this.allowances.coin1Allowance.isZero() || !this.allowances.coin2Allowance.isZero() || !this.allowances.lptAllowance.isZero();
  }

  public openSettings() {
    this.modalSettings.show();
  }

  public closeSettings() {
    if (!isNumeric(this.settingsForm.get('deadline').value) || this.settingsForm.get('deadline').value <= 0
    || !isNumeric(this.settingsForm.get('slippage').value) ||this.settingsForm.get('slippage').value <= 0
    || !isNumeric(this.settingsForm.get('gas').value) || this.settingsForm.get('gas').value <= 0) {
      const err: TransactionError = {
        code: 0,
        message: 'Fields have invalid values',
        stack: null
      };
      this.handleError(err);
      return;
    }

    const settings = {
      deadline: this.settingsForm.get('deadline').value,
      slippage: this.settingsForm.get('slippage').value,
      gas: this.settingsForm.get('gas').value,
      enableGasOverride: this.settingsForm.get('enableGas').value,
    } as DexSettings;

    this.settingsService.updateSettings(settings);
    this.settingsService.saveSettings();

    if (this.coinsSelected()) {
      this.getCoinOutputAmount();
    }

    this.modalSettings.hide();
  }

  public loadSettings() {
    this.settingsService.loadSettings();
    const settings = this.settingsService.getSettings();
    this.setSettings(settings);
  }

  public setSettings(settings: DexSettings, save = false) {
    this.settingsForm.get('deadline').setValue(settings.deadline);
    this.settingsForm.get('slippage').setValue(settings.slippage);
    this.settingsForm.get('gas').setValue(settings.gas);
    this.settingsForm.get('enableGas').setValue(settings.enableGasOverride);

    if (!settings?.gas || settings?.gas <= 0) {
      this.settingsService.estimateGas().pipe(take(1))
      .subscribe(gasBN => {
        this.settingsService.settings.gas = gasBN.toNumber();
        this.settingsForm.get('gas').setValue(gasBN.toNumber());
        if (save) { this.settingsService.saveSettings(); }
      });
    }
  }

  public priceImpactToColor(priceImpact: Percent) {
    const warningId = this.swapService.warningSeverity(priceImpact);
    if (warningId <= 1) { return 'text-success' }
    if (warningId === 2) { return 'text-warning' }
    if (warningId === 3) { return 'text-warning' }
    if (warningId === 4) { return 'text-danger' }
    return 'text-success';
  }

  public swapTokens() {
    const inputToken = this.form.get('coin1').value as Coin;
    const outputToken = this.form.get('coin2').value as Coin;
    const timestampDeadline = Date.now() + (this.settingsForm.get('deadline').value * 60);
    const gasPrice = ethers.BigNumber.from(this.settingsForm.get('gas').value);
    const trade = this.trades[0];
    this.swapping = true;

    //BNB - Token
    if (inputToken.symbol === 'BNB') {
      const bnbAmount = ethers.utils.parseEther(this.form.get('coin1Amount').value.toString());
      const overrides = { value: bnbAmount };
      if (this.settingsForm.get('enableGas').value) {
        Object.assign(overrides, { gasPrice: gasPrice });
      }

      const data = {
        amountInMin: ethers.utils.parseEther(this.tokenInfo.minimumReceived),
        path: trade.route.path.map(token => token.address),
        recipientAddress: this.walletConnectService.getState().address,
        deadline: timestampDeadline,
        overrides: overrides
      };

      this.swapService.swapBNBForToken(
        data.amountInMin,
        data.path,
        data.recipientAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.swapping = false;
          this.handleSuccess('Tokens swapped');
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.swapping = false;
        this.handleError(err);
      });
    // Token - BNB
    } else if(outputToken.symbol === 'BNB') {
      const overrides = {};
      if (this.settingsForm.get('enableGas').value) {
        Object.assign(overrides, { gasPrice: gasPrice });
      }

      const data = {
        amountIn: this.tokenInfo.inputValueBN,
        amountInMin: ethers.utils.parseEther(this.tokenInfo.minimumReceived),
        path: trade.route.path.map(token => token.address),
        recipientAddress: this.walletConnectService.getState().address,
        deadline: timestampDeadline,
        overrides: overrides
      };

      this.swapService.swapTokenForBNB(
        data.amountIn,
        data.amountInMin,
        data.path,
        data.recipientAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.swapping = false;
          this.handleSuccess('Tokens swapped');
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.swapping = false;
        this.handleError(err);
      });
    // Token - Token
    } else {
      const overrides = {};
      if (this.settingsForm.get('enableGas').value) {
        Object.assign(overrides, { gasPrice: gasPrice });
      }

      const data = {
        amountIn: this.tokenInfo.inputValueBN,
        amountInMin: ethers.utils.parseEther(this.tokenInfo.minimumReceived),
        path: trade.route.path.map(token => token.address),
        recipientAddress: this.walletConnectService.getState().address,
        deadline: timestampDeadline,
        overrides: overrides
      };

      this.swapService.swapTokenForToken(
        data.amountIn,
        data.amountInMin,
        data.path,
        data.recipientAddress,
        data.deadline,
        data.overrides
      ).pipe(take(1))
      .subscribe(tx => {
        this.walletConnectService.web3Provider.once(tx.hash, (transaction) => {
          this.swapping = false;
          this.handleSuccess('Tokens swapped');
          this.reloadCoinAndPairData();
        });
      }, (err: TransactionError) => {
        this.swapping = false;
        this.handleError(err);
      });
    }
  }

  public resetSettings() {
    this.settingsService.resetToDefault();
    const settings = this.settingsService.getSettings();
    this.setSettings(settings, true);
  }

  public setSlippage(slippage: number) {
    this.settingsForm.get('slippage').setValue(slippage);
  }

  public setGasPrice(speed: number) {
    this.settingsService.estimateGas().pipe(take(1))
    .subscribe(gasBN => {
      const gas = Math.round(gasBN.toNumber() * speed);
      this.settingsForm.get('gas').setValue(gas);
    });
  }

  public setDefaultIcon(coin: Coin) {
    if (coin.symbol.toLowerCase() === 'bnb') {
      coin.icon = '../../../../assets/images/tokens/wbnb.png';
      return;
    }
    coin.icon = '../../../../assets/images/tokens/empty.png';
  }

  public toggleMoreDetails() {
    this.moreDetails = !this.moreDetails;
  }

  public openBscScanUrl(address: string) {
    if (!address) { address = this.supportedCoins['Wrapped BNB'].address; }
    window.open(getBscScanLink(address, 'address'), '_blank');
  }

  public openHelp() {
    this.modalHelp.show();
  }

  ngOnDestroy() {
    this.interval$?.unsubscribe();
  }

}
