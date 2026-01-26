// Data Backup and Restore Utilities

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllLedgers } from './storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebase';

const LEDGERS_KEY = 'ledgers';

/**
 * Export all app data to JSON backup file
 * @returns {Promise<object>} { success: boolean, filePath: string }
 */
export const exportDataToBackup = async () => {
    try {
        console.log('Starting exportDataToBackup...');
        const allLedgers = await getAllLedgers();
        console.log('Got ledgers:', Object.keys(allLedgers).length);

        // Get expenses and categories from storage
        const expensesKey = 'expenses_' + (auth.currentUser ? auth.currentUser.uid : 'guest');
        const categoriesKey = 'categories_' + (auth.currentUser ? auth.currentUser.uid : 'guest');

        const expensesJson = await AsyncStorage.getItem(expensesKey);
        const categoriesJson = await AsyncStorage.getItem(categoriesKey);

        const expenses = expensesJson ? JSON.parse(expensesJson) : [];
        const categories = categoriesJson ? JSON.parse(categoriesJson) : [];

        console.log('Got expenses:', expenses.length, 'categories:', categories.length);

        // Create backup object with metadata
        const backupData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            ledgers: allLedgers,
            expenses: expenses,
            categories: categories
        };

        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `okcredit_backup_${timestamp}.json`;
        const jsonString = JSON.stringify(backupData, null, 2);

        console.log('Backup JSON size:', jsonString.length, 'bytes');

        if (Platform.OS === 'web') {
            // Web Download Logic
            console.log('Creating web download...');
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log('Web download complete!');
            return { success: true, filePath: 'web_download' };
        }

        // Native Logic (Mobile) - Only use FileSystem on native platforms
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(
            fileUri,
            jsonString,
            { encoding: FileSystem.EncodingType.UTF8 }
        );

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Save Backup File'
            });
        }

        return { success: true, filePath: fileUri };
    } catch (error) {
        console.error('Error exporting backup:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Import data from backup file
 * @param {string} fileUri - URI of backup file (optional, will prompt if not provided)
 * @returns {Promise<object>} { success: boolean, ledgersCount: number }
 */
export const importDataFromBackup = async (fileUri = null) => {
    try {
        let backupData;

        if (Platform.OS === 'web') {
            // Web file import logic
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json,.json';

                input.onchange = async (e) => {
                    try {
                        const file = e.target.files[0];
                        if (!file) {
                            resolve({ success: false, error: 'No file selected' });
                            return;
                        }

                        const text = await file.text();
                        backupData = JSON.parse(text);

                        // Validate backup structure
                        if (!validateBackupFile(backupData)) {
                            resolve({ success: false, error: 'Invalid backup file format' });
                            return;
                        }

                        // Restore data to AsyncStorage
                        await AsyncStorage.setItem(LEDGERS_KEY, JSON.stringify(backupData.ledgers));

                        const ledgersCount = Object.keys(backupData.ledgers).length;
                        resolve({ success: true, ledgersCount });
                    } catch (error) {
                        console.error('Error importing backup:', error);
                        resolve({ success: false, error: error.message });
                    }
                };

                input.click();
            });
        }

        // Native mobile logic
        let selectedFileUri = fileUri;

        // If no URI provided, let user pick a file
        if (!selectedFileUri) {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) {
                return { success: false, error: 'Cancelled' };
            }

            selectedFileUri = result.assets[0].uri;
        }

        // Read file content
        const fileContent = await FileSystem.readAsStringAsync(selectedFileUri, {
            encoding: FileSystem.EncodingType.UTF8
        });

        // Parse JSON
        backupData = JSON.parse(fileContent);

        // Validate backup structure
        if (!validateBackupFile(backupData)) {
            return { success: false, error: 'Invalid backup file format' };
        }

        // Restore data to AsyncStorage
        await AsyncStorage.setItem(LEDGERS_KEY, JSON.stringify(backupData.ledgers));

        const ledgersCount = Object.keys(backupData.ledgers).length;

        return { success: true, ledgersCount };
    } catch (error) {
        console.error('Error importing backup:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Validate backup file structure
 * @param {object} data - Parsed backup data
 * @returns {boolean} True if valid
 */
export const validateBackupFile = (data) => {
    try {
        // Check required fields
        if (!data.version || !data.ledgers) {
            return false;
        }

        // Check ledgers structure
        if (typeof data.ledgers !== 'object') {
            return false;
        }

        // Validate each ledger has required fields
        for (const ledgerId in data.ledgers) {
            const ledger = data.ledgers[ledgerId];
            if (!ledger.id || !ledger.name || typeof ledger.balance !== 'number') {
                return false;
            }

            // Validate transactions
            if (ledger.transactions && !Array.isArray(ledger.transactions)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Clear all app data (for testing or reset)
 * @returns {Promise<boolean>} Success status
 */
export const clearAllData = async () => {
    try {
        await AsyncStorage.removeItem(LEDGERS_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing data:', error);
        return false;
    }
};
