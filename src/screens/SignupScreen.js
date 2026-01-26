import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { LIGHT_COLORS as COLORS } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

const SignupScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleSignup = async () => {
        let signupEmail = email.trim();
        if (signupEmail && !signupEmail.includes('@')) {
            signupEmail += '@okcredit.com';
        }

        console.log("Signup: Attempting signup for", signupEmail);
        if (!signupEmail || !password || !confirmPassword) {
            showAlert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            showAlert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            showAlert('Error', 'Password should be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            console.log("Signup: Calling createUserWithEmailAndPassword...");
            const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, password);
            const user = userCredential.user;
            console.log("Signup: Auth success, UID:", user.uid);

            console.log("Signup: Storing user info in Firestore...");
            // Store user info in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: signupEmail,
                username: email, // Original input as username
                createdAt: new Date().toISOString(),
            });
            console.log("Signup: Firestore success!");
        } catch (error) {
            console.error("Signup Error:", error);
            let errorMessage = 'Failed to create account';
            if (error.code === 'auth/configuration-not-found') {
                errorMessage = 'Email/Password login is not enabled in your Firebase Console. Please enable it in Authentication -> Sign-in method.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This username or email is already registered';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid format. Please enter a username or email.';
            }
            showAlert('Signup Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join MazKhat to manage your ledgers.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Create a password"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm your password"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.signupButton}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.WHITE} />
                        ) : (
                            <Text style={styles.signupButtonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginLink}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.PRIMARY,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.TEXT_SECONDARY,
        textAlign: 'center',
    },
    form: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 16,
        padding: 24,
        elevation: 4,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 8,
        borderWidth: colors.isDark ? 1 : 0,
        borderColor: colors.BORDER,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.TEXT_PRIMARY,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.BORDER,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
    },
    signupButton: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    signupButtonText: {
        color: colors.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        color: colors.TEXT_SECONDARY,
        fontSize: 14,
    },
    loginLink: {
        color: colors.PRIMARY,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default SignupScreen;
