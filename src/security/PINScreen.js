// PIN Lock Screen for App Security

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Vibration
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import * as LocalAuthentication from 'expo-local-authentication';
import { getBiometricPreference, authenticateBiometric, getBiometricType, hasBiometricHardware, isBiometricEnrolled } from '../utils/biometric';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

const PIN_KEY = 'app_pin';
const PIN_ENABLED_KEY = 'pin_enabled';

export default function PINScreen({ onSuccess, mode = 'verify' }) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(mode === 'setup' ? 'create' : 'verify');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [bioType, setBioType] = useState('Fingerprint');

    useEffect(() => {
        checkBiometricAvailability();
    }, []);

    const checkBiometricAvailability = async () => {
        const compatible = await hasBiometricHardware();
        const enrolled = await isBiometricEnrolled();
        const pref = await getBiometricPreference();
        const type = await getBiometricType();

        setBiometricAvailable(compatible && enrolled);
        setBioType(type);

        if (mode === 'verify' && compatible && enrolled && pref) {
            // Wait a tiny bit for UI to mount
            setTimeout(() => {
                handleBiometric();
            }, 500);
        }
    };

    const handleBiometric = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock with Biometric',
                fallbackLabel: 'Use PIN',
                disableDeviceFallback: false,
            });

            if (result.success) {
                onSuccess();
            }
        } catch (error) {
            console.error('Biometric error:', error);
        }
    };

    const handleNumberPress = (number) => {
        if (isLocked) return;

        if (pin.length < 4) {
            const newPin = pin + number;
            setPin(newPin);

            if (newPin.length === 4) {
                if (step === 'create') {
                    // First step of creating PIN
                    setStep('confirm');
                    setPin('');
                } else if (step === 'confirm') {
                    // Second step - confirm PIN matches
                    if (newPin === confirmPin) {
                        savePIN(confirmPin);
                    } else {
                        Vibration.vibrate(500);
                        Alert.alert('Error', 'PINs do not match. Try again.');
                        setPin('');
                        setConfirmPin('');
                        setStep('create');
                    }
                } else {
                    // Verify mode
                    verifyPIN(newPin);
                }
            }
        }

        if (step === 'create' && pin.length === 3) {
            // Save the first PIN entry
            setConfirmPin(pin + number);
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    const savePIN = async (pinCode) => {
        try {
            await AsyncStorage.setItem(PIN_KEY, pinCode);
            await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
            Alert.alert('Success', 'PIN created successfully!');
            onSuccess();
        } catch (error) {
            Alert.alert('Error', 'Failed to save PIN');
        }
    };

    const verifyPIN = async (enteredPin) => {
        try {
            const storedPin = await AsyncStorage.getItem(PIN_KEY);

            if (enteredPin === storedPin) {
                setFailedAttempts(0);
                onSuccess();
            } else {
                Vibration.vibrate(500);
                const newAttempts = failedAttempts + 1;
                setFailedAttempts(newAttempts);
                setPin('');

                if (newAttempts >= 3) {
                    setIsLocked(true);
                    Alert.alert('Too Many Attempts', 'Please wait 30 seconds');
                    setTimeout(() => {
                        setIsLocked(false);
                        setFailedAttempts(0);
                    }, 30000);
                } else {
                    Alert.alert('Incorrect PIN', `${3 - newAttempts} attempts remaining`);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to verify PIN');
        }
    };

    const handleForgotPIN = () => {
        if (step === 'verify') {
            Alert.alert(
                'Forgot PIN?',
                'You can Logout and Login again to reset your PIN (Cloud data will be safe). Or perform a Full Reset (Wipes all local data).',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Logout & Reset',
                        onPress: async () => {
                            try {
                                await signOut(auth);
                                // The auth listener in App.js will handle redirect to Login
                            } catch (err) {
                                Alert.alert('Error', 'Failed to logout');
                            }
                        }
                    },
                    {
                        text: 'Full Reset (Destructive)',
                        style: 'destructive',
                        onPress: async () => {
                            await AsyncStorage.clear();
                            Alert.alert('Success', 'All data wiped. Restart the app.');
                        }
                    }
                ]
            );
        }
    };

    const getTitle = () => {
        if (step === 'create') return 'Create PIN';
        if (step === 'confirm') return 'Confirm PIN';
        return 'Enter PIN';
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{getTitle()}</Text>

            <View style={styles.pinDisplay}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.pinDot,
                            pin.length > i && styles.pinDotFilled
                        ]}
                    />
                ))}
            </View>

            {isLocked && (
                <Text style={styles.lockText}>Locked for 30 seconds</Text>
            )}

            <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <TouchableOpacity
                        key={num}
                        style={styles.key}
                        onPress={() => handleNumberPress(num.toString())}
                        disabled={isLocked}
                    >
                        <Text style={styles.keyText}>{num}</Text>
                    </TouchableOpacity>
                ))}

                {biometricAvailable && step === 'verify' ? (
                    <TouchableOpacity
                        style={styles.key}
                        onPress={handleBiometric}
                    >
                        <Text style={styles.keyText}>{bioType === 'Face' ? '👤' : '🖐️'}</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.key} />
                )}

                <TouchableOpacity
                    style={styles.key}
                    onPress={() => handleNumberPress('0')}
                    disabled={isLocked}
                >
                    <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.key}
                    onPress={handleBackspace}
                >
                    <Text style={styles.keyText}>⌫</Text>
                </TouchableOpacity>
            </View>

            {step === 'verify' && (
                <TouchableOpacity onPress={handleForgotPIN}>
                    <Text style={styles.forgotText}>Forgot PIN?</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        marginBottom: 40,
    },
    pinDisplay: {
        flexDirection: 'row',
        marginBottom: 40,
    },
    pinDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.PRIMARY,
        marginHorizontal: 10,
    },
    pinDotFilled: {
        backgroundColor: colors.PRIMARY,
    },
    keypad: {
        width: '100%',
        maxWidth: 300,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
    },
    key: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        margin: 10,
        elevation: 2,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: colors.isDark ? 0.3 : 0.2,
        shadowRadius: 4,
    },
    keyText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    forgotText: {
        marginTop: 20,
        color: colors.PRIMARY,
        fontSize: 16,
    },
    lockText: {
        color: colors.DEBIT_RED,
        fontSize: 16,
        marginBottom: 20,
    },
});

// Helper functions for PIN management
export const isPINEnabled = async () => {
    try {
        const enabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
        return enabled === 'true';
    } catch (error) {
        return false;
    }
};

export const disablePIN = async () => {
    try {
        await AsyncStorage.removeItem(PIN_KEY);
        await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
        return true;
    } catch (error) {
        return false;
    }
};
