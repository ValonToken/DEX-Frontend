import { ChangeDetectorRef, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, first, map, retry, switchMap, take } from 'rxjs/operators';
import { GetWalletAddressResponse, LoggedInUser } from '../interfaces/user.interface';
import { CookieService } from 'ngx-cookie';
import { UpdateResponse } from '../interfaces/auth.interface';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { InjectedConnector } from '@web3-react/injected-connector';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import { BscConnector } from '@binance-chain/bsc-connector';
import {
    NoEthereumProviderError,
    UserRejectedRequestError as UserRejectedRequestErrorInjected,
} from '@web3-react/injected-connector';
import {
    UserRejectedRequestError as UserRejectedRequestErrorWalletConnect,
} from '@web3-react/walletconnect-connector';
import { ethers, providers, BigNumber } from 'ethers';

//exports
export class UnsupportedChainIdError extends Error {
    constructor() { super(); }
}

export class NoProviderError extends Error {
    constructor() { super(); }
}

export interface WalletConnectorState {
    connected: boolean;
    address: string;
}

export interface WindowChain {
    ethereum?: {
      isMetaMask?: true
      request?: (...args: any[]) => void
    }
}

export const LOCAL_STORAGE_KEY = 'VALONCONNECTOR';
export const LOCAL_STORAGE_VAL = {
    'INJECTED': 'injected',
    'WALLETCONNECT': 'walletconnect',
    'BSC': 'bsc'
};

export function formatDecimals(n: number | string, decimals: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
}

@Injectable({ providedIn: 'root' })
export class WalletConnectService {
    public web3Provider: providers.Web3Provider;
    public walletConnect: WalletConnectConnector;
    public injected: InjectedConnector;
    public injectedEthereum: any;
    public bscConnector: BscConnector;
    public selectedConnector: WalletConnectConnector | InjectedConnector | BscConnector;
    private dataSource = new BehaviorSubject<WalletConnectorState>(null);
    public state$ = this.dataSource.asObservable();
    private state: WalletConnectorState;
    public signer: ethers.providers.JsonRpcSigner;

    public POLLING_INTERVAL = 12000;
    public rpcUrl: string;
    public chainId: number;

    constructor(
        private http: HttpClient,
        private cookieService: CookieService,
    ) {
        this.injected = new InjectedConnector({ supportedChainIds: [this.chainId] });
        this.bscConnector = new BscConnector({ supportedChainIds: [this.chainId] });

        this.rpcUrl = this.getRpcAddress();
        this.chainId = parseInt(environment.chainId, 10);
        this.walletConnect = new WalletConnectConnector({
            rpc: { [this.chainId]: this.rpcUrl },
            bridge: 'https://bridge.walletconnect.org',
            qrcode: true,
            pollingInterval: this.POLLING_INTERVAL,
        });

        const connectorId = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (connectorId) {
            if (connectorId === 'injected') {
                this.injectedWallet().pipe(take(1))
                .subscribe(res => {
                    console.log('Connecting to Metamask automatically');
                }, (err) => {
                    console.error('Cannot connect to Metamask automatically');
                });
            } else if (connectorId === 'walletconnect') {
            } else if (connectorId === 'bsc') {
            }
        } else {
            this.state = {
                connected: false,
                address: ''
            };
            this.dataSource.next(this.state);
        }
    }

    public walletConnectWallet() {
        this.selectedConnector = this.walletConnect;
        
        this.walletConnect.activate().then(res => {
            console.log('connected')
        });

        this.walletConnect.on("connect", (code: number, reason: string) => {
            console.log('connected123')
        });
    }

    public injectedWallet(): Observable<any> {
        this.selectedConnector = this.injected;
        return from(this.injected.activate()).pipe(switchMap(res => {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, LOCAL_STORAGE_VAL['INJECTED']);

            // injected ethereum
            this.injectedEthereum = (window as WindowChain).ethereum;
            this.web3Provider = new providers.Web3Provider(this.injectedEthereum);
            if (!this.web3Provider) {
                return throwError('Provider not found');
            }

            this.signer = this.web3Provider.getSigner();
            if (parseInt(this.injectedEthereum.chainId, 16) != this.chainId) {
                return throwError('Unsupported chain! Add BSC network with chain id ' + this.chainId);
            }

            this.state = {
                connected: true,
                address: res.account
            };
            this.dataSource.next(this.state);

            // listeners
            this.injectedEthereum.on('connect', (res) => {
                console.log('connected', res)
            });
    
            this.injectedEthereum.on('disconnect', (res) => {
                console.log('disconnected', res)
            });

            this.injectedEthereum.on('close', (res) => {
                console.log('closed', res)
            });
    
            this.injectedEthereum.on('accountsChanged', (res) => {
                this.handleAccountsChanged(res);
            });
    
            this.injectedEthereum.on('chainChanged', (res) => {
                console.log('chainChanged', res)
            });

            return of(true);
        }));
    }

    public getBnbBalance(): Observable<ethers.BigNumber> {
        return from(this.web3Provider.getBalance(this.state.address));
    }

    public handleAccountsChanged(res) {
        console.log('handleAccountsChanged', res);
        if (!res.length) {
            this.disconnect();
            console.log('disconnected')
        }
    }

    public disconnect() {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        this.selectedConnector = null;
        this.state = {
            connected: false,
            address: ''
        };
        this.dataSource.next(this.state);
    }

    public getRpcAddress() {
        const str = 'bscNode' + (Math.floor(Math.random() * 2) + 1);
        return environment[str];
    }

    public setupNetwork(): Observable<any> {
        const netStr = environment.production ? 'Mainnet' : 'Testnet';
        const nodes = [environment.bscNode1, environment.bscNode2, environment.bscNode3];
        const provider: any = (window as WindowChain).ethereum;

        if (provider) {
            return of(provider.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${this.chainId.toString(16)}`,
                    chainName: 'Binance Smart Chain ' + netStr,
                    nativeCurrency: {
                      name: 'BNB',
                      symbol: 'bnb',
                      decimals: 18,
                    },
                    rpcUrls: nodes,
                    blockExplorerUrls: ['https://bscscan.com/'],
                  },
                ],
            }));
        }
        return of(false);
    }

    public registerToken(
        tokenAddress: string,
        tokenSymbol: string,
        tokenDecimals: number,
        tokenImage: string,
    ): Observable<any> {
        const provider: any = (window as WindowChain).ethereum;
        const tokenAdded = provider.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress,
                    symbol: tokenSymbol,
                    decimals: tokenDecimals,
                    image: tokenImage,
                },
            },
        });
        return of(tokenAdded);
    }

    public getState(): WalletConnectorState {
        return this.state;
    }

    public fileExists(url: string): Observable<boolean> {
        return this.http.get(url)
        .pipe(
            map(response => {
                return true;
            }),
            catchError(error => {
                return of(false);
            })
        );
    }
  

    /*public connect() {
        this.connector = new WalletConnect({
            bridge: 'https://bridge.walletconnect.org', // Required
            qrcodeModal: QRCodeModal,
        });
        console.log('connect')

        if (!this.connector.connected) {
            console.log('CREATE SESSION')
            // create new session
            this.connector.createSession().then(res => {
                console.warn('CREATE SESION THEN');
                this.subscribeEvents();
            });
        }
    }*/

    public test(from: string) {
        // Draft transaction
       /* const tx = {
            from: from, // Required
            to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359", // Required (for non contract deployments)
            data: "0x", // Required
            gasPrice: "0x02540be400", // Optional
            gas: "0x9c40", // Optional
            value: "0x00", // Optional
            nonce: "0x0114", // Optional
        };
        
        // Send transaction
        this.connector
        .sendTransaction(tx)
        .then((result) => {
            // Returns transaction id (hash)
            console.log('RESSI', result);
        })
        .catch((error) => {
            // Error returned when rejected
            console.error(error);
        });*/

        // Draft Custom Request
        /*const customRequest = {
            id: 1337,
            jsonrpc: "2.0",
            method: "bnb_sign",
            params: [{
                account_number: "34",
                chain_id: "Binance-Chain-Ganges",
                data: null,
                memo: "test",
                msgs: [
                    {
                    inputs: [
                        {
                            address: from,
                            coins: [
                                {
                                    amount: 1000000000,
                                    denom: "BNB",
                                },
                            ],
                        },
                    ],
                    outputs: [
                        {
                            address: "tbnb1ss57e8sa7xnwq030k2ctr775uac9gjzglqhvpy",
                            coins: [
                                {
                                    amount: 1000000000,
                                    denom: "BNB",
                                },
                            ],
                        },
                    ],
                    },
                ],
                sequence: "31",
                source: "1",
            }],
        };
        
        // Send Custom Request
        this.connector
        .sendCustomRequest(customRequest)
        .then((result) => {
            // Returns request result
            console.log(result);
        })
        .catch((error) => {
            // Error returned when rejected
            console.error(error);
        });*/
    }

    /*private subscribeEvents() {
        this.connector.on('connect', (error, payload) => {
            console.warn('WALLET CONNECTED');
            if (error) {
              throw error;
            }
          
            // Get provided accounts and chainId
            const { accounts, chainId } = payload.params[0];
            const state: WalletConnectorState = {
                connected: true,
                chainId: chainId,
                accounts: accounts,
                address: accounts[0]
            }
            this.dataSource.next(state);
            this.test(accounts[0]);
            console.warn('wallet info', accounts, chainId);
        });
    }*/
}
