import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    SafeAreaView,
    StatusBar,
    Image
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getUserProfile, saveUserProfile, getCategories, saveCategories, clearAllData, saveUserProfileToFirebase, getUserProfileFromFirebase, getBackupSettings, updateBackupSettings, syncAllToFirebase } from '../utils/storage';
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { LIGHT_COLORS as COLORS } from '../styles/colors';
import { isBiometricAvailable, getBiometricPreference, setBiometricPreference, getBiometricType, hasBiometricHardware, isBiometricEnrolled } from '../utils/biometric';
import { Switch } from 'react-native';
import SecurityVerifyModal from '../components/SecurityVerifyModal';
import { useTheme } from '../context/ThemeContext';

import { saveLedger } from '../utils/storage';

export default function UserProfileScreen({ navigation }) {
    const { colors, isDark, themeMode, toggleTheme } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [profile, setProfile] = useState({
        name: '',
        phone: '',
        email: '',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        upiIds: [],
        profileImage: null
    });
    const [categories, setCategories] = useState([]);
    const [newUpi, setNewUpi] = useState('');
    const [newCatName, setNewCatName] = useState('');
    const [saving, setSaving] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [changingPassword, setChangingPassword] = useState(false);
    const [pinEnabled, setPinEnabled] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);
    const [biometricEnrolled, setBiometricEnrolled] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [bioType, setBioType] = useState('Face / Fingerprint');
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [securityTitle, setSecurityTitle] = useState('Verify Identity');
    const [pendingSecurityAction, setPendingSecurityAction] = useState(null); // 'reset' or 'disable_pin'
    const [backupSettings, setBackupSettings] = useState({ autoBackup: false, lastSync: null });
    const [syncingAll, setSyncingAll] = useState(false);

    // Import Progress State



    // Password Visibility State
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    useEffect(() => {
        // Load email from Firebase Auth
        if (auth.currentUser) {
            setProfile(prev => ({ ...prev, email: auth.currentUser.email }));
        }
        loadProfile();
        checkSecuritySettings();
        loadBackupSettings();
    }, []);

    const checkSecuritySettings = async () => {
        const pinActive = await isPINEnabled();
        const hasHardware = await hasBiometricHardware();
        const enrolled = await isBiometricEnrolled();
        const bioPref = await getBiometricPreference();
        const type = await getBiometricType();

        setPinEnabled(pinActive);
        setBiometricSupported(hasHardware);
        setBiometricEnrolled(enrolled);
        setBiometricEnabled(bioPref);
        setBioType(type);
    };

    const loadBackupSettings = async () => {
        const settings = await getBackupSettings();
        setBackupSettings(settings);
    };

    const loadProfile = async () => {
        // Try to load from Firestore first, then fallback to local
        const firebaseProfile = await getUserProfileFromFirebase();
        const [localProfile, catData] = await Promise.all([
            getUserProfile(),
            getCategories()
        ]);

        // Merge Firebase profile with local, Firebase takes precedence
        const mergedProfile = firebaseProfile ? { ...localProfile, ...firebaseProfile } : localProfile;

        // Always use Firebase Auth email if available
        if (auth.currentUser) {
            mergedProfile.email = auth.currentUser.email;
        }

        setProfile(mergedProfile);
        setCategories(catData);
    };

    const handleSave = async () => {
        setSaving(true);
        // Save to both AsyncStorage and Firestore
        const [localSuccess, firebaseSuccess] = await Promise.all([
            saveUserProfile(profile),
            saveUserProfileToFirebase(profile)
        ]);
        setSaving(false);

        if (localSuccess && firebaseSuccess) {
            if (Platform.OS === 'web') {
                alert('Profile updated successfully!');
            } else {
                Alert.alert('Success', 'Profile updated and synced to cloud!');
            }
        } else if (localSuccess) {
            if (Platform.OS === 'web') {
                alert('Profile saved locally, but cloud sync failed.');
            } else {
                Alert.alert('Partial Success', 'Profile saved locally, but cloud sync failed.');
            }
        } else {
            if (Platform.OS === 'web') {
                alert('Failed to update profile.');
            } else {
                Alert.alert('Error', 'Failed to update profile.');
            }
        }
    };

    const addUpiId = () => {
        if (!newUpi.trim()) return;
        if (profile.upiIds.includes(newUpi.trim())) {
            Alert.alert('Error', 'UPI ID already exists');
            return;
        }
        const updatedUpiIds = [...profile.upiIds, newUpi.trim()];
        setProfile({ ...profile, upiIds: updatedUpiIds });
        setNewUpi('');
    };

    const removeUpiId = (upi) => {
        const updatedUpiIds = profile.upiIds.filter(id => id !== upi);
        setProfile({ ...profile, upiIds: updatedUpiIds });
    };

    const handleAddUserCategory = async () => {
        if (!newCatName.trim()) return;
        if (categories.some(c => c.id.toLowerCase() === newCatName.trim().toLowerCase())) {
            Alert.alert('Error', 'Category already exists');
            return;
        }
        const newCat = {
            id: newCatName.trim(),
            icon: 'tag-outline',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        };
        const updated = [...categories, newCat];
        setCategories(updated);
        await saveCategories(updated);
        setNewCatName('');
    };

    const handleDeleteCategory = async (catId) => {
        if (['Food', 'Travel', 'Study', 'Other'].includes(catId)) {
            Alert.alert('Restricted', 'Default categories cannot be deleted.');
            return;
        }
        const updated = categories.filter(c => c.id !== catId);
        setCategories(updated);
        await saveCategories(updated);
    };

    const handleChangePassword = async () => {
        const { currentPassword, newPassword, confirmPassword } = passwordData;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            const msg = 'Please fill all password fields';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
            return;
        }

        if (newPassword !== confirmPassword) {
            const msg = 'New passwords do not match';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
            return;
        }

        if (newPassword.length < 6) {
            const msg = 'Password must be at least 6 characters';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
            return;
        }

        setChangingPassword(true);
        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                throw new Error('No authenticated user');
            }

            // Reauthenticate with current password
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            // Clear password fields
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

            setChangingPassword(false);

            const msg = 'Password updated successfully! Please login again.';
            if (Platform.OS === 'web') {
                alert(msg);
            } else {
                Alert.alert('Success', msg);
            }

            // Log out user (best practice after password change)
            await signOut(auth);
        } catch (error) {
            setChangingPassword(false);
            console.error("Password Change Error:", error);

            let errorMsg = 'Failed to update password';
            if (error.code === 'auth/wrong-password') {
                errorMsg = 'Current password is incorrect';
            } else if (error.code === 'auth/weak-password') {
                errorMsg = 'New password is too weak';
            } else if (error.code === 'auth/too-many-requests') {
                errorMsg = 'Too many failed attempts. Please try again later.';
            } else if (error.message) {
                errorMsg = error.message; // Show exact error for debugging
            }

            Platform.OS === 'web' ? alert(errorMsg) : Alert.alert('Error', errorMsg);
        }
    };

    const handleToggleBiometric = async (value) => {
        if (value && !pinEnabled) {
            Alert.alert('PIN Required', 'Please enable 4-digit PIN lock before activating Fingerprint/FaceID.');
            return;
        }
        setBiometricEnabled(value);
        await setBiometricPreference(value);
    };

    const handleTogglePin = async (value) => {
        if (value) {
            // Navigate to setup
            navigation.navigate('PINSetup', {
                onComplete: () => {
                    setPinEnabled(true);
                    checkSecuritySettings(); // Refresh
                }
            });
        } else {
            // Require PIN to disable
            setSecurityTitle('Verify to Disable Lock');
            setPendingSecurityAction('disable_pin');
            setShowSecurityModal(true);
        }
    };

    const confirmDisablePin = async () => {
        const { disablePIN } = require('../security/PINScreen');
        const success = await disablePIN();
        if (success) {
            setPinEnabled(false);
            setBiometricEnabled(false);
            await setBiometricPreference(false);
            Alert.alert('Security', 'PIN Lock disabled.');
        }
    };

    const handleResetData = async () => {
        setSecurityTitle('Verify to Reset Data');
        setPendingSecurityAction('reset');
        setShowSecurityModal(true);
    };

    const confirmResetData = async () => {
        setShowSecurityModal(false);
        const success = await clearAllData();
        if (success) {
            Alert.alert('Success', 'All data has been reset.');
            navigation.navigate('Home');
        } else {
            Alert.alert('Error', 'Failed to reset data');
        }
    };

    const handleSecuritySuccess = () => {
        setShowSecurityModal(false);
        if (pendingSecurityAction === 'reset') {
            confirmResetData();
        } else if (pendingSecurityAction === 'disable_pin') {
            confirmDisablePin();
        }
    };

    const handleLogout = async () => {
        if (Platform.OS === 'web' && !window.confirm("Logout?")) return;
        try {
            await signOut(auth);
            // Authentication listener in App.js will handle redirect
        } catch (error) {
            Alert.alert('Error', 'Logout failed');
        }
    };

    const handleToggleBackup = async (value) => {
        setBackupSettings(prev => ({ ...prev, autoBackup: value }));
        await updateBackupSettings({ autoBackup: value });
        if (value) {
            handleSyncNow(); // Initial sync when enabled
        }
    };

    const handleSyncNow = async () => {
        if (syncingAll) return;
        setSyncingAll(true);
        const success = await syncAllToFirebase();
        setSyncingAll(false);
        if (success) {
            loadBackupSettings(); // Refresh timestamp
            if (Platform.OS === 'web') alert('Cloud Sync Complete! ✨');
            else Alert.alert('Success', 'Everything is backed up to Cloud! ✨');
        } else {
            if (Platform.OS === 'web') alert('Sync Failed. Check internet.');
            else Alert.alert('Error', 'Sync failed. Please check your internet connection.');
        }
    };

    // Profile Image Picker
    const pickProfileImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.granted === false) {
                Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                setProfile({ ...profile, profileImage: imageUri });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.PRIMARY} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.WHITE} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>User Profile</Text>
                    <View style={styles.syncStatus}>
                        <Ionicons name="cloud-done" size={12} color="#4CAF50" />
                        <Text style={styles.syncStatusText}>Cloud Synced</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveHeaderBtn}>{saving ? 'Saving...' : 'SAVE'}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                {/* Profile Picture Section */}
                <View style={styles.profilePictureSection}>
                    <TouchableOpacity onPress={pickProfileImage} style={styles.profilePictureContainer}>
                        {profile.profileImage ? (
                            <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
                        ) : (
                            <View style={styles.profileImagePlaceholder}>
                                <Ionicons name="person" size={50} color={colors.TEXT_SECONDARY} />
                            </View>
                        )}
                        <View style={styles.cameraIconContainer}>
                            <Ionicons name="camera" size={16} color={colors.WHITE} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.profilePictureHint}>Tap to change profile picture</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Business Details</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Business Name</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.name}
                            onChangeText={(text) => setProfile({ ...profile, name: text })}
                            placeholder="Enter business name"
                            placeholderTextColor={colors.TEXT_LIGHT}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile Number</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.phone}
                            onChangeText={(text) => setProfile({ ...profile, phone: text })}
                            placeholder="Enter mobile number"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            keyboardType="phone-pad"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.email}
                            onChangeText={(text) => setProfile({ ...profile, email: text })}
                            placeholder="Enter email address"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bank Details</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Bank Name</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.bankName}
                            onChangeText={(text) => setProfile({ ...profile, bankName: text })}
                            placeholder="Enter bank name"
                            placeholderTextColor={colors.TEXT_LIGHT}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Account Number</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.accountNumber}
                            onChangeText={(text) => setProfile({ ...profile, accountNumber: text })}
                            placeholder="Enter account number"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>IFSC Code</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.ifsc}
                            onChangeText={(text) => setProfile({ ...profile, ifsc: text.toUpperCase() })}
                            placeholder="Enter IFSC code"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            autoCapitalize="characters"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>UPI IDs</Text>
                    {profile.upiIds.map((upi, index) => (
                        <View key={index} style={styles.upiItem}>
                            <MaterialCommunityIcons name="bank" size={20} color={colors.PRIMARY} />
                            <Text style={styles.upiText}>{upi}</Text>
                            <TouchableOpacity onPress={() => removeUpiId(upi)}>
                                <Ionicons name="trash-outline" size={20} color={colors.DEBIT_RED} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    <View style={styles.addUpiContainer}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            value={newUpi}
                            onChangeText={setNewUpi}
                            placeholder="Enter new UPI ID (e.g. name@upi)"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity style={styles.addUpiBtn} onPress={addUpiId}>
                            <Ionicons name="add" size={24} color={colors.WHITE} />
                        </TouchableOpacity>
                    </View>
                </View>


                {/* Password Change Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Current Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.input}
                                value={passwordData.currentPassword}
                                onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                                placeholder="Enter current password"
                                placeholderTextColor={colors.TEXT_LIGHT}
                                secureTextEntry={!showCurrentPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                                <Ionicons name={showCurrentPassword ? "eye-off" : "eye"} size={20} color={colors.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.input}
                                value={passwordData.newPassword}
                                onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                                placeholder="Enter new password (min 6 chars)"
                                placeholderTextColor={colors.TEXT_LIGHT}
                                secureTextEntry={!showNewPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowNewPassword(!showNewPassword)}
                            >
                                <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={20} color={colors.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm New Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.input}
                                value={passwordData.confirmPassword}
                                onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                                placeholder="Re-enter new password"
                                placeholderTextColor={colors.TEXT_LIGHT}
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={colors.TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.changePasswordBtn, changingPassword && styles.btnDisabled]}
                        onPress={handleChangePassword}
                        disabled={changingPassword}
                    >
                        <MaterialCommunityIcons name="lock-reset" size={20} color={colors.WHITE} />
                        <Text style={styles.changePasswordBtnText}>
                            {changingPassword ? 'Changing Password...' : 'Change Password'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Appearance Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.securityRow}>
                        <View style={styles.securityInfo}>
                            <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={colors.PRIMARY} />
                            <View style={styles.securityTextGroup}>
                                <Text style={styles.securityLabel}>Dark Mode</Text>
                                <Text style={styles.securitySub}>{isDark ? 'Dark Mode Active' : 'Light Mode Active'}</Text>
                            </View>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={(val) => toggleTheme(val ? 'dark' : 'light')}
                            trackColor={{ false: '#D1D1D1', true: colors.PRIMARY }}
                            thumbColor={Platform.OS === 'ios' ? '#FFF' : isDark ? colors.PRIMARY : '#F4F3F4'}
                        />
                    </View>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security & Lock</Text>

                    {/* PIN Lock Toggle */}
                    <View style={styles.securityRow}>
                        <View style={styles.securityInfo}>
                            <Ionicons name="lock-closed-outline" size={24} color={colors.PRIMARY} />
                            <View style={styles.securityTextGroup}>
                                <Text style={styles.securityLabel}>4-Digit PIN Lock</Text>
                                <Text style={styles.securitySub}>Require PIN to open app</Text>
                            </View>
                        </View>
                        <Switch
                            value={pinEnabled}
                            onValueChange={handleTogglePin}
                            trackColor={{ false: '#D1D1D1', true: colors.PRIMARY }}
                            thumbColor={Platform.OS === 'ios' ? '#FFF' : pinEnabled ? colors.PRIMARY : '#F4F3F4'}
                        />
                    </View>

                    {/* Biometric Toggle */}
                    <View style={[styles.securityRow, { marginTop: 15, borderTopWidth: 1, borderTopColor: colors.BORDER, paddingTop: 15 }]}>
                        <View style={styles.securityInfo}>
                            <MaterialCommunityIcons
                                name={bioType === 'Face' ? "face-recognition" : "fingerprint"}
                                size={28}
                                color={biometricSupported && pinEnabled ? colors.PRIMARY : (colors.isDark ? '#444' : '#BDBDBD')}
                            />
                            <View style={styles.securityTextGroup}>
                                <Text style={[styles.securityLabel, (!biometricSupported || !pinEnabled) && { color: (colors.isDark ? '#777' : '#BDBDBD') }]}>
                                    {bioType} ID Lock
                                </Text>
                                <Text style={styles.securitySub}>
                                    {!biometricSupported ?
                                        (Platform.OS === 'web' ? 'Available on Mobile App 📱' : 'Hardware not detected') :
                                        (!biometricEnrolled ? `No ${bioType} enrolled in device settings` : `Use ${bioType} to unlock`)
                                    }
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={biometricEnabled}
                            disabled={!pinEnabled || !biometricSupported || !biometricEnrolled}
                            onValueChange={handleToggleBiometric}
                            trackColor={{ false: '#D1D1D1', true: colors.PRIMARY }}
                            thumbColor={Platform.OS === 'ios' ? '#FFF' : biometricEnabled ? colors.PRIMARY : '#F4F3F4'}
                        />
                    </View>
                </View>

                {/* Cloud Backup Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cloud Backup & Sync</Text>
                    <View style={styles.securityRow}>
                        <View style={styles.securityInfo}>
                            <Ionicons name="cloud-upload-outline" size={24} color={colors.PRIMARY} />
                            <View style={styles.securityTextGroup}>
                                <Text style={styles.securityLabel}>Auto Cloud Backup</Text>
                                <Text style={styles.securitySub}>Automatically sync data to your account</Text>
                            </View>
                        </View>
                        <Switch
                            value={backupSettings.autoBackup}
                            onValueChange={handleToggleBackup}
                            trackColor={{ false: '#D1D1D1', true: colors.PRIMARY }}
                            thumbColor={Platform.OS === 'ios' ? '#FFF' : backupSettings.autoBackup ? colors.PRIMARY : '#F4F3F4'}
                        />
                    </View>

                    <View style={[styles.securityRow, { marginTop: 15, borderTopWidth: 1, borderTopColor: colors.BORDER, paddingTop: 15 }]}>
                        <View style={styles.securityInfo}>
                            <Ionicons name="time-outline" size={24} color={colors.TEXT_SECONDARY} />
                            <View style={styles.securityTextGroup}>
                                <Text style={styles.securityLabel}>Last Synced</Text>
                                <Text style={styles.securitySub}>
                                    {backupSettings.lastSync
                                        ? new Date(backupSettings.lastSync).toLocaleString()
                                        : 'Never'
                                    }
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.syncNowBtn, syncingAll && { opacity: 0.5 }]}
                            onPress={handleSyncNow}
                            disabled={syncingAll}
                        >
                            <Ionicons
                                name={syncingAll ? "sync" : "refresh"}
                                size={18}
                                color={colors.PRIMARY}
                                style={syncingAll ? { transform: [{ rotate: '360deg' }] } : {}}
                            />
                            <Text style={styles.syncNowText}>{syncingAll ? 'Syncing...' : 'Sync Now'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.section, { borderBottomWidth: 0, marginBottom: 40 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.PRIMARY }]}>Data Tools</Text>


                    <Text style={[styles.sectionTitle, { color: colors.DEBIT_RED, marginTop: 20 }]}>Account Settings</Text>
                    <TouchableOpacity style={styles.dangerBtn} onPress={handleResetData}>
                        <Ionicons name="trash-bin-outline" size={24} color={colors.DEBIT_RED} />
                        <View style={styles.dangerBtnInfo}>
                            <Text style={styles.dangerBtnText}>Reset All Data</Text>
                            <Text style={styles.dangerBtnSub}>Wipe all customers and transactions</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.TEXT_LIGHT} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.dangerBtn, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={24} color={colors.TEXT_PRIMARY} />
                        <View style={styles.dangerBtnInfo}>
                            <Text style={styles.dangerBtnText}>Logout</Text>
                            <Text style={styles.dangerBtnSub}>Sign out of your account</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.TEXT_LIGHT} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <SecurityVerifyModal
                visible={showSecurityModal}
                title={securityTitle}
                onSuccess={handleSecuritySuccess}
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
        justifyContent: 'space-between',
        padding: 15,
        elevation: 4,
    },
    backButton: {
        padding: 5,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    syncStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.isDark ? '#1B2C26' : '#E8F5E9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 2,
    },
    syncStatusText: {
        color: colors.isDark ? '#0BAB7C' : '#2E7D32',
        fontSize: 9,
        fontWeight: 'bold',
        marginLeft: 3,
    },
    saveHeaderBtn: {
        color: colors.WHITE,
        fontWeight: 'bold',
        fontSize: 14,
        minWidth: 50,
        textAlign: 'right',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 15,
    },
    profilePictureSection: {
        alignItems: 'center',
        marginBottom: 25,
        paddingTop: 10,
    },
    profilePictureContainer: {
        position: 'relative',
        width: 100,
        height: 100,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: colors.PRIMARY,
    },
    profileImagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.BORDER,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.PRIMARY,
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.PRIMARY,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.WHITE,
    },
    profilePictureHint: {
        marginTop: 10,
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
    },
    section: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        elevation: 2,
        boxShadow: colors.isDark ? '0px 2px 4px rgba(0,0,0,0.5)' : '0px 2px 4px rgba(0,0,0,0.05)',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.PRIMARY,
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
        paddingBottom: 8,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginBottom: 4,
    },
    input: {
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
        fontSize: 16,
        paddingVertical: 8,
        color: colors.TEXT_PRIMARY,
    },
    upiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F5F5F5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    upiText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: colors.TEXT_PRIMARY,
    },
    addUpiContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    addUpiBtn: {
        backgroundColor: colors.PRIMARY,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    dangerBtnInfo: {
        flex: 1,
        marginLeft: 15,
    },
    dangerBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    passwordContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    eyeIcon: {
        position: 'absolute',
        right: 0,
        padding: 10,
    },
    dangerBtnSub: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginTop: 2,
    },
    securityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    securityInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    securityTextGroup: {
        marginLeft: 15,
    },
    securityLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    securitySub: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginTop: 2,
    },
    syncNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.isDark ? '#2C2C2C' : '#F0F7FF',
        borderWidth: 1,
        borderColor: colors.isDark ? '#444' : '#E0EFFF',
    },
    syncNowText: {
        marginLeft: 5,
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.PRIMARY,
    },
});
