
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../styles/colors';

const THEME_KEY = 'mazkhat_theme_preference';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
    const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

    useEffect(() => {
        loadThemePreference();
    }, []);

    useEffect(() => {
        if (themeMode === 'system') {
            setIsDark(systemColorScheme === 'dark');
        } else {
            setIsDark(themeMode === 'dark');
        }
    }, [themeMode, systemColorScheme]);

    const loadThemePreference = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_KEY);
            if (savedTheme) {
                setThemeMode(savedTheme);
            }
        } catch (error) {
            console.error('Failed to load theme preference', error);
        }
    };

    const toggleTheme = useCallback(async (mode) => {
        try {
            setThemeMode(mode);
            await AsyncStorage.setItem(THEME_KEY, mode);
        } catch (error) {
            console.error('Failed to save theme preference', error);
        }
    }, []);

    const colors = useMemo(() =>
        isDark ? { ...DARK_COLORS, isDark } : { ...LIGHT_COLORS, isDark },
        [isDark]
    );

    // Memoize context value to prevent unnecessary re-renders of all consuming components
    const value = useMemo(() => ({
        colors,
        isDark,
        themeMode,
        toggleTheme
    }), [colors, isDark, themeMode, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
