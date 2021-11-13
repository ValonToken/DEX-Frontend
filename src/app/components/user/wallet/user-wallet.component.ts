import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClipboardService } from 'ngx-clipboard';
import { first, switchMap, take } from 'rxjs/operators';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';
import 'sweetalert2/src/sweetalert2.scss';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import { UserService } from 'src/app/services/user.service';
import { from, of, zip } from 'rxjs';
import { SUPPORTED_COINS as supportedCoinsTest } from '../../../json/testnet/supported-coins.json';
import { SUPPORTED_COINS as supportedCoinsMain } from '../../../json/mainnet/supported-coins.json';
import { environment } from '../../../../environments/environment';
import { Coin } from 'src/app/interfaces/coins.interface';
import { each } from 'lodash';
import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { formatDecimals, WalletConnectorState, WalletConnectService } from 'src/app/services/wallet-connect.service';
import { ethers, providers } from 'ethers';
import { BEP20 } from 'src/app/abis/IBEP20.json';
import { CryptoService } from 'src/app/services/crypto.service';
import { DOCUMENT } from '@angular/common';

@AutoUnsubscribe()
@Component({
  selector: 'app-user-wallet',
  templateUrl: './user-wallet.component.html',
  styleUrls: ['./user-wallet.component.scss'],
})
export class UserWalletComponent implements OnInit, OnDestroy {
  public form: FormGroup;
  public loading = false;
  public supportedCoins = environment.production ? supportedCoinsMain : supportedCoinsTest;
  public supportedCoinsList: Coin[] = [];
  public state: WalletConnectorState;
  public toastMsg = '';
  public showAllAssets = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private clipboardService: ClipboardService,
    public toastEvent: ToastService,
    private walletConnectService: WalletConnectService,
    private cRef: ChangeDetectorRef,
    private cryptoService: CryptoService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.form = this.fb.group({
      publicKey: [''],
      bnbBalance: [],
      bnbDecimals: [],
    });
  }

  ngOnInit() {
    this.walletConnectService.state$.subscribe((state: WalletConnectorState) => {
      if (state && state.connected) {
        this.state = state;
        this.form.get('publicKey').setValue(state.address);
        this.buildCoinsList();
      }
      this.cRef.detectChanges();
    });
  }

  public buildCoinsList() {
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
      this.form.get('bnbBalance').setValue(this.cryptoService.formatCurrency(balance, 18));
      this.form.get('bnbDecimals').setValue(18);
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
          }
        });
      }
    });
  }

  public copyPublicKey() {
    this.clipboardService.copy(this.form.get('publicKey').value);
    this.toastMsg = 'Public key copied to clipboard';
    this.toastEvent.toast({uid: 'toastSuccess', delay: 4000});
  }

  public toggleShowAllAssets() {
    this.showAllAssets = !this.showAllAssets;
  }

  public registerToken(coin: Coin) {
    this.walletConnectService.registerToken(
      coin.address,
      coin.symbol,
      coin.data?.decimals || 18,
      document.location.origin + '/assets/images/tokens/' + coin.symbol.toLowerCase() + '.png'
    ).pipe(take(1)).subscribe(res => {
    });
  }

  

  ngOnDestroy() {
  }

}
