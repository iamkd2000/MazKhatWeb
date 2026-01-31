// AsyncStorage Utilities for Offline-First Data Persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

const getLedgersKey = () => {
    const user = auth.currentUser;
    return user ? `ledgers_${user.uid}` : 'ledgers_guest';
};

const getExpensesKey = () => {
    const user = auth.currentUser;
    return user ? `expenses_${user.uid}` : 'expenses_guest';
};

const getCategoriesKey = () => {
    const user = auth.currentUser;
    return user ? `categories_${user.uid}` : 'categories_guest';
};

const getSettingsKey = () => {
    const user = auth.currentUser;
    return user ? `settings_${user.uid}` : 'settings_guest';
};

/**
 * Get all ledgers from AsyncStorage for the current user
 * @returns {Promise<object>} Object containing all ledgers
 */
export const getAllLedgers = async () => {
    try {
        const key = getLedgersKey();
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue == null) return {};
        try {
            return JSON.parse(jsonValue);
        } catch (e) {
            console.error('Error parsing ledgers JSON:', e);
            return {};
        }
    } catch (error) {
        console.error('Error reading ledgers:', error);
        return {};
    }
};

/**
 * Clear all data (For testing/reset purposes)
 * @returns {Promise<boolean>} Success status
 */
export const clearAllData = async () => {
    console.log('Starting clearAllData...');
    try {
        // 1. Clear Local Storage (Try both keys to be safe)
        const userKey = getLedgersKey();
        const guestKey = 'ledgers_guest';

        console.log(`Clearing AsyncStorage keys: ${userKey}, ${guestKey}`);
        await AsyncStorage.removeItem(userKey);
        await AsyncStorage.removeItem(guestKey);

        // 2. Clear Firebase Data
        const user = auth.currentUser;
        if (user) {
            console.log(`Clearing Firebase data for user: ${user.uid}`);
            try {
                const ledgersRef = collection(db, 'users', user.uid, 'ledgers');
                const snapshot = await getDocs(ledgersRef);

                console.log(`Found ${snapshot.docs.length} ledgers to delete from Firebase.`);

                // Delete all documents in the ledgers collection
                const deletePromises = snapshot.docs.map(doc => {
                    console.log(`Deleting ledger doc: ${doc.id}`);
                    return deleteDoc(doc.ref);
                });

                await Promise.all(deletePromises);
                console.log('Firebase deletion complete.');
            } catch (firebaseError) {
                console.error('Firebase clear error (continuing with local clear):', firebaseError);
                // We don't return false here, because local clear is still valuable
            }
        } else {
            console.log('No authenticated user, skipping Firebase clear.');
        }

        return true;
    } catch (error) {
        console.error('Error clearing data:', error);
        return false;
    }
};

/**
 * Save or update a ledger in AsyncStorage
 * @param {object} ledger - Ledger object to save
 * @returns {Promise<boolean>} Success status
 */
export const saveLedger = async (ledger) => {
    try {
        const key = getLedgersKey();
        const allLedgers = await getAllLedgers();
        allLedgers[ledger.id] = ledger;
        const jsonValue = JSON.stringify(allLedgers);
        await AsyncStorage.setItem(key, jsonValue);

        // Sync to Firebase in background if auto-backup is enabled
        const settings = await getBackupSettings();
        if (settings.autoBackup) {
            syncLedgerToFirebase(ledger);
        }

        return true;
    } catch (error) {
        console.error('Error saving ledger:', error);
        return false;
    }
};

/**
 * Delete a transaction from a ledger and sync with Firebase
 * @param {string} ledgerId - ID of the ledger
 * @param {string} transactionId - ID of the transaction to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteTransaction = async (ledgerId, transactionId) => {
    try {
        const key = getLedgersKey();
        const allLedgers = await getAllLedgers();
        const ledger = allLedgers[ledgerId];

        if (!ledger) return false;

        // Filter out the transaction
        const updatedTransactions = ledger.transactions.filter(t => t.id !== transactionId);

        // Recalculate balance
        let newBalance = 0;
        updatedTransactions.forEach(t => {
            if (t.type === 'credit') newBalance -= t.amount;
            else newBalance += t.amount;
        });

        const updatedLedger = {
            ...ledger,
            balance: newBalance,
            transactions: updatedTransactions
        };

        allLedgers[ledgerId] = updatedLedger;
        await AsyncStorage.setItem(key, JSON.stringify(allLedgers));

        // Sync to FirebaseFirestore if auto-backup is enabled
        const settings = await getBackupSettings();
        const user = auth.currentUser;
        if (user && settings.autoBackup) {
            // Background sync of all data to ensure consistency after transaction deletion
            syncAllToFirebase();
        }

        return true;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return false;
    }
};

/**
 * Delete a ledger from AsyncStorage and Firebase
 * @param {string} ledgerId - ID of ledger to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteLedger = async (ledgerId) => {
    try {
        const key = getLedgersKey();
        const allLedgers = await getAllLedgers();
        delete allLedgers[ledgerId];
        const jsonValue = JSON.stringify(allLedgers);
        await AsyncStorage.setItem(key, jsonValue);

        // Delete from Firebase if auto-backup is enabled
        const settings = await getBackupSettings();
        const user = auth.currentUser;
        if (user && settings.autoBackup) {
            // Note: Cloud Firestore does not automatically delete subcollections when a document is deleted.
            // For a production app, we would use a Cloud Function or manually delete all transactions first.
            // For now, we delete the main ledger doc.
            const ledgerRef = doc(db, 'users', user.uid, 'ledgers', ledgerId);
            await deleteDoc(ledgerRef);
        }

        return true;
    } catch (error) {
        console.error('Error deleting ledger:', error);
        return false;
    }
};

/**
 * Sync a single ledger to Firebase Firestore under the user's UID
 * @param {object} ledger - Ledger object to sync
 */
const syncLedgerToFirebase = async (ledger) => {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // Path: users/{uid}/ledgers/{ledgerId}
        const ledgerRef = doc(db, 'users', user.uid, 'ledgers', ledger.id);
        await setDoc(ledgerRef, {
            name: ledger.name,
            balance: ledger.balance,
            phone: ledger.phone || '',
            address: ledger.address || '',
            updatedAt: new Date().toISOString(),
        });

        // Save transactions subcollection
        if (ledger.transactions && ledger.transactions.length > 0) {
            for (const transaction of ledger.transactions) {
                const transactionRef = doc(db, 'users', user.uid, 'ledgers', ledger.id, 'transactions', transaction.id);
                await setDoc(transactionRef, {
                    type: transaction.type,
                    amount: transaction.amount,
                    date: transaction.date,
                    balanceAfter: transaction.balanceAfter,
                });
            }
        }
    } catch (error) {
        console.error('Error syncing to Firebase:', error);
    }
};

/**
 * Fetch all ledgers from Firebase Firestore for the current user
 * @returns {Promise<object>} Object containing all ledgers from Firebase
 */
export const fetchFromFirebase = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return {};

        const ledgersSnapshot = await getDocs(collection(db, 'users', user.uid, 'ledgers'));
        const allLedgers = {};

        for (const ledgerDoc of ledgersSnapshot.docs) {
            const ledgerData = ledgerDoc.data();

            // Fetch transactions for this ledger
            const transactionsSnapshot = await getDocs(
                collection(db, 'users', user.uid, 'ledgers', ledgerDoc.id, 'transactions')
            );

            const transactions = [];
            transactionsSnapshot.forEach((txnDoc) => {
                transactions.push({
                    id: txnDoc.id,
                    ...txnDoc.data()
                });
            });

            allLedgers[ledgerDoc.id] = {
                id: ledgerDoc.id,
                name: ledgerData.name,
                balance: ledgerData.balance,
                phone: ledgerData.phone || '',
                address: ledgerData.address || '',
                transactions: transactions.sort((a, b) => new Date(a.date) - new Date(b.date))
            };
        }

        // Save fetched data to AsyncStorage to stay in sync
        const key = getLedgersKey();
        await AsyncStorage.setItem(key, JSON.stringify(allLedgers));

        return allLedgers;
    } catch (error) {
        console.error('Error fetching from Firebase:', error);
        throw error; // Propagate error to caller
    }
};

/**
 * Sync all data from AsyncStorage to Firebase for the current user
 * @returns {Promise<boolean>} Success status
 */
export const syncAllToFirebase = async () => {
    try {
        console.log('Syncing all data to Firebase...');
        const user = auth.currentUser;
        if (!user) return false;

        // 1. Sync Ledgers
        const allLedgers = await getAllLedgers();
        for (const ledgerId in allLedgers) {
            await syncLedgerToFirebase(allLedgers[ledgerId]);
        }

        // 2. Sync Expenses
        const allExpenses = await getExpenses();
        for (const expense of allExpenses) {
            const expRef = doc(db, 'users', user.uid, 'expenses', expense.id);
            await setDoc(expRef, {
                ...expense,
                updatedAt: new Date().toISOString()
            });
        }

        // 3. Sync Categories
        const categories = await getCategories();
        const catRef = doc(db, 'users', user.uid, 'settings', 'categories');
        await setDoc(catRef, {
            list: categories,
            updatedAt: new Date().toISOString()
        });

        // 4. Update last sync time
        await updateBackupSettings({ lastSync: new Date().toISOString() });

        console.log('All data synced to Firebase successfully.');
        return true;
    } catch (error) {
        console.error('Error syncing all to Firebase:', error);
        return false;
    }
};

/**
 * Backup Settings Management
 */

export const getBackupSettings = async () => {
    try {
        const key = getSettingsKey();
        const jsonValue = await AsyncStorage.getItem(key);
        const defaults = {
            autoBackup: false,
            lastSync: null,
            syncStatus: 'idle' // idle, syncing, error
        };
        if (jsonValue == null) return defaults;
        try {
            return { ...defaults, ...JSON.parse(jsonValue) };
        } catch (e) {
            console.error('Error parsing backup settings JSON:', e);
            return defaults;
        }
    } catch (error) {
        console.error('Error reading backup settings:', error);
        return { autoBackup: false, lastSync: null, syncStatus: 'error' };
    }
};

export const updateBackupSettings = async (settings) => {
    try {
        const key = getSettingsKey();
        const current = await getBackupSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return true;
    } catch (error) {
        console.error('Error saving backup settings:', error);
        return false;
    }
};
/**
 * Get the user profile from AsyncStorage or Firebase
 * @returns {Promise<object>} User profile object
 */
export const getUserProfile = async () => {
    try {
        const user = auth.currentUser;
        const key = user ? `profile_${user.uid}` : 'profile_guest';

        // 1. Try Local Storage first
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue != null) {
            try {
                return JSON.parse(jsonValue);
            } catch (e) {
                console.error('Error parsing profile JSON:', e);
                // Continue to Firebase or return default
            }
        }

        // 2. If not local and user logged in, try Firebase
        if (user) {
            const { getDoc } = await import('firebase/firestore');
            const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
            const snapshot = await getDoc(profileRef);
            if (snapshot.exists()) {
                const firebaseProfile = snapshot.data();
                // Save to local for next time
                await AsyncStorage.setItem(key, JSON.stringify(firebaseProfile));
                return firebaseProfile;
            }
        }

        return {
            name: '',
            phone: '',
            email: '',
            bankName: '',
            accountNumber: '',
            ifsc: '',
            upiIds: [],
            profileImage: null,
            qrCode: null
        };
    } catch (error) {
        console.error('Error reading profile:', error);
        return {};
    }
};

/**
 * Save the user profile to AsyncStorage and Firebase
 * @param {object} profile - Profile object to save
 * @returns {Promise<boolean>} Success status
 */
export const saveUserProfile = async (profile) => {
    try {
        const user = auth.currentUser;
        const key = user ? `profile_${user.uid}` : 'profile_guest';

        // 1. Save Local
        const jsonValue = JSON.stringify(profile);
        await AsyncStorage.setItem(key, jsonValue);

        // 2. Sync to Firebase
        if (user) {
            const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
            await setDoc(profileRef, {
                ...profile,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }

        return true;
    } catch (error) {
        console.error('Error saving profile:', error);
        return false;
    }
};

/**
 * Daily Expenses Storage & Sync
 */

export const getExpenses = async () => {
    try {
        const key = getExpensesKey();
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue == null) return [];
        try {
            return JSON.parse(jsonValue);
        } catch (e) {
            console.error('Error parsing expenses JSON:', e);
            return [];
        }
    } catch (error) {
        console.error('Error reading expenses:', error);
        return [];
    }
};

export const saveExpense = async (expense) => {
    try {
        const key = getExpensesKey();
        const allExpenses = await getExpenses();

        // Check if updating or adding new
        const index = allExpenses.findIndex(e => e.id === expense.id);
        if (index !== -1) {
            allExpenses[index] = expense;
        } else {
            allExpenses.unshift(expense);
        }

        await AsyncStorage.setItem(key, JSON.stringify(allExpenses));

        // Sync to Firebase if auto-backup is enabled
        const settings = await getBackupSettings();
        const user = auth.currentUser;
        if (user && settings.autoBackup) {
            const expRef = doc(db, 'users', user.uid, 'expenses', expense.id);
            await setDoc(expRef, {
                ...expense,
                updatedAt: new Date().toISOString()
            });
        }
        return true;
    } catch (error) {
        console.error('Error saving expense:', error);
        return false;
    }
};

export const deleteExpense = async (expenseId) => {
    try {
        const key = getExpensesKey();
        const allExpenses = await getExpenses();
        const updatedExpenses = allExpenses.filter(e => e.id !== expenseId);
        await AsyncStorage.setItem(key, JSON.stringify(updatedExpenses));

        const settings = await getBackupSettings();
        const user = auth.currentUser;
        if (user && settings.autoBackup) {
            const expRef = doc(db, 'users', user.uid, 'expenses', expenseId);
            await deleteDoc(expRef);
        }
        return true;
    } catch (error) {
        console.error('Error deleting expense:', error);
        return false;
    }
};

export const fetchExpensesFromFirebase = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return [];

        const snapshot = await getDocs(collection(db, 'users', user.uid, 'expenses'));
        const expenses = [];
        snapshot.forEach(doc => {
            expenses.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        const key = getExpensesKey();
        await AsyncStorage.setItem(key, JSON.stringify(expenses));
        return expenses;
    } catch (error) {
        console.error('Error fetching expenses from Firebase:', error);
        return [];
    }
};

/**
 * User Categories Storage & Sync
 */

export const getCategories = async () => {
    try {
        const key = getCategoriesKey();
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue != null) {
            try {
                return JSON.parse(jsonValue);
            } catch (e) {
                console.error('Error parsing categories JSON:', e);
            }
        }

        // Default categories if nothing stored
        return [
            { id: 'Food', icon: 'food', color: '#FF7043' },
            { id: 'Travel', icon: 'car', color: '#42A5F5' },
            { id: 'Study', icon: 'book-open-variant', color: '#66BB6A' },
            { id: 'Rent', icon: 'home-city', color: '#9C27B0' },
            { id: 'Entertainment', icon: 'movie-open', color: '#E91E63' },
            { id: 'Health', icon: 'heart-pulse', color: '#F44336' },
            { id: 'Salary', icon: 'cash-multiple', color: '#009688' },
            { id: 'Other', icon: 'dots-horizontal', color: '#78909C' },
        ];
    } catch (error) {
        console.error('Error reading categories:', error);
        return [];
    }
};

export const saveCategories = async (categories) => {
    try {
        const key = getCategoriesKey();
        await AsyncStorage.setItem(key, JSON.stringify(categories));

        const settings = await getBackupSettings();
        const user = auth.currentUser;
        if (user && settings.autoBackup) {
            const catRef = doc(db, 'users', user.uid, 'settings', 'categories');
            await setDoc(catRef, {
                list: categories,
                updatedAt: new Date().toISOString()
            });
        }
        return true;
    } catch (error) {
        console.error('Error saving categories:', error);
        return false;
    }
};

export const fetchCategoriesFromFirebase = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return [];

        const { getDoc } = await import('firebase/firestore');
        const catRef = doc(db, 'users', user.uid, 'settings', 'categories');
        const snapshot = await getDoc(catRef);

        if (snapshot.exists()) {
            const categories = snapshot.data().list;
            const key = getCategoriesKey();
            await AsyncStorage.setItem(key, JSON.stringify(categories));
            return categories;
        }
        return await getCategories(); // Fallback to local defaults
    } catch (error) {
        console.error('Error fetching categories from Firebase:', error);
        return [];
    }
};

/**
 * Save user profile to Firestore
 * @param {object} profileData - Profile data to save
 * @returns {Promise<boolean>} Success status
 */
export const saveUserProfileToFirebase = async (profileData) => {
    try {
        const user = auth.currentUser;
        if (!user) return false;

        const { setDoc } = await import('firebase/firestore');
        const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
        await setDoc(profileRef, profileData);

        console.log('Profile saved to Firebase');
        return true;
    } catch (error) {
        console.error('Error saving profile to Firebase:', error);
        return false;
    }
};

/**
 * Fetch user profile from Firestore
 * @returns {Promise<object>} Profile data
 */
export const getUserProfileFromFirebase = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return null;

        const { getDoc } = await import('firebase/firestore');
        const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
        const snapshot = await getDoc(profileRef);

        if (snapshot.exists()) {
            console.log('Profile loaded from Firebase');
            return snapshot.data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching profile from Firebase:', error);
        return null;
    }
};
