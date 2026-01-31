import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRIC_KEY = 'mazkhat_biometric_enabled';

/**
 * Checks if the device hardware supports biometrics.
 */
export const hasBiometricHardware = async () => {
    try {
        return await LocalAuthentication.hasHardwareAsync();
    } catch (error) {
        console.error('Biometric hardware check error:', error);
        return false;
    }
};

/**
 * Checks if the device has enrolled biometric records.
 */
export const isBiometricEnrolled = async () => {
    try {
        return await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
        console.error('Biometric enrollment check error:', error);
        return false;
    }
};

/**
 * Checks if the device hardware supports biometrics and has enrolled records.
 * Legacy wrapper for compatibility.
 */
export const isBiometricAvailable = async () => {
    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasHardware = await hasBiometricHardware();

        // On Android, Face detection might be reported as FACIAL_RECOGNITION 
        // or just generically as BIOMETRIC.
        const isFaceSupported = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const isGenericBiometric = types.includes(LocalAuthentication.AuthenticationType.BIOMETRIC);

        // We prioritize Face, but on some Android 12 devices it might only report BIOMETRIC
        if (!hasHardware || (!isFaceSupported && !isGenericBiometric && Platform.OS !== 'android')) return false;

        const isEnrolled = await isBiometricEnrolled();
        const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

        // SecurityLevel.BIOMETRIC is 2, SecurityLevel.SECRET is 1, NONE is 0
        return isEnrolled || enrolledLevel > 0;
    } catch (error) {
        console.error('Biometric availability check error:', error);
        return false;
    }
};

/**
 * Returns the type of biometric authentication supported (restricted to 'Face' or 'None').
 */
export const getBiometricType = async () => {
    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            return 'Face';
        }
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            return 'Fingerprint';
        }
        // Fallback for Android devices that don't distinguish but have Face/Fingerprint
        if (Platform.OS === 'android' && types.length > 0) {
            return 'Biometric';
        }
        return 'None';
    } catch (error) {
        return 'None';
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
