// Transaction Item Component - Premium High-End Chat UI
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const TransactionItem = React.memo(function TransactionItem({ transaction, onPress }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { type, amount, date, balanceAfter, note, billPhoto } = transaction;
    const isCredit = type === 'credit'; // Actually "Given" (Green) in user's request
    const isGiven = !isCredit; // Red side? No, wait.

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.wrapper, isCredit ? styles.wrapperRight : styles.wrapperLeft]}
        >
            <View style={[
                styles.bubble,
                isCredit ? styles.bubbleRight : styles.bubbleLeft,
                { borderColor: isCredit ? colors.DEBIT_RED + '40' : colors.CREDIT_GREEN + '40' }
            ]}>
                <View style={styles.bubbleHeader}>
                    <MaterialCommunityIcons
                        name={isCredit ? "arrow-up-circle" : "arrow-down-circle"}
                        size={18}
                        color={isCredit ? colors.DEBIT_RED : colors.CREDIT_GREEN}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.amountText}>
                        ₹{amount.toLocaleString()}
                    </Text>
                    {billPhoto && (
                        <MaterialCommunityIcons name="image-outline" size={16} color={colors.PRIMARY} style={{ marginRight: 5 }} />
                    )}
                    <Text style={styles.timeText}>{formatTime(date)}</Text>
                    <Ionicons name="checkmark-done" size={14} color="#90A4AE" style={{ marginLeft: 4 }} />
                </View>

                <Text style={styles.noteText}>{note || (isCredit ? 'Payment Given' : 'Payment Received')}</Text>
            </View>

            <View style={[styles.dueBadge, isCredit ? styles.dueBadgeRight : styles.dueBadgeLeft]}>
                <Text style={styles.dueText}>
                    ₹{balanceAfter.toLocaleString()} {balanceAfter >= 0 ? 'Due' : 'Advance'}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

export default TransactionItem;

// Importing Ionicons here locally to avoid errors if not in global scope
import { Ionicons } from '@expo/vector-icons';

const getStyles = (colors) => StyleSheet.create({
    wrapper: {
        marginVertical: 4,
        marginHorizontal: 12,
        maxWidth: '85%',
    },
    wrapperLeft: {
        alignSelf: 'flex-start',
    },
    wrapperRight: {
        alignSelf: 'flex-end',
    },
    bubble: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        ...Platform.select({
            web: {
                boxShadow: colors.isDark ? '0px 2px 6px rgba(0, 0, 0, 0.4)' : '0px 2px 6px rgba(0, 0, 0, 0.06)',
            },
            default: {
                elevation: 2,
                shadowColor: colors.BLACK,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
            }
        })
    },
    bubbleLeft: {
        borderBottomLeftRadius: 4,
    },
    bubbleRight: {
        borderBottomRightRadius: 4,
    },
    bubbleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    amountText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        marginRight: 6,
    },
    timeText: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        marginLeft: 4,
    },
    noteText: {
        fontSize: 14,
        color: colors.TEXT_PRIMARY,
        opacity: 0.8,
        lineHeight: 18,
    },
    dueBadge: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-end',
    },
    dueBadgeLeft: {
        alignSelf: 'flex-start',
    },
    dueBadgeRight: {
        alignSelf: 'flex-end',
    },
    dueText: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        fontWeight: '500',
    },
});
