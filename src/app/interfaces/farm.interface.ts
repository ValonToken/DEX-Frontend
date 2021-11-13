import { Token, TokenAmount } from '@pancakeswap/sdk';
import { BigNumber } from "@ethersproject/bignumber";

export interface PriceInputOutput {
    input: { symbol: string, reserve: BigNumber, price: string},
    output: { symbol: string, reserve: BigNumber, price: string}
}

export interface ValonFarm {
    lptAddress: string;
    totalPoolStakes: BigNumber;
    totalPoolRewards: BigNumber;
    bonusMultiplier: BigNumber;
    stakeHolderCount: BigNumber;
    active: boolean;
    lptBalance: BigNumber;
    lptAllowance: BigNumber;
    stakeAmount: BigNumber;
    actualRewards: BigNumber;
    liquidity: string;
    pairLiquidity: string;
    apy: string;
    apr: string;
    poolShare: string;
    token0: Token;
    token1: Token;
    reserve0: TokenAmount;
    reserve1: TokenAmount;
    unlocking: boolean;
    staking: boolean;
    claiming: boolean;
    showDetails: boolean;
}

export interface FarmPair {
    token0: any,
    token1: any,
    reserve0: any,
    reserve1: any,
    lptAddress: string,
}

export interface LptPair extends FarmPair {
    icon0: string;
    icon1: string;
    balance: BigNumber;
    allowance: BigNumber;
}

export interface PoolInfo {
    lpToken: string;         
    totalPoolStakes: string;
    totalPoolRewards: string;
    bonusMultiplier: string;
    active: boolean;
    stakeHolderCount: string;
}
