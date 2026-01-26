// Professional PDF Generator with Web Support
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Generate high-quality PDF report for a ledger
 * @param {object} ledger - Ledger object with transactions
 * @param {array} transactions - Filtered transactions to include
 * @returns {Promise<object>} { success: boolean, pdfPath: string }
 */
export const generateLedgerPDF = async (ledger, transactions = null) => {
    if (!ledger) return { success: false, error: 'Ledger data is missing' };
    try {
        const txns = transactions || ledger.transactions || [];
        const htmlContent = createProfessionalHTML(ledger, txns);

        if (Platform.OS === 'web') {
            // Use expo-print's built-in printAsync for Web
            await Print.printAsync({
                html: htmlContent
            });
            return { success: true, pdfPath: 'printed' };
        } else {
            // For native platforms, use expo-print
            const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                base64: false
            });

            // Share the PDF
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${ledger.name} - Statement`
                });
            }

            return { success: true, pdfPath: uri };
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create professional HTML content matching the design
 * @param {object} ledger - Ledger object
 * @param {array} transactions - Transactions to include
 * @returns {string} HTML string
 */
const createProfessionalHTML = (ledger, transactions) => {
    const { name, balance, phone = '' } = ledger;

    // Calculate totals
    let payment = 0;
    let credit = 0;
    transactions.forEach(t => {
        if (t.type === 'credit') payment += t.amount;
        else credit += t.amount;
    });

    // Get date range
    const getDateRange = () => {
        if (transactions.length === 0) return 'No transactions';
        const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
        const start = dates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const end = dates[dates.length - 1].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${start} - ${end}`;
    };

    // Generate transaction rows
    const transactionRows = transactions.map(txn => {
        const date = new Date(txn.date);
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const isCredit = txn.type === 'credit';
        const arrow = isCredit ? '↓' : '↑';
        const color = isCredit ? '#4CAF50' : '#F44336';

        return `
        <tr>
            <td style="text-align: center; padding: 12px; border-bottom: 1px solid #f0f0f0;">
                <div style="font-size: 18px; font-weight: bold; color: #333;">${day}</div>
                <div style="font-size: 11px; color: #999;">${month}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <span style="color: ${color}; font-size: 18px; margin-right: 5px;">${arrow}</span>
                    <span style="color: ${color}; font-size: 16px; font-weight: bold;">₹${txn.amount.toLocaleString()}</span>
                </div>
                <div style="font-size: 13px; color: #666;">${isCredit ? 'Payment Received' : 'Payment Given'}</div>
                <div style="font-size: 12px; color: #999;">₹${Math.abs(txn.balanceAfter || 0).toLocaleString()} Due</div>
            </td>
        </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${name} - Customer Statement</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                background: #f5f9f9;
                padding: 20px;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                background: white;
                padding: 20px;
                border-bottom: 2px solid #f0f0f0;
            }
            .header h1 {
                font-size: 20px;
                color: #333;
                margin-bottom: 5px;
            }
            .header .subtitle {
                font-size: 13px;
                color: #999;
            }
            .balance-card {
                background: white;
                padding: 30px;
                text-align: center;
                border-bottom: 2px solid #f0f0f0;
            }
            .balance-amount {
                font-size: 36px;
                font-weight: bold;
                color: ${balance >= 0 ? '#F44336' : '#4CAF50'};
                margin-bottom: 10px;
            }
            .balance-label {
                font-size: 13px;
                color: #999;
                margin-bottom: 20px;
            }
            .summary-row {
                display: flex;
                justify-content: space-around;
                padding-top: 20px;
                border-top: 1px solid #f0f0f0;
            }
            .summary-item {
                text-align: center;
            }
            .summary-item .label {
                font-size: 12px;
                color: #999;
                margin-bottom: 5px;
            }
            .summary-item .value {
                font-size: 16px;
                font-weight: bold;
            }
            .summary-item .value.payment {
                color: #4CAF50;
            }
            .summary-item .value.credit {
                color: #F44336;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            .footer {
                padding: 20px;
                text-align: center;
                background: #f9f9f9;
                border-top: 2px solid #f0f0f0;
            }
            .footer p {
                font-size: 12px;
                color: #999;
                margin: 5px 0;
            }
            @media print {
                body {
                    background: white;
                    padding: 0;
                }
                .container {
                    box-shadow: none;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Customer Statement</h1>
                <p class="subtitle">Current Balance: <strong style="color: ${balance >= 0 ? '#F44336' : '#4CAF50'};">₹${Math.abs(balance).toLocaleString()}</strong></p>
            </div>

            <div class="balance-card">
                <div class="balance-amount">₹${Math.abs(balance).toLocaleString()}</div>
                <div class="balance-label">Balance | ${getDateRange()}</div>
                <div class="summary-row">
                    <div class="summary-item">
                        <div class="label">Payment (${transactions.filter(t => t.type === 'credit').length})</div>
                        <div class="value payment">₹${payment.toLocaleString()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Credit (${transactions.filter(t => t.type === 'debit').length})</div>
                        <div class="value credit">₹${credit.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <table>
                ${transactionRows || '<tr><td colspan="2" style="text-align: center; padding: 40px; color: #999;">No transactions in this period</td></tr>'}
            </table>

            <div class="footer">
                <p><strong>${name}</strong></p>
                ${phone ? `<p>Phone: ${phone}</p>` : ''}
                <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p style="margin-top: 10px;">MaZaKht - Digital Ledger App</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export default generateLedgerPDF;
