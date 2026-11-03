/**
 * Utility to convert numeric amounts to full text in French with Ariary currency.
 * Replicates WinDev module COL_MontantEnToutesLettresAvecDevise.
 */

const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

function convertGroup(num: number): string {
  let output = '';

  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundred > 0) {
    if (hundred === 1) {
      output += 'cent';
    } else {
      output += units[hundred] + ' cent' + (remainder === 0 ? 's' : '');
    }
  }

  if (remainder > 0) {
    if (hundred > 0) output += ' ';

    if (remainder < 10) {
      output += units[remainder];
    } else if (remainder < 20) {
      output += teens[remainder - 10];
    } else {
      const tenDigit = Math.floor(remainder / 10);
      const unitDigit = remainder % 10;

      if (tenDigit === 7) {
        output += 'soixante-' + teens[unitDigit];
      } else if (tenDigit === 9) {
        output += 'quatre-vingt-' + teens[unitDigit];
      } else if (tenDigit === 8) {
        output += 'quatre-vingt' + (unitDigit === 0 ? 's' : '-' + units[unitDigit]);
      } else {
        const hyphen = unitDigit === 1 ? ' et ' : '-';
        output += tens[tenDigit] + (unitDigit > 0 ? hyphen + units[unitDigit] : '');
      }
    }
  }

  return output;
}

export function numberToWordsMGA(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zéro Ariary';

  const absAmount = Math.abs(Math.floor(amount));
  if (absAmount === 0) return 'Zéro Ariary';

  const milliards = Math.floor(absAmount / 1000000000);
  const millions = Math.floor((absAmount % 1000000000) / 1000000);
  const milliers = Math.floor((absAmount % 1000000) / 1000);
  const reste = absAmount % 1000;

  const parts: string[] = [];

  if (milliards > 0) {
    if (milliards === 1) {
      parts.push('un milliard');
    } else {
      parts.push(convertGroup(milliards) + ' milliards');
    }
  }

  if (millions > 0) {
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(convertGroup(millions) + ' millions');
    }
  }

  if (milliers > 0) {
    if (milliers === 1) {
      parts.push('mille');
    } else {
      parts.push(convertGroup(milliers) + ' mille');
    }
  }

  if (reste > 0) {
    parts.push(convertGroup(reste));
  }

  let result = parts.join(' ');
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  return `${result} Ariary`;
}

export function formatCurrencyMGA(amount: number): string {
  return new Intl.NumberFormat('fr-MG', {
    style: 'currency',
    currency: 'MGA',
    maximumFractionDigits: 0,
  }).format(amount).replace('MGA', 'Ar');
}
