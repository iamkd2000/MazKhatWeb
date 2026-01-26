// Ledger Card Component - Premium Summary View
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const LedgerCard = React.memo(function LedgerCard({ ledger, onPress, onLongPress }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const lastTransaction = ledger.transactions && ledger.transactions.length > 0
        ? ledger.transactions[ledger.transactions.length - 1]
        : null;

    const summaryText = lastTransaction
        ? `₹${Math.abs(lastTransaction.amount).toLocaleString()} ${lastTransaction.type === 'credit' ? 'Credit' : 'Debit'} ${lastTransaction.is_deleted ? 'Deleted' : (lastTransaction.is_edited ? 'Edited' : 'Added')} Yesterday`
        : 'No transactions yet';

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            <View style={styles.leftContent}>
                <View style={[styles.avatar, { backgroundColor: '#BBDEFB' }]}>
                    <Text style={[styles.avatarText, { color: '#1976D2' }]}>
                        {ledger.name.charAt(0).toUpperCase()}
                    </Text>
                    <View style={styles.statusDot}>
                        <MaterialCommunityIcons name="whatsapp" size={10} color="#FFF" />
                    </View>
                </View>
                <View style={styles.infoContainer}>
                    <Text style={styles.name}>{ledger.name}</Text>
                    <View style={styles.summaryRow}>
                        {lastTransaction && <Ionicons name="checkmark" size={14} color={colors.TEXT_LIGHT} />}
                        <Text style={styles.timeText} numberOfLines={1}>{summaryText}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.balanceContainer}>
                <Text style={[styles.balanceValue, { color: ledger.balance > 0 ? colors.DEBIT_RED : colors.CREDIT_GREEN }]}>
                    ₹{Math.abs(ledger.balance).toLocaleString()}
                </Text>
                <Text style={[styles.statusText, { color: ledger.balance > 0 ? colors.DEBIT_RED : colors.CREDIT_GREEN }]}>
                    {ledger.balance >= 0 ? 'Due' : 'Advance'}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

const getStyles = (colors) => StyleSheet.create({
    card: {
        backgroundColor: colors.CARD_BG,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
        position: 'relative',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#0BAB7C',
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.CARD_BG,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.TEXT_PRIMARY,
        marginBottom: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginLeft: 2,
    },
    balanceContainer: {
        alignItems: 'flex-end',
    },
    balanceValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
