import { ChainId } from '@pancakeswap/sdk';
import { ethers } from 'ethers';
import { BASE_BSC_SCAN_URLS } from '../constants/swap.constants';
import { environment } from '../../environments/environment';

export function formatNumber(value: string | number, separator: string): string {
    const comps = String(value).split(".");

    if (comps.length > 2 || !comps[0].match(/^-?[0-9]*$/) || (comps[1] && !comps[1].match(/^[0-9]*$/)) || value === "." || value === "-.") {
        console.error("invalid value", "value", value);
    }

    // Make sure we have at least one whole digit (0 if none)
    let whole = comps[0];

    let negative = "";
    if (whole.substring(0, 1) === "-") {
        negative = "-";
        whole = whole.substring(1);
    }

    // Make sure we have at least 1 whole digit with no leading zeros
    while (whole.substring(0, 1) === "0") { whole = whole.substring(1); }
    if (whole === "") { whole = "0"; }

    let suffix = "";
    if (comps.length === 2) { suffix = "." + (comps[1] || "0"); }
    while (suffix.length > 2 && suffix[suffix.length - 1] === "0") {
        suffix = suffix.substring(0, suffix.length - 1);
    }

    const formatted = [];
    while (whole.length) {
        if (whole.length <= 3) {
            formatted.unshift(whole);
            break;
        } else {
            const index = whole.length - 3;
            formatted.unshift(whole.substring(index));
            whole = whole.substring(0, index);
        }
    }

    return negative + formatted.join(separator) + suffix;
}

export function bignumberDivToNum(bn1: ethers.BigNumber, bn2: ethers.BigNumber): number {
    const input = parseFloat(ethers.utils.formatEther(bn1));
    const output = parseFloat(ethers.utils.formatEther(bn2));
    return (input / output);
}

export function bignumberMulByPercentage(bn: ethers.BigNumber, percentage: number): ethers.BigNumber {
    const percentBN = ethers.BigNumber.from(percentage * 10000);
    const outputAfterPercent = bn.mul(percentBN).div(10000);
    const outputEther = parseFloat(ethers.utils.formatEther(outputAfterPercent)) / 100;
    const outputFinalBN = bn.sub(ethers.utils.parseEther(outputEther.toFixed(18)));
    return outputFinalBN;
}

export function bignumberGetPercentage(bn: ethers.BigNumber, percentage: number): ethers.BigNumber {
    const percentBN = ethers.BigNumber.from(percentage * 10000);
    const outputAfterPercent = bn.mul(percentBN).div(10000);
    const outputEther = parseFloat(ethers.utils.formatEther(outputAfterPercent)) / 100;
    const outputFinalBN = ethers.utils.parseEther(outputEther.toFixed(18));
    return outputFinalBN;
}

export function bignumberMulByPercentageToEtherStr(bn: ethers.BigNumber, percentage: number): string {
    return ethers.utils.formatEther(bignumberMulByPercentage(bn, percentage));
}

export function getBscScanLink(
    data: string | number,
    type: 'transaction' | 'token' | 'address' | 'block' | 'countdown',
    chainId: string = environment.chainId,
): string {
    switch (type) {
        case 'transaction': {
            return `${BASE_BSC_SCAN_URLS[chainId]}/tx/${data}`
        }
        case 'token': {
            return `${BASE_BSC_SCAN_URLS[chainId]}/token/${data}`
        }
        case 'block': {
            return `${BASE_BSC_SCAN_URLS[chainId]}/block/${data}`
        }
        case 'countdown': {
            return `${BASE_BSC_SCAN_URLS[chainId]}/block/countdown/${data}`
        }
        default: {
            return `${BASE_BSC_SCAN_URLS[chainId]}/address/${data}`
        }
    }
}
