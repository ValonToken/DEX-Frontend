import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';
import { WalletConnectorState, WalletConnectService } from 'src/app/services/wallet-connect.service';
import { UiModalComponent } from 'src/app/theme/shared/components/modal/ui-modal/ui-modal.component';
import { environment } from '../../../../../../environments/environment';
import { AutoUnsubscribe } from 'ngx-auto-unsubscribe';
import { PriceService } from 'src/app/services/price.service';
import { take } from 'rxjs/operators';
import { LiquidityService } from 'src/app/services/liquidity.service';
import { ethers } from 'ethers';
import { interval } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';
import { PublicService } from 'src/app/services/public.service';

@AutoUnsubscribe()
@Component({
  selector: 'app-nav-right',
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [NgbDropdownConfig]
})
export class NavRightComponent implements OnInit, OnDestroy {
  @ViewChild('modalDefault') modalDefault: UiModalComponent;

  public state: WalletConnectorState;
  public env = environment;
  public valonPrice: number;
  public toastMsg = '';

  constructor(
    private walletConnectService: WalletConnectService,
    private cRef: ChangeDetectorRef,
    private publicService: PublicService,
    private router: Router,
    public toastEvent: ToastService,
  ) { }

  ngOnInit() {
    this.walletConnectService.state$.subscribe((state: WalletConnectorState) => {
      this.state = state;
      if (state && state.connected) {
      }

      this.updateValonPrice();
      interval(60000).subscribe(() => {
        this.updateValonPrice();
      });

      this.cRef.detectChanges();
    });
  }

  public setupNetwork() {
    this.walletConnectService.setupNetwork().pipe(take(1))
    .subscribe(res => {
      this.toastMsg = 'Network added to Metamask';
      this.toastEvent.toast({uid: 'toastSuccessNavRight', delay: 4000});
    }, (err) => {
      console.error(err);
    });
  }

  public updateValonPrice() {
    this.publicService.getValonPrice().pipe(take(1))
    .subscribe(price => {
      this.valonPrice = price;
    });
  }

  public modalShow(visible: boolean) {
    if (visible) { this.modalDefault.show(); }
    else { this.modalDefault.hide(); }
  }

  public connectWallet(id: number) {
    switch(id) {
      case 1:
        this.walletConnect();
      break;

      case 2:
        this.injectedWallet();
      break;

      case 3:
      break;

      case 4:
      break;

      default:
      break;
    }
  }

  public logout() {
    this.walletConnectService.disconnect();
    this.cRef.detectChanges();
    this.router.navigate(['/dashboard']);
  }

  public walletConnect() {
    this.walletConnectService.walletConnectWallet();
  }

  public injectedWallet() {
      this.walletConnectService.injectedWallet().pipe(take(1))
      .subscribe(res => {
        console.log(res)
      }, (err) => {
        console.log('e', err)
        this.toastMsg = err;
        this.toastEvent.toast({uid: 'toastErrorNavRight', delay: 4000});
      });

  }

  ngOnDestroy() {
    throw new Error('Method not implemented.');
  }
}
