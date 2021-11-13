import { BigNumber } from "@ethersproject/bignumber"

export interface PairToken {
    pairAddress: string;
    tokens: {
        token0: string;
        token1: string;
    }
}

export interface PairReserves {
    blockTimestampLast: number;
    reserve0: BigNumber;
    reserve1: BigNumber;
    coin1Amount: number;
    coin2Amount: number;
    totalSupply: BigNumber;
    totalSupplyStr: string;
    ownedLiquidity: BigNumber;
    ownedLiquidityStr: string;
    poolShare: number;
    data: {
        [address: string]: number
    }
}
