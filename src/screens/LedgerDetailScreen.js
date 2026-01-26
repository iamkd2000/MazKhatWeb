// Ledger Detail Screen - Reliable & Premium Layout
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    TouchableOpacity,
    Platform,
    SafeAreaView,
    StatusBar,
    Linking,
    Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getAllLedgers, getUserProfile } from '../utils/storage';
import TransactionItem from '../components/TransactionItem';
import { useTheme } from '../context/ThemeContext';
export default function LedgerDetailScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { ledger: initialLedger } = route.params;
    const [ledger, setLedger] = useState(initialLedger);
    const [userProfile, setUserProfile] = useState(null);
    const [initialScrolled, setInitialScrolled] = useState(false);
    const listRef = React.useRef(null);

    const fetchInitialData = useCallback(async () => {
        const allLedgers = await getAllLedgers();
        const updatedLedger = allLedgers[ledger.id];
        if (updatedLedger) {
            setLedger(updatedLedger);
        }
        const profile = await getUserProfile();
        setUserProfile(profile);
        setInitialScrolled(false);
    }, [ledger.id]);

    // Use useFocusEffect for automatic cleanup instead of manual listener
    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
        }, [fetchInitialData])
    );

    const groupedTransactions = useMemo(() => {
        const groups = {};
        ledger.transactions.forEach(t => {
            const dateStr = t.displayDate || new Date(t.date).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });
        return Object.keys(groups).sort((a, b) => new Date(a) - new Date(b)).map(date => ({
            title: date,
            data: groups[date]
        }));
    }, [ledger.transactions]);

    useEffect(() => {
        if (!initialScrolled && listRef.current && groupedTransactions.length > 0) {
            const lastSectionIndex = groupedTransactions.length - 1;
            const lastItemIndex = groupedTransactions[lastSectionIndex].data.length - 1;

            setTimeout(() => {
                try {
                    listRef.current.scrollToLocation({
                        sectionIndex: lastSectionIndex,
                        itemIndex: lastItemIndex,
                        animated: false,
                        viewPosition: 1
                    });
                    setInitialScrolled(true);
                } catch (e) { }
            }, 500);
        }
    }, [groupedTransactions, initialScrolled]);

    const handleAction = (type) => {
        navigation.navigate('AddTransaction', { ledger, type });
    };

    const handleCall = () => {
        if (!ledger.phone) {
            showAlert('Update Profile', 'Please add a mobile number in the profile section to call.');
            return;
        }
        Linking.openURL(`tel:${ledger.phone}`);
    };

    const handleWhatsApp = () => {
        const cleanPhone = ledger.phone ? ledger.phone.replace(/[^0-9]/g, '') : '';
        const balanceText = ledger.balance >= 0
            ? `Pending Payment: ₹${Math.abs(ledger.balance).toLocaleString()} (Due)`
            : `Advance Balance: ₹${Math.abs(ledger.balance).toLocaleString()} (Advance)`;

        let paymentDetails = '';
        if (userProfile && (userProfile.bankName || userProfile.accountNumber || userProfile.ifsc || (userProfile.upiIds && userProfile.upiIds.length > 0))) {
            paymentDetails = `\n\n*Payment Details*:`;
            if (userProfile.bankName) paymentDetails += `\nBank: ${userProfile.bankName}`;
            if (userProfile.accountNumber) paymentDetails += `\nAcc: ${userProfile.accountNumber}`;
            if (userProfile.ifsc) paymentDetails += `\nIFSC: ${userProfile.ifsc}`;

            if (userProfile.upiIds && userProfile.upiIds.length > 0) {
                paymentDetails += `\n\n*UPI IDs*:`;
                userProfile.upiIds.forEach(id => {
                    paymentDetails += `\n- ${id}`;
                });
            }
        }

        const senderSuffix = userProfile?.name ? `\n\n- ${userProfile.name}` : '\n\n- MaZaKhat Business';
        const message = `Hello ${ledger.name},\n\nThis is a friendly reminder of your current balance on MaZaKht:\n*${balanceText}*${paymentDetails}\n\nPlease let me know if you have any questions.${senderSuffix}\nThank you!`;

        const url = cleanPhone
            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;

        if (Platform.OS === 'web') {
            window.open(url, '_blank');
        } else {
            Linking.openURL(url);
        }
    };

    const handleSMS = () => {
        const balanceText = ledger.balance >= 0
            ? `₹${Math.abs(ledger.balance).toLocaleString()} (Due)`
            : `₹${Math.abs(ledger.balance).toLocaleString()} (Advance)`;

        const message = `Hello ${ledger.name}, reminder from MaZaKhat. Balance: ${balanceText}. Thanks!`;
        const url = `sms:${ledger.phone || ''}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;

        Linking.openURL(url);
    };

    const handleProfile = () => {
        navigation.navigate('CustomerProfile', { ledger });
    };

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.PRIMARY} />

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

            {/* 1. Header (Fixed) */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerInfo} onPress={handleProfile}>
                    <Text style={styles.headerName}>{ledger.name}</Text>
                    <Text style={styles.headerSub}>View Profile</Text>
                </TouchableOpacity>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleCall}><Ionicons name="call-outline" size={22} color={colors.WHITE} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleWhatsApp}><MaterialCommunityIcons name="whatsapp" size={22} color={colors.WHITE} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleProfile}><Ionicons name="settings-outline" size={22} color={colors.WHITE} /></TouchableOpacity>
                </View>
            </View>

            {/* 2. Scrollable List (Flexible) */}
            <View style={styles.listContainer}>
                <SectionList
                    ref={listRef}
                    style={[styles.list, { flex: 1 }]}
                    sections={groupedTransactions}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={false}
                    alwaysBounceVertical={true}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    renderItem={({ item }) => (
                        <TransactionItem
                            transaction={item}
                            onPress={() => navigation.navigate('TransactionDetail', { transaction: item, ledger })}
                        />
                    )}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.dateHeader}>
                            <View style={styles.dateBadge}>
                                <Text style={styles.dateText}>{title}</Text>
                            </View>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                />
            </View>

            {/* 3. Bottom Dashboard (Fixed at Bottom) */}
            <View style={styles.bottomDashboard}>
                <View style={styles.toolBar}>
                    <TouchableOpacity style={styles.toolItem} onPress={() => navigation.navigate('Statement', { ledger })}>
                        <MaterialCommunityIcons name="file-pdf-box" size={22} color={colors.TEXT_SECONDARY} />
                        <Text style={styles.toolText}>Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolItem} onPress={handleWhatsApp}>
                        <Ionicons name="notifications-outline" size={22} color={colors.TEXT_SECONDARY} />
                        <Text style={styles.toolText}>Remind</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolItem} onPress={handleSMS}>
                        <MaterialCommunityIcons name="message-text-outline" size={22} color={colors.TEXT_SECONDARY} />
                        <Text style={styles.toolText}>SMS</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.balanceBar}>
                    <Text style={styles.balanceLabel}>Current Balance</Text>
                    <Text style={[styles.balanceText, { color: ledger.balance >= 0 ? colors.DEBIT_RED : colors.CREDIT_GREEN }]}>
                        ₹{Math.abs(ledger.balance).toLocaleString()} {ledger.balance >= 0 ? 'Due' : 'Advance'}
                    </Text>
                </View>

                <View style={styles.mainActions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.receivedBtn]}
                        onPress={() => handleAction('payment')}
                    >
                        <Text style={[styles.actionBtnText, { color: colors.CREDIT_GREEN }]}>Received ₹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.givenBtn]}
                        onPress={() => handleAction('credit')}
                    >
                        <Text style={[styles.actionBtnText, { color: colors.DEBIT_RED }]}>Given ₹</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
    },
    backButton: {
        marginRight: 10,
    },
    headerInfo: {
        flex: 1,
    },
    headerName: {
        color: colors.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#B2DFDB',
        fontSize: 12,
    },
    headerIcons: {
        flexDirection: 'row',
    },
    iconBtn: {
        marginLeft: 15,
    },
    listContainer: {
        flex: 1, // This is key: it pushes the bottom dashboard down
    },
    listContent: {
        paddingBottom: 180,
        paddingHorizontal: 10,
    },
    dateHeader: {
        alignItems: 'center',
        marginVertical: 20,
    },
    dateBadge: {
        backgroundColor: '#CFD8DC',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    dateText: {
        fontSize: 12,
        color: colors.TEXT_PRIMARY,
        fontWeight: '600',
    },
    bottomDashboard: {
        position: Platform.OS === 'web' ? 'fixed' : 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.CARD_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 10,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 5,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        borderTopWidth: 1,
        borderTopColor: colors.BORDER,
        zIndex: 100,
    },
    toolBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    toolItem: {
        alignItems: 'center',
    },
    toolText: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        marginTop: 4,
    },
    balanceBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    balanceLabel: {
        fontSize: 14,
        color: colors.TEXT_SECONDARY,
    },
    balanceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    mainActions: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        justifyContent: 'space-between',
    },
    actionBtn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        marginHorizontal: 5,
    },
    receivedBtn: {
        borderColor: colors.CREDIT_GREEN,
        backgroundColor: colors.isDark ? '#1B2C26' : '#E8F5E9',
    },
    givenBtn: {
        borderColor: colors.DEBIT_RED,
        backgroundColor: colors.isDark ? '#2C1B1B' : '#FFEBEE',
    },
    actionBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
});
