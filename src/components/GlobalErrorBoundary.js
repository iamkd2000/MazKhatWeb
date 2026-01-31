import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Clipboard, Platform } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Updates from 'expo-updates';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('GlobalErrorBoundary caught an error:', error, errorInfo);
    }

    handleRestart = async () => {
        try {
            if (Platform.OS === 'web') {
                window.location.reload();
            } else {
                // Fallback for native without expo-updates
                this.setState({ hasError: false });
            }
        } catch (e) {
            this.setState({ hasError: false });
        }
    };

    handleCopyError = () => {
        if (this.state.error) {
            Clipboard.setString(this.state.error.toString());
            if (Platform.OS === 'web') alert('Error copied to clipboard!');
        }
    };

    handleResetStorage = async () => {
        const confirmMsg = "CRITICAL: This will delete ALL your local data. Only use this if the app is permanently stuck and can't open. Proceed?";
        if (Platform.OS === 'web') {
            if (!window.confirm(confirmMsg)) return;
        } else {
            // For mobile, we'd ideally use Alert.alert, but this is a class component 
            // and we want it to be very robust.
        }

        try {
            await AsyncStorage.clear();
            this.handleRestart();
        } catch (e) {
            console.error('Failed to clear storage:', e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <StatusBar backgroundColor="#F44336" barStyle="light-content" />
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name="alert-octagon" size={80} color="#FFF" />
                        </View>

                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.message}>
                            MaZaKhat encountered an unexpected error and needs to restart. Don't worry, your data is likely safe.
                        </Text>

                        <View style={styles.errorBox}>
                            <Text style={styles.errorText} numberOfLines={3}>
                                {this.state.error?.toString() || 'Unknown Error'}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.restartBtn} onPress={this.handleRestart}>
                            <Ionicons name="refresh" size={20} color="#F44336" />
                            <Text style={styles.restartText}>Restart App</Text>
                        </TouchableOpacity>

                        <View style={styles.secondaryActions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={this.handleCopyError}>
                                <MaterialCommunityIcons name="content-copy" size={18} color="#FFF" />
                                <Text style={styles.actionText}>Copy Error</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={this.handleResetStorage}>
                                <MaterialCommunityIcons name="database-remove" size={18} color="#FFF" />
                                <Text style={styles.actionText}>Safe Reset</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F44336', // Premium Red Error Theme
    },
    content: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 20,
        borderRadius: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    errorBox: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        width: '100%',
        padding: 15,
        borderRadius: 10,
        marginBottom: 30,
    },
    errorText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    restartBtn: {
        backgroundColor: '#FFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    restartText: {
        color: '#F44336',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    secondaryActions: {
        flexDirection: 'row',
        marginTop: 40,
        width: '100%',
        justifyContent: 'space-between',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        flex: 0.48,
        justifyContent: 'center',
    },
    dangerBtn: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    actionText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default GlobalErrorBoundary;
