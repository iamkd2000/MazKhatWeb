import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { saveCategories } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';

export default function CategoryManager({ visible, onClose, categories, onUpdate }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [newCatName, setNewCatName] = useState('');
    const [editingCatId, setEditingCatId] = useState(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async () => {
        if (!newCatName.trim()) return;

        // Check duplicate
        if (categories.some(c => c.id.toLowerCase() === newCatName.trim().toLowerCase())) {
            const msg = 'Category already exists';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
            return;
        }

        const newCat = {
            id: newCatName.trim(),
            icon: 'tag', // Default icon
            color: '#607D8B' // Default color
        };

        const updated = [...categories, newCat];
        const success = await saveCategories(updated);
        if (success) {
            onUpdate(updated);
            setNewCatName('');
        }
    };

    const handleDelete = async (catId) => {
        const confirmMsg = `Delete category '${catId}'?`;

        const performDelete = async () => {
            const updated = categories.filter(c => c.id !== catId);
            const success = await saveCategories(updated);
            if (success) {
                onUpdate(updated);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) performDelete();
        } else {
            Alert.alert('Confirm Delete', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: performDelete }
            ]);
        }
    };

    const handleEditStart = (cat) => {
        if (['Food', 'Travel', 'Study', 'Rent', 'Entertainment', 'Health', 'Salary', 'Other'].includes(cat.id)) return;
        setEditingCatId(cat.id);
        setEditName(cat.id);
    };

    const handleEditSave = async () => {
        if (!editName.trim() || editName.trim() === editingCatId) {
            setEditingCatId(null);
            return;
        }

        // Check duplicate
        if (categories.some(c => c.id.toLowerCase() === editName.trim().toLowerCase() && c.id !== editingCatId)) {
            const msg = 'Category name already exists';
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
            return;
        }

        const updated = categories.map(c => {
            if (c.id === editingCatId) {
                return { ...c, id: editName.trim() };
            }
            return c;
        });

        const success = await saveCategories(updated);
        if (success) {
            onUpdate(updated);
            setEditingCatId(null);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Manage Categories</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.list}>
                        {categories.map((item) => (
                            <View key={item.id} style={styles.item}>
                                <View style={[styles.icon, { backgroundColor: item.color + '20' }]}>
                                    <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
                                </View>

                                {editingCatId === item.id ? (
                                    <View style={styles.editContainer}>
                                        <TextInput
                                            style={styles.editInput}
                                            value={editName}
                                            onChangeText={setEditName}
                                            autoFocus
                                        />
                                        <TouchableOpacity onPress={handleEditSave} style={styles.actionBtn}>
                                            <Ionicons name="checkmark" size={20} color={colors.PRIMARY} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setEditingCatId(null)} style={styles.actionBtn}>
                                            <Ionicons name="close" size={20} color={colors.DEBIT_RED} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => handleEditStart(item)}
                                            disabled={['Food', 'Travel', 'Study', 'Rent', 'Entertainment', 'Health', 'Salary', 'Other'].includes(item.id)}
                                            style={{ flex: 1 }}
                                        >
                                            <Text style={styles.name}>{item.id}</Text>
                                        </TouchableOpacity>

                                        {['Food', 'Travel', 'Study', 'Rent', 'Entertainment', 'Health', 'Salary', 'Other'].includes(item.id) ? (
                                            <Text style={styles.defaultTag}>Default</Text>
                                        ) : (
                                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                                                <Ionicons name="trash-outline" size={20} color={colors.DEBIT_RED} />
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="New Category Name"
                            placeholderTextColor={colors.TEXT_LIGHT}
                            value={newCatName}
                            onChangeText={setNewCatName}
                        />
                        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                            <Ionicons name="add" size={24} color={colors.WHITE} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (colors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.CARD_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    list: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    icon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    name: {
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
        fontWeight: '500',
    },
    defaultTag: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        fontStyle: 'italic',
        marginRight: 10,
    },
    deleteBtn: {
        padding: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        marginTop: 20,
        marginBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.BORDER,
        borderRadius: 10,
        paddingHorizontal: 15,
        height: 50,
        backgroundColor: colors.isDark ? '#222' : '#F9F9F9',
        fontSize: 16,
        color: colors.TEXT_PRIMARY,
    },
    addBtn: {
        width: 50,
        height: 50,
        backgroundColor: colors.PRIMARY,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    editContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    editInput: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.PRIMARY,
        fontSize: 16,
        paddingVertical: 4,
        marginRight: 10,
        color: colors.TEXT_PRIMARY,
    },
    actionBtn: {
        padding: 5,
        marginLeft: 5,
    }
});
