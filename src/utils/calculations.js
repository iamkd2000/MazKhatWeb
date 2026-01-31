// Balance Calculation Utilities

/**
 * Calculate running balance after a transaction
 * @param {number} currentBalance - Current balance before transaction
 * @param {string} type - "credit" or "debit"
 * @param {number} amount - Transaction amount
 * @returns {number} New balance after transaction
 */
export const calculateBalance = (currentBalance, type, amount) => {
    if (type === 'credit') {
        // Credit = Money received = Balance increases
        return currentBalance + amount;
    } else {
        // Debit = Money given = Balance decreases
        return currentBalance - amount;
    }
};

/**
 * Format balance display text (GET or GIVE)
 * @param {number} balance - Current balance
 * @returns {object} { text: string, isPositive: boolean }
 */
export const formatBalance = (balance) => {
    if (balance > 0) {
        return {
            text: `You will GET ₹${balance.toFixed(2)}`,
            isPositive: true,
            amount: balance
        };
    } else if (balance < 0) {
        return {
            text: `You will GIVE ₹${Math.abs(balance).toFixed(2)}`,
            isPositive: false,
            amount: Math.abs(balance)
        };
    } else {
        return {
            text: 'Settled',
            isPositive: null,
            amount: 0
        };
    }
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount with rupee symbol
 */
export const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
};

/**
 * Generate unique ID
 * @returns {string} Unique ID string
 */
export const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format date for display
 * @param {string} dateString - Date string
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};
/**
 * Safely evaluate a mathematical expression string (e.g., "75+38+58")
 * Supports +, -, *, /
 * @param {string} expr - Expression string
 * @returns {number} Evaluated result or original number
 */
export const evaluateMathExpression = (expr) => {
    if (typeof expr !== 'string' || !expr.trim()) return 0;

    // Remove all characters except digits, ., +, -, *, /
    const cleanExpr = expr.replace(/[^0-9.+-/*]/g, '');

    if (!cleanExpr) return 0;

    try {
        // Using Function constructor for a simple, self-contained evaluator.
        // The regex above ensures we only pass safe mathematical characters.
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${cleanExpr}`)();
        return isFinite(result) ? parseFloat(result.toFixed(2)) : 0;
    } catch (e) {
        console.warn('Evaluation error:', e);
        // Fallback: try parsing as a single number
        const singleNum = parseFloat(cleanExpr);
        return isNaN(singleNum) ? 0 : singleNum;
    }
};
