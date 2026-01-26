// Customer Statement Screen - Professional PDF Report UI
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    SafeAreaView,
    StatusBar,
    Alert,
    Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { generateLedgerPDF } from '../utils/pdfGenerator';
import { useTheme } from '../context/ThemeContext';

export default function StatementScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { ledger } = route.params;
    const [selectedFilter, setSelectedFilter] = useState('overall');
    const [loading, setLoading] = useState(false);
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30))); // Default 30 days ago
    const [customEndDate, setCustomEndDate] = useState(new Date());

    // Date filter logic
    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const transactions = ledger.transactions || [];

        switch (selectedFilter) {
            case 'thisMonth':
                return transactions.filter(t => {
                    const txnDate = new Date(t.date);
                    return txnDate.getMonth() === now.getMonth() &&
                        txnDate.getFullYear() === now.getFullYear();
                });
            case 'last7days':
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
            case 'dateRange':
                return transactions.filter(t => {
                    const d = new Date(t.date);
                    // Reset times for accurate date comparison
                    const start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
                    const end = new Date(customEndDate); end.setHours(23, 59, 59, 999);
                    return d >= start && d <= end;
                });
            case 'overall':
            default:
                return transactions;
        }
    }, [ledger.transactions, selectedFilter, customStartDate, customEndDate]);

    // Calculate totals
    const totals = useMemo(() => {
        let payment = 0;
        let credit = 0;
        filteredTransactions.forEach(t => {
            if (t.type === 'credit') payment += t.amount;
            else credit += t.amount;
        });
        return { payment, credit };
    }, [filteredTransactions]);

    const handleDownload = async () => {
        setLoading(true);
        const result = await generateLedgerPDF(ledger, filteredTransactions);
        setLoading(false);
        if (result.success) {
            if (Platform.OS === 'web') {
                // Feedback is less critical here as the print dialog will appear
            } else {
                Alert.alert('Success', 'PDF generated successfully');
            }
        } else {
            const errorMsg = result.error || 'Failed to generate PDF';
            if (Platform.OS === 'web') {
                window.alert(errorMsg);
            } else {
                Alert.alert('Error', errorMsg);
            }
        }
    };

    const handleShare = async () => {
        setLoading(true);
        const result = await generateLedgerPDF(ledger, filteredTransactions);
        setLoading(false);
        if (result.success) {
            // Share logic will be handled by expo-sharing in pdfGenerator
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        return { day, month };
    };

    const getDateRange = () => {
        if (filteredTransactions.length === 0) return 'No transactions';
        const dates = filteredTransactions.map(t => new Date(t.date)).sort((a, b) => a - b);
        const start = dates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const end = dates[dates.length - 1].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${start} - ${end}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.CARD_BG} />

            {/* Visible Scrollbar for Web */}
            {Platform.OS === 'web' && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    * {
                        scrollbar-width: thin;
                        scrollbar-color: ${colors.PRIMARY} ${colors.BACKGROUND};
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
                        background: ${colors.BACKGROUND};
                    }
                    ::-webkit-scrollbar-thumb {
                        background: ${colors.PRIMARY}80;
                        border-radius: 5px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: ${colors.PRIMARY};
                    }
                `}} />
            )}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.TEXT_PRIMARY} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Customer Statement</Text>
                    <Text style={styles.headerSubtitle}>
                        Current Balance <Text style={{ color: ledger.balance >= 0 ? colors.DEBIT_RED : colors.CREDIT_GREEN }}>
                            ₹{Math.abs(ledger.balance).toLocaleString()}
                        </Text>
                    </Text>
                </View>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.chip, selectedFilter === 'overall' && styles.chipActive]}
                    onPress={() => setSelectedFilter('overall')}
                >
                    <Text style={[styles.chipText, selectedFilter === 'overall' && styles.chipTextActive]}>Overall</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.chip, selectedFilter === 'dateRange' && styles.chipActive]}
                    onPress={() => {
                        setSelectedFilter('dateRange');
                        setShowDateRangeModal(true);
                    }}
                >
                    <Text style={[styles.chipText, selectedFilter === 'dateRange' && styles.chipTextActive]}>Date Range</Text>
                    <Ionicons name="chevron-down" size={16} color={selectedFilter === 'dateRange' ? colors.PRIMARY : colors.TEXT_SECONDARY} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.chip, selectedFilter === 'thisMonth' && styles.chipActive]}
                    onPress={() => setSelectedFilter('thisMonth')}
                >
                    <Text style={[styles.chipText, selectedFilter === 'thisMonth' && styles.chipTextActive]}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.chip, selectedFilter === 'last7days' && styles.chipActive]}
                    onPress={() => setSelectedFilter('last7days')}
                >
                    <Text style={[styles.chipText, selectedFilter === 'last7days' && styles.chipTextActive]}>Last 7 days</Text>
                </TouchableOpacity>
            </View>

            {/* Balance Summary */}
            <View style={styles.summaryCard}>
                <Text style={styles.balanceAmount}>₹{Math.abs(ledger.balance).toLocaleString()}</Text>
                <Text style={styles.balanceLabel}>Balance | {getDateRange()}</Text>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Payment ({filteredTransactions.filter(t => t.type === 'credit').length})</Text>
                        <Text style={[styles.summaryValue, { color: colors.CREDIT_GREEN }]}>₹{totals.payment.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Credit ({filteredTransactions.filter(t => t.type === 'debit').length})</Text>
                        <Text style={[styles.summaryValue, { color: colors.DEBIT_RED }]}>₹{totals.credit.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            {/* Transaction List */}
            <ScrollView style={styles.transactionList} contentContainerStyle={styles.transactionListContent}>
                {filteredTransactions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="file-document-outline" size={60} color="#E0E0E0" />
                        <Text style={styles.emptyText}>No transactions in this period</Text>
                    </View>
                ) : (
                    filteredTransactions.map((txn) => {
                        const { day, month } = formatDate(txn.date);
                        const isCredit = txn.type === 'credit';
                        return (
                            <View key={txn.id} style={styles.transactionRow}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dateDay}>{day}</Text>
                                    <Text style={styles.dateMonth}>{month}</Text>
                                </View>
                                <View style={styles.transactionDetails}>
                                    <View style={styles.transactionAmount}>
                                        <Ionicons
                                            name={isCredit ? "arrow-down" : "arrow-up"}
                                            size={18}
                                            color={isCredit ? colors.CREDIT_GREEN : colors.DEBIT_RED}
                                        />
                                        <Text style={[styles.amountText, { color: isCredit ? colors.CREDIT_GREEN : colors.DEBIT_RED }]}>
                                            ₹{txn.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.transactionType}>
                                        {isCredit ? 'Payment Received' : 'Payment Given'}
                                    </Text>
                                    <Text style={styles.balanceAfter}>₹{Math.abs(txn.balanceAfter || 0).toLocaleString()} Due</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.downloadButton]}
                    onPress={handleDownload}
                    disabled={loading}
                >
                    <Ionicons name="download-outline" size={20} color={colors.PRIMARY} />
                    <Text style={styles.downloadText}>{loading ? 'Generating...' : 'Download'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.shareButton]}
                    onPress={handleShare}
                    disabled={loading}
                >
                    <MaterialCommunityIcons name="whatsapp" size={20} color={colors.WHITE} />
                    <Text style={styles.shareText}>Share</Text>
                </TouchableOpacity>
            </View>

            {/* Date Range Modal */}
            <Modal visible={showDateRangeModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Date Range</Text>

                        <View style={styles.dateInputRow}>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>Start Date</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        max="9999-12-31"
                                        value={customStartDate.toISOString().split('T')[0]}
                                        onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                                        style={styles.webDateInput}
                                    />
                                ) : (
                                    <Text style={styles.dateValue}>{customStartDate.toLocaleDateString()}</Text>
                                    // Native picker would go here
                                )}
                            </View>
                            <View style={styles.dateField}>
                                <Text style={styles.dateLabel}>End Date</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        max="9999-12-31"
                                        value={customEndDate.toISOString().split('T')[0]}
                                        onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                                        style={styles.webDateInput}
                                    />
                                ) : (
                                    <Text style={styles.dateValue}>{customEndDate.toLocaleDateString()}</Text>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={() => setShowDateRangeModal(false)}
                        >
                            <Text style={styles.applyButtonText}>Apply Filter</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        backgroundColor: colors.CARD_BG,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    backButton: {
        marginRight: 15,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    headerSubtitle: {
        fontSize: 13,
        color: colors.TEXT_SECONDARY,
        marginTop: 2,
    },
    filterContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: colors.CARD_BG,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.BORDER,
        marginRight: 10,
        backgroundColor: colors.CARD_BG,
    },
    chipActive: {
        backgroundColor: colors.isDark ? '#1F2A23' : '#E8F5E9',
        borderColor: colors.CREDIT_GREEN,
    },
    chipText: {
        fontSize: 13,
        color: colors.TEXT_SECONDARY,
        marginRight: 5,
    },
    chipTextActive: {
        color: colors.CREDIT_GREEN,
        fontWeight: '600',
    },
    summaryCard: {
        backgroundColor: colors.CARD_BG,
        margin: 15,
        padding: 20,
        borderRadius: 15,
        elevation: 2,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.DEBIT_RED,
        textAlign: 'center',
    },
    balanceLabel: {
        fontSize: 13,
        color: colors.TEXT_SECONDARY,
        textAlign: 'center',
        marginTop: 5,
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
        paddingTop: 15,
    },
    summaryItem: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginBottom: 5,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    transactionList: {
        flex: 1,
    },
    transactionListContent: {
        padding: 15,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: colors.TEXT_SECONDARY,
        marginTop: 15,
    },
    transactionRow: {
        flexDirection: 'row',
        backgroundColor: colors.CARD_BG,
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        elevation: 1,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    dateBox: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F5F5F5',
        borderRadius: 8,
        padding: 8,
    },
    dateDay: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    dateMonth: {
        fontSize: 11,
        color: colors.TEXT_SECONDARY,
        marginTop: 2,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionAmount: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    amountText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 5,
    },
    transactionType: {
        fontSize: 13,
        color: colors.TEXT_PRIMARY,
        marginBottom: 3,
    },
    balanceAfter: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
    },
    bottomActions: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: colors.CARD_BG,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        borderRadius: 30,
        marginHorizontal: 5,
    },
    downloadButton: {
        backgroundColor: colors.CARD_BG,
        borderWidth: 2,
        borderColor: colors.PRIMARY,
    },
    shareButton: {
        backgroundColor: '#25D366',
    },
    downloadText: {
        color: colors.PRIMARY,
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    shareText: {
        color: colors.WHITE,
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    webDateInput: {
        fontSize: 14,
        padding: 5,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: colors.BORDER,
        width: '100%',
        marginTop: 5,
        backgroundColor: colors.isDark ? '#222' : '#FFF',
        color: colors.TEXT_PRIMARY,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 15,
        padding: 25,
        width: '90%',
        maxWidth: 400,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: colors.TEXT_PRIMARY,
    },
    dateInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    dateField: {
        flex: 1,
        marginHorizontal: 5,
    },
    dateLabel: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginBottom: 5,
    },
    applyButton: {
        backgroundColor: colors.PRIMARY,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    applyButtonText: {
        color: colors.WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
});
