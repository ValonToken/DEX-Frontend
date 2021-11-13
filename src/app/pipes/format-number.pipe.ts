import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatNumber'
})
export class FormatNumberPipe implements PipeTransform {

  transform(value: any, decimals: number): string {
    if (value) {

      if (value.toString().slice(0, value.toString().indexOf('.')).length > 3) {
        value = value.toFixed(decimals);
      } else {
        value = value.toFixed(4);
      }

      // Delete existing spaces
      while ((value as string).indexOf(' ') !== -1) {
        value = (value as string).replace(' ', '');
      }

      // Manage decimal values
      let integerPart: string = value;
      let decimalsStr: string;
      if (value.indexOf('.') !== -1) {
        integerPart = value.slice(0, value.indexOf('.'));
        decimalsStr = value.slice(value.indexOf('.'), value.length)
      }
      if (value.indexOf(',') !== -1) {
        integerPart = value.slice(0, value.indexOf(','));
        decimalsStr = value.slice(value.indexOf(','), value.length)
      }

      let firstSlice = true;
      const arrayResults: Array<string> = [];
      let finalResult = '';

      const divisor = 3;
      const dividend: number = integerPart.length;
      let remainder = dividend % divisor;
      let quotient = (dividend + remainder) / divisor;

      if (dividend >= 3) {
        do {
          if (firstSlice && remainder > 0) {
            // Manage numbers with remainders
            firstSlice = false;
            arrayResults.push(integerPart.slice(0, remainder));
          } else {
            // Slice each part of the number to an array
            firstSlice = false;
            arrayResults.push(integerPart.slice(remainder, remainder + divisor));
            remainder = remainder + divisor;
            quotient--;
          }
          // Continue dividing the number while there are values
        } while (quotient >= 1);

        // Concats the sliced parts to build the final number
        arrayResults.forEach(part => {
          finalResult += `${part} `;
        });
        // Delete any trailing whitespace
        finalResult = finalResult.trim();
        finalResult += decimalsStr;
        return finalResult;
      } else {
        return value;
      }
    }
    return value;
  }
}