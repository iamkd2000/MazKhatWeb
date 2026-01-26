// Customer Profile Screen - Manage Name, Phone, and Address
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Platform,
    SafeAreaView,
    StatusBar,
    Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { saveLedger, deleteLedger } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';

export default function CustomerProfileScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const { ledger } = route.params;
    const [name, setName] = useState(ledger.name || '');
    const [phone, setPhone] = useState(ledger.phone || '');
    const [address, setAddress] = useState(ledger.address || '');
    const [loading, setLoading] = useState(false);

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleUpdate = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Name is required');
            return;
        }
        setLoading(true);
        const updatedLedger = {
            ...ledger,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            updatedAt: new Date().toISOString()
        };

        const success = await saveLedger(updatedLedger);
        setLoading(false);
        if (success) {
            showAlert('Success', 'Profile updated successfully');
            navigation.goBack();
        } else {
            showAlert('Error', 'Failed to update profile');
        }
    };

    const handleDelete = () => {
        const performDelete = async () => {
            const success = await deleteLedger(ledger.id);
            if (success) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                });
            } else {
                showAlert('Error', 'Failed to delete customer');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to delete ${ledger.name}? This cannot be undone.`)) {
                performDelete();
            }
        } else {
            Alert.alert(
                'Delete Customer',
                `Are you sure you want to delete ${ledger.name}? all transaction history will be lost.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.PRIMARY} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Customer Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={styles.customerNameDisplay}>{name || 'Customer Profile'}</Text>
                    <Text style={styles.balanceText}>
                        Current Balance: <Text style={{ color: ledger.balance >= 0 ? colors.DEBIT_RED : colors.CREDIT_GREEN }}>
                            ₹{Math.abs(ledger.balance).toLocaleString()}
                        </Text>
                    </Text>
                </View>

                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>FULL NAME</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter Name"
                            placeholderTextColor={colors.TEXT_LIGHT}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="e.g. 9876543210"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>ADDRESS</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Store or Home Address"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, loading && { opacity: 0.7 }]}
                        onPress={handleUpdate}
                        disabled={loading}
                    >
                        <Text style={styles.saveButtonText}>{loading ? 'UPDATING...' : 'UPDATE PROFILE'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color={colors.DEBIT_RED} />
                        <Text style={styles.deleteButtonText}>DELETE CUSTOMER</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        justifyContent: 'space-between',
        padding: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: colors.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    profileCard: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        elevation: 5,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 10,
        marginBottom: 20,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    avatarText: {
        color: colors.WHITE,
        fontSize: 32,
        fontWeight: 'bold',
    },
    customerNameDisplay: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        marginBottom: 5,
    },
    balanceText: {
        fontSize: 14,
        color: colors.TEXT_SECONDARY,
    },
    formSection: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 20,
        padding: 20,
        elevation: 2,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.TEXT_SECONDARY,
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        borderWidth: 1.5,
        borderColor: colors.BORDER,
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
        backgroundColor: colors.isDark ? '#222' : 'transparent',
    },
    saveButton: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 30,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: colors.WHITE,
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 30,
        padding: 10,
    },
    deleteButtonText: {
        color: colors.DEBIT_RED,
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },
});
