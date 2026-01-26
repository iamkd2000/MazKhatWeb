import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRIC_KEY = 'mazkhat_biometric_enabled';

/**
 * Checks if the device hardware supports biometrics and has enrolled records.
 */
export const isBiometricAvailable = async () => {
    try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    } catch (error) {
        console.error('Biometric: Availability check failed', error);
        return false;
    }
};

/**
 * Returns the type of biometric authentication supported ('Face', 'Fingerprint', or 'Biometric').
 */
export const getBiometricType = async () => {
    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            return 'Face';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            return 'Fingerprint';
        }
        return 'Biometric';
    } catch (error) {
        return 'Biometric';
    }
};

/**
 * Triggers the native biometric authentication prompt.
 */
export const authenticateBiometric = async () => {
    try {
        const type = await getBiometricType();
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: `Unlock MaZaKhat with ${type}`,
            fallbackLabel: 'Use PIN Instead',
            cancelLabel: 'Cancel',
            disableDeviceFallback: true,
        });
        return result.success;
    } catch (error) {
        console.error('Biometric: Authentication failed', error);
        return false;
    }
};

/**
 * Persists the user's biometric preference.
 */
export const setBiometricPreference = async (enabled) => {
    try {
        await AsyncStorage.setItem(BIOMETRIC_KEY, JSON.stringify(enabled));
    } catch (error) {
        console.error('Biometric: Failed to save preference', error);
    }
};

/**
 * Retrieves the user's biometric preference.
 */
export const getBiometricPreference = async () => {
    try {
        const value = await AsyncStorage.getItem(BIOMETRIC_KEY);
        return value ? JSON.parse(value) : false;
    } catch (error) {
        console.error('Biometric: Failed to load preference', error);
        return false;
    }
};
