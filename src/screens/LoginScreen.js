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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { LIGHT_COLORS as COLORS } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const showAlert = (title, message) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleLogin = async () => {
        let loginEmail = email.trim();
        if (loginEmail && !loginEmail.includes('@')) {
            loginEmail += '@okcredit.com';
        }

        console.log("Login: Attempting login for", loginEmail);
        if (!loginEmail || !password) {
            showAlert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            console.log("Login: Calling signInWithEmailAndPassword...");
            await signInWithEmailAndPassword(auth, loginEmail, password);
            console.log("Login: Success!");
        } catch (error) {
            console.error("Login Error:", error);
            let errorMessage = 'Failed to sign in';
            if (error.code === 'auth/configuration-not-found') {
                errorMessage = 'Email/Password login is not enabled in your Firebase Console. Please enable it in Authentication -> Sign-in method.';
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid username/email or password';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid format. Please enter a username or email.';
            }
            showAlert('Login Error', errorMessage);
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
                    <Text style={styles.title}>MazKhat</Text>
                    <Text style={styles.subtitle}>Welcome back! Please login to continue.</Text>
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
                            placeholder="Enter your password"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.WHITE} />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                            <Text style={styles.signupLink}>Sign Up</Text>
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
    loginButton: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    loginButtonText: {
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
    signupLink: {
        color: colors.PRIMARY,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default LoginScreen;
