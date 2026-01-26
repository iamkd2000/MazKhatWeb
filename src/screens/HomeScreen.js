import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Modal, Platform, SafeAreaView, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllLedgers, saveLedger, fetchFromFirebase, deleteLedger, clearAllData, syncAllToFirebase, getExpenses, saveExpense, deleteExpense, fetchExpensesFromFirebase, getCategories, fetchCategoriesFromFirebase, getBackupSettings } from '../utils/storage';
import { exportDataToBackup, importDataFromBackup } from '../utils/backup';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { generateLedgerPDF } from '../utils/pdfGenerator';
import { generateId } from '../utils/calculations';
import { LedgerCard } from '../components/LedgerCard';
import CategoryManager from '../components/CategoryManager';
import SecurityVerifyModal from '../components/SecurityVerifyModal';
import { useTheme } from '../context/ThemeContext';

// Categories are now handled dynamically via storage

export default function HomeScreen({ navigation }) {
    const { colors, isDark, toggleTheme } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [ledgers, setLedgers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeTab, setActiveTab] = useState('customer');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showOtherInput, setShowOtherInput] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [showCustomerSortModal, setShowCustomerSortModal] = useState(false);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [selectedLedger, setSelectedLedger] = useState(null);
    const [newLedgerName, setNewLedgerName] = useState('');
    const [expenseData, setExpenseData] = useState({ title: '', amount: '', category: 'Food' });
    const [expenseSortBy, setExpenseSortBy] = useState('date_desc'); // date_desc, date_asc, amount_desc, amount_asc
    const [customerSortBy, setCustomerSortBy] = useState('recent'); // recent, oldest, balance_desc, balance_asc
    const [savingExpense, setSavingExpense] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [backupEnabled, setBackupEnabled] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            console.log(`${title}: ${message}`);
        }
    };

    // Sync cooldown: only auto-sync if more than 5 minutes since last sync
    const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    const loadData = useCallback(async () => {
        setRefreshing(true);
        const [ledgersData, expensesData, catData, backupData] = await Promise.all([
            getAllLedgers(),
            getExpenses(),
            getCategories(),
            getBackupSettings()
        ]);
        setLedgers(Object.values(ledgersData));
        setExpenses(expensesData);
        setCategories(catData);
        setBackupEnabled(backupData.autoBackup);
        setLastSync(backupData.lastSync);

        // Auto-sync only if enabled AND cooldown has passed
        if (backupData.autoBackup && !syncing) {
            const lastSyncTime = backupData.lastSync ? new Date(backupData.lastSync).getTime() : 0;
            const now = Date.now();
            if (now - lastSyncTime > SYNC_COOLDOWN_MS) {
                handleAutoSync();
            }
        }

        setRefreshing(false);
    }, [syncing]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleAutoSync = useCallback(async () => {
        setSyncing(true);
        await syncAllToFirebase();
        const updatedBackup = await getBackupSettings();
        setLastSync(updatedBackup.lastSync);
        setSyncing(false);
    }, []);

    const handleBackupNow = async () => {
        if (syncing) return;
        setSyncing(true);

        // 1. Cloud Sync
        const cloudSuccess = await syncAllToFirebase();

        // 2. Local File Backup
        const localResult = await exportDataToBackup();

        setSyncing(false);

        if (cloudSuccess && localResult.success) {
            showAlert('Backup Success', 'Data synced to Cloud and local backup file created! 🚀📁');
        } else if (cloudSuccess) {
            // Cloud worked, Local failed
            showAlert('Partial Success', `Cloud sync done, but local file failed: ${localResult.error || 'Unknown error'}`);
        } else if (localResult.success) {
            // Local worked, Cloud failed
            showAlert('Partial Success', 'Local file created, but Cloud sync failed. Check internet?');
        } else {
            // Both failed
            showAlert('Backup Failed', `Cloud sync failed. Local error: ${localResult.error || 'Unknown error'}`);
        }
    };

    const handleImportBackup = async () => {
        if (syncing) return;
        const confirmMsg = "This will replace your local data with data from the cloud. Are you sure?";
        if (Platform.OS === 'web') {
            if (!window.confirm(confirmMsg)) return;
        }

        setSyncing(true);
        try {
            const data = await fetchFromFirebase();
            setSyncing(false);

            if (data && Object.keys(data).length > 0) {
                const ledgersArray = Object.values(data);
                setLedgers(ledgersArray);
                showAlert('Import Success', 'Data has been restored from your cloud backup! ✨');
            } else {
                showAlert('Import Info', 'No backup data found in cloud.');
            }
        } catch (error) {
            setSyncing(false);
            console.error(error);
            showAlert('Import Failed', `Error: ${error.message || 'Unknown network error'}`);
        }
    };

    const sortedLedgers = useMemo(() => {
        let result = ledgers.filter(l =>
            l.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        result.sort((a, b) => {
            let comparison = 0;
            switch (customerSortBy) {
                case 'balance_desc':
                    comparison = b.balance - a.balance;
                    break;
                case 'balance_asc':
                    comparison = a.balance - b.balance;
                    break;
                case 'recent':
                    const dateA = a.transactions.length > 0 ? new Date(a.transactions[a.transactions.length - 1].date).getTime() : 0;
                    const dateB = b.transactions.length > 0 ? new Date(b.transactions[b.transactions.length - 1].date).getTime() : 0;
                    comparison = dateB - dateA;
                    break;
                case 'oldest':
                    comparison = a.id.localeCompare(b.id); // Creation order roughly
                    break;
                case 'name_asc':
                    comparison = a.name.localeCompare(b.name);
                    break;
            }
            return comparison !== 0 ? comparison : a.name.localeCompare(b.name);
        });

        return result;
    }, [ledgers, searchQuery, customerSortBy]);

    const totals = useMemo(() => {
        let give = 0;
        let receive = 0;
        ledgers.forEach(l => {
            if (l.balance > 0) give += l.balance;
            else if (l.balance < 0) receive += Math.abs(l.balance);
        });

        // Calculate category usage for expenses
        const categoryUsage = {};
        expenses.forEach(e => {
            categoryUsage[e.category] = (categoryUsage[e.category] || 0) + 1;
        });
        const mostUsed = Object.entries(categoryUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        return { give, receive, mostUsed };
    }, [ledgers, expenses]);

    const sortedExpenses = useMemo(() => {
        let result = [...expenses];

        // Sorting Logic
        result.sort((a, b) => {
            let comparison = 0;
            switch (expenseSortBy) {
                case 'date_desc':
                    comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
                    break;
                case 'date_asc':
                    comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                case 'amount_desc':
                    comparison = b.amount - a.amount;
                    break;
                case 'amount_asc':
                    comparison = a.amount - b.amount;
                    break;
            }
            // Fallback to ID for stable sort if values are equal
            return comparison !== 0 ? comparison : b.id.localeCompare(a.id);
        });

        if (searchQuery) {
            result = result.filter(e =>
                e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return result;
    }, [expenses, expenseSortBy, searchQuery]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const [firebaseLedgers, firebaseExpenses, firebaseCats] = await Promise.all([
                fetchFromFirebase(),
                fetchExpensesFromFirebase(),
                fetchCategoriesFromFirebase()
            ]);
            setLedgers(Object.values(firebaseLedgers));
            setExpenses(firebaseExpenses);
            setCategories(firebaseCats);
        } catch (error) {
            console.error('Error refreshing:', error);
        }
        setRefreshing(false);
    }, []);

    const handleAddLedger = async () => {
        if (!newLedgerName.trim()) {
            showAlert('Error', 'Please enter a name');
            return;
        }
        const newLedger = {
            id: generateId(),
            name: newLedgerName.trim(),
            balance: 0,
            transactions: [],
        };
        await saveLedger(newLedger);
        await loadData();
        setNewLedgerName('');
        setShowAddModal(false);
    };

    const handleAddExpense = async () => {
        if (savingExpense) return; // Prevent duplicate saves
        if (!expenseData.title.trim() || !expenseData.amount) {
            showAlert('Error', 'Please enter title and amount');
            return;
        }
        setSavingExpense(true);
        try {
            const newExpense = {
                ...expenseData,
                id: generateId(),
                amount: parseFloat(expenseData.amount),
                date: new Date().toISOString(),
            };
            await saveExpense(newExpense);
            await loadData();
            setExpenseData({ ...expenseData, title: '', amount: '' });
            setShowOtherInput(false);
            setShowExpenseModal(false);
        } finally {
            setSavingExpense(false);
        }
    };



    const handleLedgerDelete = async () => {
        if (!selectedLedger) return;
        setShowMenuModal(false);
        setShowSecurityModal(true);
    };

    const confirmLedgerDelete = async () => {
        setShowSecurityModal(false);
        const success = await deleteLedger(selectedLedger.id);
        if (success) {
            await loadData();
            setSelectedLedger(null);
        } else {
            showAlert('Error', 'Failed to delete customer');
        }
    };


    const handleWhatsAppShare = () => {
        const message = `*My Business Report*\nTotal You Will Get: ₹${totals.give.toLocaleString()}\nTotal You Will Give: ₹${totals.receive.toLocaleString()}\nNet Balance: ₹${Math.abs(totals.give - totals.receive).toLocaleString()} (${totals.give >= totals.receive ? 'You Get' : 'You Give'})\n\nGenerated via MaZaKht`;
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            // Mobile linking would go here
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Visible Scrollbar for Web */}
            {Platform.OS === 'web' && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    * {
                        scrollbar-width: thin;
                        scrollbar-color: #2196F3 #E1F5FE;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        overflow-y: auto;
                        height: 100%;
                    }
                    ::-webkit-scrollbar {
                        width: 10px;
                        height: 10px;
                    }
                    ::-webkit-scrollbar-track {
                        background: #E1F5FE;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #4FC3F7;
                        border-radius: 5px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #03A9F4;
                    }
                `}} />
            )}
            {/* 1. Top Profile Bar */}
            <View style={styles.topProfileBar}>
                <View style={styles.profileLeft}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={() => navigation.navigate('UserProfile')}
                    >
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>K</Text>
                        </View>
                        <View style={styles.syncIndicator}>
                            <MaterialCommunityIcons name="sync-circle" size={14} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.profileInfo}>
                        <Text style={styles.welcomeText}>Welcome,</Text>
                        <Text style={styles.userName}>MaZaKht Business</Text>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    {backupEnabled ? (
                        <View style={styles.autoBackupStatus}>
                            <MaterialCommunityIcons
                                name={syncing ? "cloud-sync" : "cloud-check"}
                                size={18}
                                color={syncing ? colors.PRIMARY : "#4CAF50"}
                            />
                            <View style={styles.statusTextCol}>
                                <Text style={[styles.statusMainText, { color: syncing ? colors.PRIMARY : "#4CAF50" }]}>
                                    {syncing ? 'Syncing...' : 'Cloud Active'}
                                </Text>
                                {lastSync && (
                                    <Text style={styles.statusSubText}>
                                        {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.pillBtn, styles.backupPill]}
                                onPress={handleBackupNow}
                                disabled={syncing}
                            >
                                <MaterialCommunityIcons
                                    name={syncing ? "loading" : "cloud-upload"}
                                    size={16}
                                    color={colors.WHITE}
                                />
                                <Text style={styles.pillBtnText}>{syncing ? 'Backing up...' : 'Backup'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.pillBtn, styles.importPill]}
                                onPress={handleImportBackup}
                                disabled={syncing}
                            >
                                <MaterialCommunityIcons name="cloud-download" size={16} color={colors.PRIMARY} />
                                <Text style={[styles.pillBtnText, { color: colors.PRIMARY }]}>Import</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* 4. Tab Row */}
            <View style={styles.tabRowContainer}>
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'customer' && styles.activeTab]}
                        onPress={() => setActiveTab('customer')}
                    >
                        <Text style={[styles.tabText, activeTab === 'customer' && styles.activeTabText]}>Customer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'expenses' && styles.activeTab]}
                        onPress={() => setActiveTab('expenses')}
                    >
                        <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.actionIcons}>
                    {activeTab === 'customer' ? (
                        <TouchableOpacity
                            style={styles.actionIcon}
                            onPress={() => setShowCustomerSortModal(true)}
                        >
                            <View style={styles.sortIconBadge}>
                                <MaterialCommunityIcons
                                    name={customerSortBy.includes('balance') ? "sort-numeric-variant" : "calendar-month"}
                                    size={22}
                                    color={colors.PRIMARY}
                                />
                                <Ionicons
                                    name={customerSortBy.includes('desc') || customerSortBy === 'recent' ? "chevron-down" : "chevron-up"}
                                    size={10}
                                    color={colors.PRIMARY}
                                    style={styles.sortChevron}
                                />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.actionIcon}
                            onPress={() => setShowSortModal(true)}
                        >
                            <View style={styles.sortIconBadge}>
                                <MaterialCommunityIcons
                                    name={expenseSortBy.includes('amount') ? "sort-numeric-variant" : "calendar-month"}
                                    size={22}
                                    color={colors.PRIMARY}
                                />
                                <Ionicons
                                    name={expenseSortBy.includes('desc') ? "chevron-down" : "chevron-up"}
                                    size={10}
                                    color={colors.PRIMARY}
                                    style={styles.sortChevron}
                                />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 4.5 Enhanced Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchPremiumWrapper}>
                    <Ionicons name="search" size={20} color={colors.PRIMARY} />
                    <TextInput
                        style={styles.searchBarInput}
                        placeholder={activeTab === 'customer' ? "Search customers..." : "Search expenses..."}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.TEXT_LIGHT}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={colors.TEXT_LIGHT} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 5. Summary Card (Dynamic) */}
            <TouchableOpacity style={styles.netBalanceCard}>
                <View style={styles.netBalanceLeft}>
                    <Text style={styles.netBalanceLabel}>{activeTab === 'customer' ? 'Net Balance' : 'Total Expenses'}</Text>
                    <View style={styles.accountCount}>
                        <Ionicons
                            name={activeTab === 'customer' ? "people-outline" : "receipt-outline"}
                            size={14}
                            color={colors.TEXT_SECONDARY}
                        />
                        <Text style={styles.accountCountText}>
                            {activeTab === 'customer' ? `${ledgers.length} Accounts` : `${expenses.length} Items`}
                        </Text>
                    </View>
                </View>
                <View style={styles.netBalanceRight}>
                    <View style={styles.balanceInfo}>
                        <Text style={[styles.netBalanceValue, {
                            color: activeTab === 'customer'
                                ? (totals.give >= totals.receive ? colors.DEBIT_RED : colors.CREDIT_GREEN)
                                : colors.DEBIT_RED
                        }]}>
                            ₹{activeTab === 'customer'
                                ? Math.abs(totals.give - totals.receive).toLocaleString()
                                : expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()
                            }
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.TEXT_LIGHT} />
                    </View>
                    <Text style={styles.balanceSubText}>
                        {activeTab === 'customer'
                            ? (totals.give >= totals.receive ? 'You Give' : 'You Receive')
                            : `Most Used: ${totals.mostUsed}`
                        }
                    </Text>
                </View>
            </TouchableOpacity>

            <FlatList
                style={[styles.list, { flex: 1 }]}
                data={activeTab === 'customer' ? sortedLedgers : sortedExpenses}
                extraData={activeTab === 'customer' ? customerSortBy : expenseSortBy}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={false}
                renderItem={({ item }) => (
                    activeTab === 'customer' ? (
                        <LedgerCard
                            ledger={item}
                            onPress={() => navigation.navigate('LedgerDetail', { ledger: item })}
                            onLongPress={() => {
                                setSelectedLedger(item);
                                setShowMenuModal(true);
                            }}
                        />
                    ) : (
                        <TouchableOpacity
                            style={styles.expenseItem}
                            onLongPress={() => {
                                if (Platform.OS === 'web') {
                                    if (window.confirm('Delete this expense?')) {
                                        deleteExpense(item.id).then(loadData);
                                    }
                                } else {
                                    Alert.alert(
                                        'Delete Expense',
                                        'Are you sure you want to delete this expense?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(item.id).then(loadData) }
                                        ]
                                    );
                                }
                            }}
                        >
                            <View style={styles.expenseLeft}>
                                <View style={[styles.expenseIcon, { backgroundColor: categories.find(c => c.id === item.category)?.color + '15' || '#F5F5F5' }]}>
                                    <MaterialCommunityIcons
                                        name={categories.find(c => c.id === item.category)?.icon || 'wallet-outline'}
                                        size={20}
                                        color={categories.find(c => c.id === item.category)?.color || colors.PRIMARY}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.expenseTitle}>{item.title}</Text>
                                    <Text style={styles.expenseCategory}>{item.category} • {new Date(item.date).toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <Text style={styles.expenseAmount}>₹{item.amount.toLocaleString()}</Text>
                        </TouchableOpacity>
                    )
                )}
                contentContainerStyle={{ paddingBottom: 180 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons
                            name={activeTab === 'customer' ? "account-search-outline" : "receipt"}
                            size={80}
                            color="#E0E0E0"
                        />
                        <Text style={styles.emptyText}>
                            {activeTab === 'customer' ? 'No customers found' : 'No expenses recorded'}
                        </Text>
                    </View>
                }
            />

            {/* Security Verification Modal */}
            <SecurityVerifyModal
                visible={showSecurityModal}
                title={`Delete ${selectedLedger?.name}`}
                onSuccess={confirmLedgerDelete}
                onCancel={() => setShowSecurityModal(false)}
            />

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('customer')}>
                    <MaterialCommunityIcons name="notebook" size={24} color={activeTab === 'customer' ? colors.NAV_ACTIVE : colors.TEXT_SECONDARY} />
                    <Text style={[styles.navText, activeTab === 'customer' && { color: colors.NAV_ACTIVE }]}>Ledger</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Insights')}>
                    <View style={styles.insightsPill}>
                        <MaterialCommunityIcons name="chart-box-outline" size={24} color={colors.PRIMARY} />
                        <Text style={[styles.navText, { color: colors.PRIMARY, fontWeight: 'bold' }]}>Insights</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => setShowMenuModal(true)}>
                    <MaterialCommunityIcons name="dots-horizontal" size={24} color={colors.TEXT_SECONDARY} />
                    <Text style={styles.navText}>More</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => activeTab === 'customer' ? setShowAddModal(true) : setShowExpenseModal(true)}
            >
                <View style={styles.fabInner}>
                    <Ionicons
                        name={activeTab === 'customer' ? "person-add" : "add-circle"}
                        size={24}
                        color={colors.WHITE}
                    />
                    <Text style={styles.fabLabel}>
                        {activeTab === 'customer' ? 'ADD CUSTOMER' : 'ADD EXPENSE'}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Add Expense Modal */}
            <Modal
                visible={showExpenseModal}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowExpenseModal(false);
                    setShowOtherInput(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Daily Expense</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="What did you buy?"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={expenseData.title}
                            onChangeText={(text) => setExpenseData({ ...expenseData, title: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Amount ₹"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            keyboardType="numeric"
                            value={expenseData.amount}
                            onChangeText={(text) => setExpenseData({ ...expenseData, amount: text })}
                        />

                        <View style={styles.categoryHeader}>
                            <Text style={styles.sectionLabel}>Category</Text>
                            <TouchableOpacity onPress={() => {
                                setShowExpenseModal(false);
                                setTimeout(() => setShowCategoryManager(true), 200);
                            }}>
                                <Text style={styles.manageBtnText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.categoryChips}>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.chip,
                                        expenseData.category === cat.id && { backgroundColor: cat.color },
                                        expenseData.category === cat.id && styles.activeChip
                                    ]}
                                    onPress={() => {
                                        if (cat.id === 'Other') {
                                            setShowOtherInput(true);
                                            setExpenseData({ ...expenseData, category: 'Other' });
                                        } else {
                                            setShowOtherInput(false);
                                            setExpenseData({ ...expenseData, category: cat.id });
                                        }
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={cat.icon}
                                        size={16}
                                        color={expenseData.category === cat.id ? colors.WHITE : colors.TEXT_SECONDARY}
                                    />
                                    <Text style={[
                                        styles.chipText,
                                        expenseData.category === cat.id && styles.activeChipText
                                    ]}>{cat.id}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {showOtherInput && (
                            <TextInput
                                style={[styles.input, { marginTop: 10 }]}
                                placeholder="Enter other category"
                                autoFocus
                                onChangeText={(text) => setExpenseData({ ...expenseData, category: text })}
                            />
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowExpenseModal(false);
                                    setShowOtherInput(false);
                                }}
                                style={styles.modalBtn}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    handleAddExpense();
                                    setShowOtherInput(false);
                                }}
                                style={[styles.modalBtn, styles.saveBtn]}
                            >
                                <Text style={styles.saveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Customer Modal */}
            <Modal
                visible={showAddModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add New Customer</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Customer Name"
                            value={newLedgerName}
                            onChangeText={setNewLedgerName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAddModal(false);
                                    setNewLedgerName('');
                                }}
                                style={styles.modalBtn}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddLedger}
                                style={[styles.modalBtn, styles.saveBtn]}
                            >
                                <Text style={styles.saveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Sort Modal */}
            <Modal
                visible={showSortModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSortModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSortModal(false)}
                >
                    <View style={styles.menuContent}>
                        <Text style={styles.menuTitle}>Sort Expenses By</Text>
                        {[
                            { id: 'date_desc', label: 'Newest First', icon: 'calendar-arrow-down' },
                            { id: 'date_asc', label: 'Oldest First', icon: 'calendar-arrow-up' },
                            { id: 'amount_desc', label: 'Highest Amount', icon: 'sort-numeric-descending' },
                            { id: 'amount_asc', label: 'Lowest Amount', icon: 'sort-numeric-ascending' },
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                style={styles.menuItem}
                                onPress={() => {
                                    setExpenseSortBy(opt.id);
                                    setShowSortModal(false);
                                }}
                            >
                                <View style={styles.menuItemContent}>
                                    <MaterialCommunityIcons
                                        name={opt.icon}
                                        size={22}
                                        color={expenseSortBy === opt.id ? colors.PRIMARY : colors.TEXT_SECONDARY}
                                    />
                                    <Text style={[
                                        styles.menuItemText,
                                        expenseSortBy === opt.id && { color: colors.PRIMARY, fontWeight: 'bold' }
                                    ]}>{opt.label}</Text>
                                    {expenseSortBy === opt.id && (
                                        <Ionicons name="checkmark" size={20} color={colors.PRIMARY} style={{ marginLeft: 'auto' }} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Customer Sort Modal */}
            <Modal
                visible={showCustomerSortModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCustomerSortModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCustomerSortModal(false)}
                >
                    <View style={styles.menuContent}>
                        <Text style={styles.menuTitle}>Sort Customers By</Text>
                        {[
                            { id: 'recent', label: 'Newest First', icon: 'calendar-arrow-down' },
                            { id: 'oldest', label: 'Oldest First', icon: 'calendar-arrow-up' },
                            { id: 'balance_desc', label: 'Amount: High to Low', icon: 'sort-numeric-descending' },
                            { id: 'balance_asc', label: 'Amount: Low to High', icon: 'sort-numeric-ascending' },
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                style={styles.menuItem}
                                onPress={() => {
                                    setCustomerSortBy(opt.id);
                                    setShowCustomerSortModal(false);
                                }}
                            >
                                <View style={styles.menuItemContent}>
                                    <MaterialCommunityIcons
                                        name={opt.icon}
                                        size={22}
                                        color={customerSortBy === opt.id ? colors.PRIMARY : colors.TEXT_SECONDARY}
                                    />
                                    <Text style={[
                                        styles.menuItemText,
                                        customerSortBy === opt.id && { color: colors.PRIMARY, fontWeight: 'bold' }
                                    ]}>{opt.label}</Text>
                                    {customerSortBy === opt.id && (
                                        <Ionicons name="checkmark" size={20} color={colors.PRIMARY} style={{ marginLeft: 'auto' }} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal
                visible={showMenuModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowMenuModal(false);
                    setSelectedLedger(null);
                }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setShowMenuModal(false);
                        setSelectedLedger(null);
                    }}
                >
                    <View style={styles.menuContent}>
                        {selectedLedger ? (
                            <>
                                <Text style={styles.menuTitle}>{selectedLedger.name}</Text>
                                <TouchableOpacity style={styles.menuItem} onPress={handleLedgerDelete}>
                                    <View style={styles.menuItemContent}>
                                        <Ionicons name="trash-outline" size={24} color={colors.ERROR} />
                                        <Text style={[styles.menuItemText, { color: colors.ERROR }]}>Delete Customer</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        navigation.navigate('LedgerDetail', { ledger: selectedLedger });
                                        setShowMenuModal(false);
                                        setSelectedLedger(null);
                                    }}
                                >
                                    <View style={styles.menuItemContent}>
                                        <Ionicons name="person-outline" size={24} color={colors.TEXT_PRIMARY} />
                                        <Text style={styles.menuItemText}>View Profile</Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.menuTitle}>More Options</Text>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setShowMenuModal(false);
                                        navigation.navigate('UserProfile');
                                    }}
                                >
                                    <View style={styles.menuItemContent}>
                                        <Ionicons name="person-circle-outline" size={24} color={colors.PRIMARY} />
                                        <Text style={styles.menuItemText}>Account Profile</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setShowMenuModal(false);
                                        handleBackupNow();
                                    }}
                                >
                                    <View style={styles.menuItemContent}>
                                        <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={colors.PRIMARY} />
                                        <Text style={styles.menuItemText}>Backup Data</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setShowMenuModal(false);
                                        alert('MazKhat v1.0.1\nA premium ledger app.');
                                    }}
                                >
                                    <View style={styles.menuItemContent}>
                                        <Ionicons name="information-circle-outline" size={24} color={colors.TEXT_SECONDARY} />
                                        <Text style={styles.menuItemText}>About</Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomWidth: 0 }]}
                            onPress={() => {
                                setShowMenuModal(false);
                                setSelectedLedger(null);
                            }}
                        >
                            <Text style={styles.cancelLink}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            {/* Category Manager */}
            <CategoryManager
                visible={showCategoryManager}
                onClose={() => {
                    setShowCategoryManager(false);
                    setTimeout(() => setShowExpenseModal(true), 200);
                }}
                categories={categories}
                onUpdate={setCategories}
            />
        </SafeAreaView>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    topProfileBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: colors.BACKGROUND,
    },
    profileLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileInfo: {
        marginLeft: 10,
    },
    welcomeText: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        textTransform: 'uppercase',
    },
    userName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#9C27B0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    syncIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0BAB7C',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.BACKGROUND,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginLeft: 8,
        elevation: 2,
    },
    backupPill: {
        backgroundColor: colors.PRIMARY,
    },
    importPill: {
        backgroundColor: '#E1F5FE',
        borderWidth: 1,
        borderColor: colors.PRIMARY,
    },
    pillBtnText: {
        color: colors.WHITE,
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 4,
    },
    tabRowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.CARD_BG,
        marginHorizontal: 15,
        borderRadius: 25,
        padding: 4,
        marginTop: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.isDark ? colors.BORDER : '#F0F4F3',
    },
    tabRow: {
        flexDirection: 'row',
        flex: 1,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: colors.CARD_BG,
        elevation: 1,
        boxShadow: colors.isDark ? '0px 1px 2px rgba(255, 255, 255, 0.1)' : '0px 1px 2px rgba(0, 0, 0, 0.1)',
    },
    tabText: {
        color: colors.TEXT_SECONDARY,
        fontWeight: '500',
        fontSize: 14,
    },
    activeTabText: {
        color: colors.PRIMARY,
        fontWeight: 'bold',
    },
    actionIcons: {
        flexDirection: 'row',
        paddingHorizontal: 10,
    },
    actionIcon: {
        marginLeft: 15,
    },
    netBalanceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.CARD_BG,
        marginHorizontal: 15,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.isDark ? colors.BORDER : '#F0F4F3',
        marginBottom: 10,
    },
    netBalanceLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.TEXT_PRIMARY,
    },
    accountCount: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    accountCountText: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginLeft: 4,
    },
    netBalanceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    balanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    balanceSubText: {
        fontSize: 11,
        color: colors.TEXT_LIGHT,
        textAlign: 'right',
        marginTop: 2,
    },
    fab: {
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        bottom: 80,
        right: 20,
        backgroundColor: colors.isDark ? '#2E7D32' : '#C8E6C9',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        elevation: 5,
        boxShadow: colors.isDark ? '0px 2px 4px rgba(0, 0, 0, 0.4)' : '0px 2px 4px rgba(0, 0, 0, 0.2)',
    },
    fabInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fabLabel: {
        color: colors.TEXT_PRIMARY,
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 14,
    },
    summaryBox: {
        flexDirection: 'row',
        paddingVertical: 15,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        marginBottom: 5,
        fontWeight: 'bold',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    list: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.CARD_BG,
        width: '85%',
        padding: 24,
        borderRadius: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        color: colors.TEXT_PRIMARY,
    },
    input: {
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.PRIMARY,
        fontSize: 16,
        paddingVertical: 8,
        marginBottom: 30,
        backgroundColor: 'transparent',
        color: colors.TEXT_PRIMARY,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            }
        })
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    cancelText: {
        color: colors.TEXT_SECONDARY,
    },
    bottomNav: {
        flexDirection: 'row',
        backgroundColor: colors.CARD_BG,
        paddingBottom: Platform.OS === 'ios' ? 25 : 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
        justifyContent: 'space-around',
        alignItems: 'center',
        position: Platform.OS === 'web' ? 'fixed' : 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    navItem: {
        alignItems: 'center',
        flex: 1,
    },
    insightsPill: {
        alignItems: 'center',
    },
    navText: {
        fontSize: 10,
        marginTop: 4,
        color: colors.TEXT_SECONDARY,
    },
    menuContent: {
        backgroundColor: colors.CARD_BG,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    menuItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: colors.TEXT_PRIMARY,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
        paddingBottom: 10,
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: 16,
        marginLeft: 15,
        color: colors.TEXT_PRIMARY,
    },
    cancelLink: {
        textAlign: 'center',
        color: colors.TEXT_SECONDARY,
        fontSize: 16,
        paddingTop: 10,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.TEXT_SECONDARY,
        marginBottom: 10,
        marginTop: 10,
    },
    categoryChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        marginRight: 8,
        marginBottom: 8,
    },
    activeChip: {
        elevation: 2,
    },
    chipText: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginLeft: 6,
    },
    activeChipText: {
        color: colors.WHITE,
        fontWeight: 'bold',
    },
    expenseItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.CARD_BG,
        marginHorizontal: 15,
        marginVertical: 4,
        padding: 15,
        borderRadius: 12,
        elevation: 1,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    expenseLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    expenseIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    expenseTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.TEXT_PRIMARY,
    },
    expenseCategory: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
    },
    expenseAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.DEBIT_RED,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    manageBtnText: {
        color: colors.PRIMARY,
        fontSize: 12,
        fontWeight: 'bold',
    },
    manageCatItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    manageCatLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    manageCatText: {
        fontSize: 15,
        marginLeft: 12,
        color: colors.TEXT_PRIMARY,
    },
    addCatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        paddingLeft: 10,
    },
    addCatPlus: {
        backgroundColor: colors.PRIMARY,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    sortIconBadge: {
        position: 'relative',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    sortChevron: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: colors.WHITE,
        borderRadius: 5,
    },
    searchContainer: {
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    searchPremiumWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.CARD_BG,
        borderRadius: 25,
        paddingHorizontal: 18,
        height: 50,
        elevation: 4,
        boxShadow: colors.isDark ? '0px 4px 8px rgba(0, 0, 0, 0.4)' : '0px 4px 8px rgba(0, 0, 0, 0.08)',
        borderWidth: 1,
        borderColor: colors.isDark ? colors.BORDER : '#F0F0F0',
    },
    searchBarInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        color: colors.TEXT_PRIMARY,
        fontWeight: '500',
        ...Platform.select({
            web: {
                outlineWidth: 0,
                outlineColor: 'transparent',
                outlineStyle: 'none',
            }
        })
    },
    autoBackupStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F0F7FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.isDark ? '#444' : '#E0EFFF',
    },
    statusTextCol: {
        marginLeft: 8,
    },
    statusMainText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    statusSubText: {
        fontSize: 9,
        color: colors.TEXT_SECONDARY,
        marginTop: -1,
    },
});
