// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  server: 'http://localhost:3000',
  stellarNetwork: 'https://horizon-testnet.stellar.org',
  chainId: '97',
  bscNode1: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  bscNode2: 'https://data-seed-prebsc-2-s1.binance.org:8545',
  bscNode3: 'https://data-seed-prebsc-1-s2.binance.org:8545',
  factoryContract: '0x6725F303b657a9451d8BA641348b6761A6CC7a17',
  routerContract: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
  wbnbContract: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
  valonStakingContract: '0xEB232af9B7a5CFF63e4d36bfd68d207e188bdC00',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
