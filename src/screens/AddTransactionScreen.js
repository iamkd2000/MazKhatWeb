// Add Transaction Screen - Premium Interface with Keypad & Edit Support
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    SafeAreaView,
    ScrollView,
    Modal,
    TextInput,
    StatusBar
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { saveLedger } from '../utils/storage';
import { evaluateMathExpression, calculateBalance, generateId } from '../utils/calculations';
import { useTheme } from '../context/ThemeContext';

export default function AddTransactionScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { ledger, type, editTransaction } = route.params;
    const [amount, setAmount] = useState('0');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }));
    const [billPhoto, setBillPhoto] = useState(null);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [showDateModal, setShowDateModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const isCredit = type === 'credit';
    const primaryColor = isCredit ? colors.CREDIT_GREEN : colors.DEBIT_RED;

    useEffect(() => {
        if (editTransaction) {
            setAmount(editTransaction.amount.toString());
            setNote(editTransaction.note || '');
            setDate(editTransaction.displayDate || new Date(editTransaction.date).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }));
            setSelectedDate(new Date(editTransaction.date));
            setBillPhoto(editTransaction.billPhoto);
        }

        // Handle physical keyboard input for Web
        if (Platform.OS === 'web') {
            const handleKeyDown = (e) => {
                // Ignore if the user is typing in an input field or textarea
                const isInput = e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.isContentEditable;

                if (isInput) return;

                if (e.key >= '0' && e.key <= '9') {
                    handleKeyPress(e.key);
                } else if (e.key === '.') {
                    handleKeyPress('.');
                } else if (e.key === 'Backspace') {
                    handleKeyPress('back');
                } else if (e.key === 'Enter') {
                    handleConfirm();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [editTransaction, amount, note, date]); // Dependency on amount/note/date to ensure handleConfirm/handleKeyPress use latest state

    const handleKeyPress = (val) => {
        if (val === 'back') {
            setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (val === '.') {
            if (!amount.includes('.')) setAmount(prev => prev + '.');
        } else if (['+', '-', '*', '/'].includes(val)) {
            setAmount(prev => prev + val);
        } else {
            setAmount(prev => prev === '0' ? val : prev + val);
        }
    };

    const handleConfirm = async () => {
        const numAmount = evaluateMathExpression(amount);
        if (numAmount <= 0) {
            if (Platform.OS === 'web') window.alert('Please enter a valid amount');
            return;
        }

        let updatedTransactions;
        const transactionData = {
            id: editTransaction ? editTransaction.id : generateId(),
            type: type,
            amount: numAmount,
            note: note,
            date: selectedDate.toISOString(),
            displayDate: date,
            billPhoto: billPhoto,
        };

        if (editTransaction) {
            updatedTransactions = ledger.transactions.map(t =>
                t.id === editTransaction.id ? transactionData : t
            );
        } else {
            updatedTransactions = [...ledger.transactions, transactionData];
        }

        // Sort transactions by date ensure balance calculation is chronological
        updatedTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Recalculate balances for all transactions to maintain consistency
        let runningBalance = 0;
        updatedTransactions = updatedTransactions.map(t => {
            if (t.type === 'credit') runningBalance += t.amount;
            else runningBalance -= t.amount;
            return { ...t, balanceAfter: runningBalance };
        });

        const newBalance = runningBalance;

        const updatedLedger = {
            ...ledger,
            balance: newBalance,
            transactions: updatedTransactions,
        };

        const success = await saveLedger(updatedLedger);
        if (success) {
            if (editTransaction) {
                // Return to ledger screen, skip the detail view
                navigation.navigate('LedgerDetail', { ledger: updatedLedger });
            } else {
                navigation.goBack();
            }
        } else {
            if (Platform.OS === 'web') window.alert('Failed to save transaction');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.TEXT_SECONDARY} />
                </TouchableOpacity>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{ledger.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerName}>{ledger.name}</Text>
                    <Text style={[styles.headerDue, { color: colors.DEBIT_RED }]}>
                        ₹{Math.abs(ledger.balance).toLocaleString()} Due
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.limitBanner}>
                    <Text style={styles.limitText}>2/2 Daily Transaction Limit left on Basic Plan</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.TEXT_SECONDARY} />
                </View>

                <View style={styles.amountDisplay}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <Text style={[styles.amountText, { color: amount === '0' ? colors.TEXT_LIGHT : colors.TEXT_PRIMARY }]}>
                        {amount}
                    </Text>
                    {amount.match(/[+*/-]/) && (
                        <Text style={styles.calculationPreview}>= ₹{evaluateMathExpression(amount)}</Text>
                    )}
                    <View style={[styles.amountUnderline, { backgroundColor: primaryColor }]} />
                </View>

                <View style={styles.actionList}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => setShowNoteModal(true)}>
                        <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.TEXT_SECONDARY} />
                        <Text style={styles.actionLabel}>{note || 'Add Notes'}</Text>
                        <Ionicons name="mic-outline" size={24} color={colors.CREDIT_GREEN} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={() => setShowDateModal(true)}>
                        <MaterialCommunityIcons name="calendar-blank-outline" size={24} color={colors.TEXT_SECONDARY} />
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.dateLabel}>Bill Date</Text>
                            <Text style={styles.dateValue}>{date}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={colors.TEXT_SECONDARY} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={async () => {
                        const options = ['Take Photo', 'Choose from Gallery', 'Cancel'];
                        const cancelIndex = 2;

                        if (Platform.OS === 'web') {
                            const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
                            if (!result.canceled) setBillPhoto(result.assets[0].uri);
                            return;
                        }

                        Alert.alert(
                            'Add Receipt',
                            'Select an option',
                            [
                                {
                                    text: 'Take Photo',
                                    onPress: async () => {
                                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                                        if (status !== 'granted') {
                                            Alert.alert('Permission Denied', 'Camera access is required to take photos.');
                                            return;
                                        }
                                        const result = await ImagePicker.launchCameraAsync({
                                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                            quality: 0.7,
                                        });
                                        if (!result.canceled) setBillPhoto(result.assets[0].uri);
                                    }
                                },
                                {
                                    text: 'Choose from Gallery',
                                    onPress: async () => {
                                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                        if (status !== 'granted') {
                                            Alert.alert('Permission Denied', 'Media library access is required.');
                                            return;
                                        }
                                        const result = await ImagePicker.launchImageLibraryAsync({
                                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                            quality: 0.7,
                                        });
                                        if (!result.canceled) setBillPhoto(result.assets[0].uri);
                                    }
                                },
                                { text: 'Cancel', style: 'cancel' }
                            ]
                        );
                    }}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.TEXT_SECONDARY} />
                        <Text style={styles.actionLabel}>{billPhoto ? 'Bill Attached ✅' : 'Add Bills'}</Text>
                        <Ionicons name="add" size={24} color={colors.CREDIT_GREEN} />
                    </TouchableOpacity>
                </View>

                <Modal visible={showNoteModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Add Transaction Note</Text>
                            <TextInput
                                style={styles.noteInputBox}
                                placeholder="Enter note (e.g. online, item name)"
                                placeholderTextColor={colors.TEXT_LIGHT}
                                value={note}
                                onChangeText={setNote}
                                autoFocus
                                multiline={true}
                                blurOnSubmit={true}
                                onSubmitEditing={() => setShowNoteModal(false)}
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowNoteModal(false)}>
                                    <Text style={styles.modalDoneText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal visible={showDateModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.pickerModalContent}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Select Transaction Date</Text>
                                <TouchableOpacity onPress={() => setShowDateModal(false)}>
                                    <Ionicons name="close" size={24} color={colors.TEXT_PRIMARY} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.pickerBody}>
                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.pickerItem, selectedDate.getDate() === d && styles.activePickerItem]}
                                            onPress={() => {
                                                const d2 = new Date(selectedDate);
                                                d2.setDate(d);
                                                setSelectedDate(d2);
                                            }}
                                        >
                                            <Text style={[styles.pickerItemText, selectedDate.getDate() === d && styles.activePickerItemText]}>{d}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                                        <TouchableOpacity
                                            key={m}
                                            style={[styles.pickerItem, selectedDate.getMonth() === idx && styles.activePickerItem]}
                                            onPress={() => {
                                                const d2 = new Date(selectedDate);
                                                d2.setMonth(idx);
                                                setSelectedDate(d2);
                                            }}
                                        >
                                            <Text style={[styles.pickerItemText, selectedDate.getMonth() === idx && styles.activePickerItemText]}>{m}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <TouchableOpacity
                                            key={y}
                                            style={[styles.pickerItem, selectedDate.getFullYear() === y && styles.activePickerItem]}
                                            onPress={() => {
                                                const d2 = new Date(selectedDate);
                                                d2.setFullYear(y);
                                                setSelectedDate(d2);
                                            }}
                                        >
                                            <Text style={[styles.pickerItemText, selectedDate.getFullYear() === y && styles.activePickerItemText]}>{y}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={[styles.pickerHeader, { marginTop: 20 }]}>
                                <Text style={styles.pickerTitle}>Select Time</Text>
                            </View>

                            <View style={[styles.pickerBody, { height: 120 }]}>
                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                        <TouchableOpacity
                                            key={h}
                                            style={[styles.pickerItem, selectedDate.getHours() === h && styles.activePickerItem]}
                                            onPress={() => {
                                                const d2 = new Date(selectedDate);
                                                d2.setHours(h);
                                                setSelectedDate(d2);
                                            }}
                                        >
                                            <Text style={[styles.pickerItemText, selectedDate.getHours() === h && styles.activePickerItemText]}>{h.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 60 }, (_, i) => i).map(m => (
                                        <TouchableOpacity
                                            key={m}
                                            style={[styles.pickerItem, selectedDate.getMinutes() === m && styles.activePickerItem]}
                                            onPress={() => {
                                                const d2 = new Date(selectedDate);
                                                d2.setMinutes(m);
                                                setSelectedDate(d2);
                                            }}
                                        >
                                            <Text style={[styles.pickerItemText, selectedDate.getMinutes() === m && styles.activePickerItemText]}>{m.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.pickerFooter}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalConfirmBtn, { width: '100%' }]}
                                    onPress={() => {
                                        setDate(selectedDate.toLocaleString('en-GB', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        }));
                                        setShowDateModal(false);
                                    }}
                                >
                                    <Text style={styles.modalConfirmText}>SET DATE & TIME</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>

            <View style={styles.bottomSection}>
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.createBillBtn}>
                        <MaterialCommunityIcons name="text-box-search-outline" size={20} color={colors.TEXT_PRIMARY} />
                        <Text style={styles.createBillText}>Create Bill</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: primaryColor }]}
                        onPress={handleConfirm}
                    >
                        <Ionicons name="checkmark" size={20} color={colors.WHITE} />
                        <Text style={styles.confirmText}>
                            {editTransaction ? 'Update' : 'Confirm'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.keypad}>
                    <View style={styles.keyRow}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('1')}><Text style={styles.keyText}>1</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('2')}><Text style={styles.keyText}>2</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('3')}><Text style={styles.keyText}>3</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.key, { backgroundColor: colors.isDark ? '#422' : '#FFF5F5' }]} onPress={() => handleKeyPress('back')}>
                            <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.ERROR} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.keyRow}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('4')}><Text style={styles.keyText}>4</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('5')}><Text style={styles.keyText}>5</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('6')}><Text style={styles.keyText}>6</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('*')}><Text style={styles.keyText}>×</Text></TouchableOpacity>
                    </View>
                    <View style={styles.keyRow}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('7')}><Text style={styles.keyText}>7</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('8')}><Text style={styles.keyText}>8</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('9')}><Text style={styles.keyText}>9</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('-')}><Text style={styles.keyText}>−</Text></TouchableOpacity>
                    </View>
                    <View style={styles.keyRow}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('.')}><Text style={styles.keyText}>.</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('0')}><Text style={styles.keyText}>0</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.key, { backgroundColor: colors.isDark ? '#1B2C26' : '#E8F5E9' }]}><Text style={[styles.keyText, { color: colors.CREDIT_GREEN }]}>=</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('+')}><Text style={styles.keyText}>+</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.CARD_BG,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    backButton: {
        marginRight: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FDD835',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.WHITE,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    headerDue: {
        fontSize: 12,
        marginTop: 2,
    },
    scrollContent: {
        flexGrow: 1,
    },
    limitBanner: {
        backgroundColor: colors.isDark ? '#1B2C26' : '#F1F8F8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        margin: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.isDark ? colors.BORDER : '#E0EDED',
    },
    limitText: {
        fontSize: 13,
        color: colors.TEXT_PRIMARY,
    },
    amountDisplay: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: 30,
        marginBottom: 40,
    },
    currencySymbol: {
        fontSize: 32,
        color: colors.TEXT_PRIMARY,
        fontWeight: 'bold',
        marginRight: 5,
    },
    amountText: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    amountUnderline: {
        position: 'absolute',
        bottom: -10,
        width: '60%',
        height: 2,
    },
    calculationPreview: {
        position: 'absolute',
        bottom: -30,
        fontSize: 16,
        color: colors.TEXT_SECONDARY,
        fontWeight: '500',
    },
    actionList: {
        paddingHorizontal: 15,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F1F8F8',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    actionLabel: {
        fontSize: 15,
        color: colors.TEXT_SECONDARY,
        flex: 1,
        marginLeft: 15,
    },
    dateLabel: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
    },
    dateValue: {
        fontSize: 15,
        color: colors.TEXT_PRIMARY,
        fontWeight: '500',
    },
    bottomSection: {
        backgroundColor: colors.CARD_BG,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
    },
    actionButtons: {
        flexDirection: 'row',
        padding: 15,
        justifyContent: 'space-between',
    },
    createBillBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F1F8F8',
        paddingVertical: 12,
        borderRadius: 25,
        marginRight: 10,
    },
    createBillText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        marginLeft: 8,
    },
    confirmBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 25,
        marginLeft: 10,
    },
    confirmText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.WHITE,
        marginLeft: 8,
    },
    keypad: {
        backgroundColor: colors.isDark ? '#1A1A1A' : '#F8FBFB',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    keyRow: {
        flexDirection: 'row',
    },
    key: {
        flex: 1,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: colors.isDark ? '#333' : '#E0EDED',
    },
    keyText: {
        fontSize: 22,
        fontWeight: '400',
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
        width: '85%',
        padding: 24,
        borderRadius: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    noteInputBox: {
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.PRIMARY,
        fontSize: 16,
        paddingVertical: 10,
        marginBottom: 20,
        minHeight: 80,
        textAlignVertical: 'top',
        color: colors.TEXT_PRIMARY,
        ...Platform.select({
            web: {
                outlineWidth: 0,
            }
        })
    },
    modalDoneBtn: {
        backgroundColor: colors.PRIMARY,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalDoneText: {
        color: colors.WHITE,
        fontWeight: 'bold',
    },
    dateOption: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    dateOptionText: {
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
    },
    htmlDateInput: {
        width: '100%',
        padding: '12px',
        border: colors.isDark ? '1px solid #333' : '1px solid #E0EDED',
        borderRadius: '8px',
        fontSize: '16px',
        backgroundColor: colors.isDark ? '#222' : '#F1F8F8',
        color: colors.isDark ? '#FFF' : '#000',
        marginTop: 5,
    },
    inputSubLabel: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    pickerModalContent: {
        backgroundColor: colors.CARD_BG,
        width: '90%',
        borderRadius: 20,
        padding: 20,
        elevation: 10,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
        paddingBottom: 10,
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    pickerBody: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        height: 180,
    },
    pickerColumn: {
        flex: 1,
    },
    pickerItem: {
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activePickerItem: {
        backgroundColor: colors.PRIMARY + '20',
        borderWidth: 1,
        borderColor: colors.PRIMARY,
    },
    pickerItemText: {
        fontSize: 16,
        color: colors.TEXT_SECONDARY,
    },
    activePickerItemText: {
        color: colors.PRIMARY,
        fontWeight: 'bold',
    },
    pickerFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
        paddingTop: 15,
    },
});
