/**
 * Format a number with dot separators for thousands.
 * Examples: 1000 → "1.000", 1500000 → "1.500.000"
 * @param {number} value - The number to format
 * @returns {string} - Formatted number string
 */
export function formatNumber(value) {
  return Math.floor(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format a currency value with $ prefix and dot separators.
 * Examples: 1000 → "$1.000", 1500000 → "$1.500.000"
 * @param {number} value - The number to format
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(value) {
  return '$' + formatNumber(value);
}
