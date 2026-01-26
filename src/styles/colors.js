// Color Constants - Premium Multi-Theme System

export const LIGHT_COLORS = {
    // Primary Colors
    PRIMARY: '#0BAB7C',
    PRIMARY_LIGHT: '#E8F5E9',
    BACKGROUND: '#F4F7F6',
    CARD_BG: '#FFFFFF',
    WHITE: '#FFFFFF',
    BLACK: '#000000',

    // Transaction Colors
    CREDIT_GREEN: '#0BAB7C',
    DEBIT_RED: '#E53935',

    // UI Elements
    BANNER_SYNC_BG: '#FFE0B2',
    BANNER_SYNC_TEXT: '#E65100',
    TAB_ACTIVE_BG: '#FFFFFF',
    TAB_INACTIVE_TEXT: '#616161',
    NAV_ACTIVE: '#0BAB7C',
    NET_BALANCE_BG: '#FFFFFF',

    // Text Colors
    TEXT_PRIMARY: '#263238',
    TEXT_SECONDARY: '#78909C',
    TEXT_LIGHT: '#B0BEC5',

    // Extra
    BORDER: '#ECEFF1',
    SHADOW: '#00000010',
    ERROR: '#E53935',
};

export const DARK_COLORS = {
    // Primary Colors
    PRIMARY: '#0BAB7C',
    PRIMARY_LIGHT: '#1B2C26',
    BACKGROUND: '#121212',     // Pure black-grey
    CARD_BG: '#1E1E1E',        // Slightly lighter elevated grey
    WHITE: '#FFFFFF',
    BLACK: '#000000',

    // Transaction Colors
    CREDIT_GREEN: '#0BAB7C',
    DEBIT_RED: '#FF5252',      // Brighter red for dark mode

    // UI Elements
    BANNER_SYNC_BG: '#2C1D10',
    BANNER_SYNC_TEXT: '#FFB74D',
    TAB_ACTIVE_BG: '#1E1E1E',
    TAB_INACTIVE_TEXT: '#9E9E9E',
    NAV_ACTIVE: '#0BAB7C',
    NET_BALANCE_BG: '#1E1E1E',

    // Text Colors
    TEXT_PRIMARY: '#FFFFFF',
    TEXT_SECONDARY: '#B0BEC5',
    TEXT_LIGHT: '#607D8B',

    // Extra
    BORDER: '#333333',
    SHADOW: '#00000050',
    ERROR: '#FF5252',
};

// Default export for backward compatibility during transition
export const COLORS = LIGHT_COLORS;
