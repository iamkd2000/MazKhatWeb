import * as DocumentPicker from 'expo-document-picker';
import { getTextFromPdf } from 'expo-pdf-text-extract';
import { Alert } from 'react-native';

/**
 * Parses a PDF file to extract ledger transactions
 * @returns {Promise<{name: string, phone: string, transactions: Array<{date: string, amount: number, type: 'credit'|'payment', note: string}>} | null>}
 */
export const importLedgerFromPdf = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true
        });

        if (result.canceled) {
            return null;
        }

        const fileUri = result.assets[0].uri;
        console.log("PDF selected:", fileUri);

        // Extract text using the native module
        const { text } = await getTextFromPdf(fileUri);

        if (!text || text.trim().length === 0) {
            throw new Error("No text extracted from PDF. It might be an image-based PDF.");
        }

        console.log("Extracted text length:", text.length);

        // Parse the text
        return parsePdfText(text);

    } catch (error) {
        console.error("Error importing PDF:", error);
        Alert.alert("Import Failed", "Could not parse the PDF file: " + error.message);
        return null;
    }
};

const parsePdfText = (text) => {
    // Heuristic parsing logic
    // This attempts to find lines that look like transactions

    const lines = text.split('\n');
    const transactions = [];
    let name = "Imported Ledger";
    let phone = "";

    // Regex for date (DD/MM/YYYY)
    const dateRegex = /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/;

    // Regex for amount (looks for numbers with optional decimals/commas at end of line or specific column)
    // This is tricky without knowing the column layout.

    // Strategy: Look for lines with a date and a number.

    lines.forEach(line => {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            // Attempt to parse line
            // Example: "28/08/2025  Payment Received   500.00"
            // or "28/08/2025  Google Pay         500.00"

            // Extract Amount: look for number at the end
            // Remove commas
            const cleanLine = line.replace(/,/g, '');
            const amountMatch = cleanLine.match(/(\d+\.?\d{0,2})\s*$/); // Number at end of line?

            if (amountMatch) {
                const amount = parseFloat(amountMatch[1]);
                // Determine type: Credit (Given) or Payment (Received)
                // Heuristic: keywords
                const isPayment = /payment|received|credit|gpay|upi/i.test(line);
                const type = isPayment ? 'payment' : 'credit'; // Default to credit if ambiguous, or refine logic?
                // Actually 'credit' usually means 'You Gave' in this app context (based on previous turns), 'payment' means 'You Got'.
                // Adjust keywords as needed.

                // Let's guess: if "Payment" word exists -> Payment (You Got). Else -> Credit (You Gave).
                const typeGuess = /(received|payment|credit)/i.test(line) ? 'payment' : 'credit';

                // Extract Note: Everything else
                let note = line.replace(dateMatch[0], '').replace(amountMatch[0], '').trim();

                // Construct Date ISO
                const [_, day, month, year] = dateMatch;
                const isoDate = `${year}-${month}-${day}T12:00:00.000Z`;

                transactions.push({
                    date: isoDate,
                    amount: amount,
                    type: typeGuess,
                    note: note || "Imported Txn"
                });
            }
        }
    });

    console.log(`Parsed ${transactions.length} transactions.`);

    return {
        name,
        phone,
        transactions
    };
};
