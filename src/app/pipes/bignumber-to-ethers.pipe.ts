import { Pipe, PipeTransform } from '@angular/core';
import { ethers } from 'ethers';
import { formatNumber } from '../utils/common';

@Pipe({
  name: 'bignumberToEthers'
})
export class BignumberToEthersPipe implements PipeTransform {

  transform(value: ethers.BigNumber, separator = ' ', decimals = 18): string {
    if (value) {
      const formatted = ethers.utils.formatEther(value);
      const trimmed = BignumberToEthersPipe.trimDecimals(formatted, decimals);
      return formatNumber(trimmed, separator)
    }
    return '';
  }

  static trimDecimals(value: string, decimals: number): string {
    let index = value.indexOf('.');
    if (index === -1) { index = value.indexOf(','); }
    if (index === -1) { return value; }
    if (index + decimals >= value.length) { return value; }
    return value.substr(0, index + decimals + 1);
  }
}