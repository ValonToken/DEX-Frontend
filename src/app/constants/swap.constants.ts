import { ChainId, JSBI, Percent} from '@pancakeswap/sdk';
import { DexSettings } from '../interfaces/common.interface';

export const REWARDS_PER_BLOCK = '4822530864197531000';
export const ONE_BIPS = new Percent(JSBI.BigInt(1), JSBI.BigInt(10000));
export const BIPS_BASE = JSBI.BigInt(10000);
export const ALLOWED_PRICE_IMPACT_LOW: Percent = new Percent(JSBI.BigInt(100), BIPS_BASE); // 1%
export const ALLOWED_PRICE_IMPACT_MEDIUM: Percent = new Percent(JSBI.BigInt(300), BIPS_BASE); // 3%
export const ALLOWED_PRICE_IMPACT_HIGH: Percent = new Percent(JSBI.BigInt(500), BIPS_BASE); // 5%
export const PRICE_IMPACT_WITHOUT_FEE_CONFIRM_MIN: Percent = new Percent(JSBI.BigInt(1000), BIPS_BASE); // 10%
export const BLOCKED_PRICE_IMPACT: Percent = new Percent(JSBI.BigInt(1500), BIPS_BASE); // 15%

// used to ensure the user doesn't send so much BNB so they end up with <.01
export const MIN_BNB: JSBI = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(16)); // .01 BNB
export const BETTER_TRADE_LESS_HOPS_THRESHOLD = new Percent(JSBI.BigInt(50), JSBI.BigInt(10000));

export const ZERO_PERCENT = new Percent('0');
export const BASE_FEE = new Percent(JSBI.BigInt(25), JSBI.BigInt(10000));
export const ONE_HUNDRED_PERCENT = new Percent(JSBI.BigInt(10000), JSBI.BigInt(10000));
export const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(BASE_FEE);
export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
};

export const BASE_BSC_SCAN_URLS = {
    [ChainId.MAINNET]: 'https://bscscan.com',
    [ChainId.TESTNET]: 'https://testnet.bscscan.com',
};

export const DEFAULT_SETTINGS: DexSettings = {
    deadline: 10,
    slippage: 0.1,
    gas: null,
    enableGasOverride: false,
}