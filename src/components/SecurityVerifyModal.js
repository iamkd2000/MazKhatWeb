
import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PINScreen, { isPINEnabled } from '../security/PINScreen';
import { COLORS } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

/**
 * A reusable modal for verifying the user's identity before sensitive actions.
 * Automatically checks if PIN is enabled; if not, it succeeds immediately.
 */
export default function SecurityVerifyModal({ visible, onSuccess, onCancel, title = "Verify Identity" }) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const handleCheck = async () => {
        const enabled = await isPINEnabled();
        if (!enabled) {
            onSuccess();
        }
    };

    // Auto-succeed if PIN is disabled when modal opens
    React.useEffect(() => {
        if (visible) {
            handleCheck();
        }
    }, [visible]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onCancel}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color={colors.TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <PINScreen
                        mode="verify"
                        onSuccess={onSuccess}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Confirm your PIN to proceed with this action</Text>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    closeBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        fontStyle: 'italic',
    }
});
