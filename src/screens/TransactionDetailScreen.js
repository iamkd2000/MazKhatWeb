// Transaction Detail Screen - View, Edit, and Delete transactions
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { deleteTransaction } from '../utils/storage';
import SecurityVerifyModal from '../components/SecurityVerifyModal';
import { useTheme } from '../context/ThemeContext';

export default function TransactionDetailScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { transaction, ledger } = route.params;
    const isCredit = transaction.type === 'credit';
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // 'edit' or 'delete'

    const handleDelete = () => {
        setPendingAction('delete');
        setShowSecurityModal(true);
    };

    const confirmDelete = async () => {
        const success = await deleteTransaction(ledger.id, transaction.id);
        if (success) {
            navigation.goBack();
        } else {
            if (Platform.OS === 'web') window.alert('Failed to delete transaction');
        }
    };

    const handleEdit = () => {
        setPendingAction('edit');
        setShowSecurityModal(true);
    };

    const confirmEdit = () => {
        navigation.navigate('AddTransaction', {
            ledger,
            type: transaction.type,
            editTransaction: transaction
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transaction Details</Text>
                <TouchableOpacity onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={24} color={colors.WHITE} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.amountBox}>
                        <Text style={[styles.amountText, { color: isCredit ? colors.CREDIT_GREEN : colors.DEBIT_RED }]}>
                            ₹{transaction.amount.toLocaleString()}
                        </Text>
                        <Text style={styles.typeLabel}>{isCredit ? 'Money Received (Credit)' : 'Money Given (Debit)'}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.TEXT_SECONDARY} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Date & Time</Text>
                            <Text style={styles.infoValue}>
                                {new Date(transaction.date).toLocaleString('en-GB', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="note-text-outline" size={22} color={colors.TEXT_SECONDARY} />
                        <View style={styles.infoTextContainer}>
                            <Text style={styles.infoLabel}>Note</Text>
                            <Text style={styles.infoValue}>{transaction.note || 'No note added'}</Text>
                        </View>
                    </View>

                    {transaction.billPhoto && (
                        <View style={styles.photoSection}>
                            <Text style={styles.photoLabel}>Attached Bill</Text>
                            <Image
                                source={{ uri: transaction.billPhoto }}
                                style={styles.billImage}
                                resizeMode="contain"
                            />
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
                    <Ionicons name="create-outline" size={20} color={colors.WHITE} />
                    <Text style={styles.editBtnText}>Edit Transaction</Text>
                </TouchableOpacity>
            </ScrollView>

            <SecurityVerifyModal
                visible={showSecurityModal}
                title={pendingAction === 'edit' ? "Verify to Edit" : "Verify to Delete"}
                onSuccess={() => {
                    setShowSecurityModal(false);
                    if (pendingAction === 'edit') confirmEdit();
                    else confirmDelete();
                }}
                onCancel={() => setShowSecurityModal(false)}
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
    header: {
        backgroundColor: colors.PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: Platform.OS === 'ios' ? 50 : 15,
        justifyContent: 'space-between',
    },
    backButton: {
        marginRight: 10,
    },
    headerTitle: {
        color: colors.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    content: {
        padding: 20,
    },
    card: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 15,
        padding: 20,
        elevation: 3,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        marginBottom: 30,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    amountBox: {
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
        paddingBottom: 20,
        marginBottom: 20,
    },
    amountText: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    typeLabel: {
        fontSize: 14,
        color: colors.TEXT_SECONDARY,
        marginTop: 5,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    infoTextContainer: {
        marginLeft: 15,
    },
    infoLabel: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
    },
    infoValue: {
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
        fontWeight: '500',
    },
    photoSection: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
        paddingTop: 20,
    },
    photoLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        marginBottom: 10,
    },
    billImage: {
        width: '100%',
        height: 300,
        borderRadius: 8,
        backgroundColor: colors.isDark ? '#222' : '#F0F0F0',
    },
    editBtn: {
        backgroundColor: colors.PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 30,
    },
    editBtnText: {
        color: colors.WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});
