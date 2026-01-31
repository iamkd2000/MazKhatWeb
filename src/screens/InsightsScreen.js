
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllLedgers, getExpenses } from '../utils/storage';
import { SimpleBarChart, CategoryRing, SimpleLineChart } from '../components/Visualizers';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function InsightsScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    const [monthlyData, setMonthlyData] = useState([]);
    const [expenseTrend, setExpenseTrend] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);
    const [customerBalances, setCustomerBalances] = useState([]);
    const [stats, setStats] = useState({ totalGiven: 0, totalGot: 0, topCustomer: 'None', avgSpend: 0 });
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            processData();
        }, [])
    );

    const processData = async () => {
        setLoading(true);
        const ledgers = Object.values(await getAllLedgers());
        const expenses = await getExpenses();

        // 1. Monthly Trends (Last 6 Months)
        const trends = {};
        const spendTrends = {};
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            months.push(key);
            trends[key] = { label: key, v1: 0, v2: 0 }; // v1: Given, v2: Received
            spendTrends[key] = { label: key, value: 0 };
        }

        let totalGiven = 0;
        let totalGot = 0;
        let totalSpend = 0;
        let topCust = { name: 'None', val: 0 };

        ledgers.forEach(l => {
            if (l.balance > topCust.val) topCust = { name: l.name, val: l.balance };

            l.transactions.forEach(t => {
                const date = new Date(t.date);
                const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (trends[key]) {
                    if (t.type === 'credit') {
                        trends[key].v1 += t.amount;
                        totalGiven += t.amount;
                    } else {
                        trends[key].v2 += t.amount;
                        totalGot += t.amount;
                    }
                }
            });
        });

        // 2. Expense Category Breakdown & Trends
        const cats = {};
        expenses.forEach(e => {
            const date = new Date(e.date);
            const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            if (spendTrends[key]) {
                spendTrends[key].value += e.amount;
            }
            totalSpend += e.amount;
            cats[e.category] = (cats[e.category] || 0) + e.amount;
        });

        const catColors = [colors.PRIMARY, '#FF7043', '#FFCA28', '#66BB6A', '#26A69A', '#78909C'];
        const aggregatedCats = Object.entries(cats).map(([label, value], idx) => ({
            label,
            value,
            color: catColors[idx % catColors.length]
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        // 3. Customer-wise Balance (Top 5)
        const custData = ledgers
            .filter(l => l.balance !== 0)
            .map(l => ({
                label: l.name.length > 8 ? l.name.substring(0, 8) + '..' : l.name,
                v1: l.balance > 0 ? l.balance : 0, // Give (Debit)
                v2: l.balance < 0 ? Math.abs(l.balance) : 0 // Got (Credit)
            }))
            .sort((a, b) => (b.v1 + b.v2) - (a.v1 + a.v2))
            .slice(0, 5);

        setMonthlyData(months.map(m => trends[m]));
        setExpenseTrend(months.map(m => spendTrends[m]));
        setExpenseCategories(aggregatedCats);
        setCustomerBalances(custData);
        setStats({
            totalGiven,
            totalGot,
            topCustomer: topCust.name,
            avgSpend: totalSpend / (months.length || 1)
        });
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.CARD_BG} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Business Insights</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Monthly Performance Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Cash Flow Trend</Text>
                        <Text style={styles.cardSub}>Udhaar vs Collection (Monthly)</Text>
                    </View>
                    <SimpleBarChart
                        data={monthlyData}
                        labels={['Given', 'Received']}
                        color1={colors.DEBIT_RED}
                        color2={colors.CREDIT_GREEN}
                    />
                </View>

                {/* Customer-wise Balance Graph */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Customer Balances</Text>
                        <Text style={styles.cardSub}>Top 5 Customers by Dues</Text>
                    </View>
                    <SimpleBarChart
                        data={customerBalances}
                        labels={['You Give', 'You Got']}
                        color1={colors.DEBIT_RED}
                        color2={colors.CREDIT_GREEN}
                    />
                    {customerBalances.length === 0 && <Text style={styles.emptyText}>No customer balances to display.</Text>}
                </View>

                {/* Spending Trend Graph Section */}
                <View style={styles.card}>
                    <View style={[styles.cardHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                        <View>
                            <Text style={styles.cardTitle}>Spending Trend</Text>
                            <Text style={styles.cardSub}>Monthly Direct Expenses 📈</Text>
                        </View>
                        <View style={styles.avgBadge}>
                            <Text style={styles.avgLabel}>AVG</Text>
                            <Text style={styles.avgValue}>₹{Math.round(stats.avgSpend).toLocaleString()}</Text>
                        </View>
                    </View>
                    <SimpleLineChart
                        data={expenseTrend}
                        color={colors.PRIMARY}
                    />
                </View>

                {/* Expenses Breakdown */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Expense Breakdown</Text>
                        <Text style={styles.cardSub}>Where your money is spent</Text>
                    </View>
                    <CategoryRing data={expenseCategories} />
                    {expenseCategories.length === 0 && <Text style={styles.emptyText}>No expenses recorded yet.</Text>}
                </View>

                {/* Quick Highlights */}
                <View style={styles.highlightCard}>
                    <View style={styles.highlightItem}>
                        <View style={styles.highlightIcon}><Ionicons name="star" size={20} color="#FFD54F" /></View>
                        <View>
                            <Text style={styles.highlightLabel}>Highest Due Customer</Text>
                            <Text style={styles.highlightValue}>{stats.topCustomer}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView >
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.BACKGROUND,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: colors.CARD_BG,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: colors.CARD_BG,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 5,
        shadowColor: colors.BLACK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: colors.isDark ? 0.3 : 0.1,
        shadowRadius: 10,
    },
    cardHeader: {
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
    },
    cardSub: {
        fontSize: 12,
        color: colors.TEXT_SECONDARY,
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statBox: {
        flex: 0.48,
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 11,
        color: colors.TEXT_SECONDARY,
        marginTop: 5,
        textTransform: 'uppercase',
    },
    highlightCard: {
        backgroundColor: colors.PRIMARY,
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    highlightItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    highlightIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    highlightLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    highlightValue: {
        color: colors.WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.TEXT_SECONDARY,
        fontStyle: 'italic',
        marginTop: 20,
    },
    avgBadge: {
        backgroundColor: colors.isDark ? '#1B2C26' : '#E3F2FD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center',
    },
    avgLabel: {
        fontSize: 8,
        color: colors.PRIMARY,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    avgValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.PRIMARY,
        marginTop: 2,
    },
    backBtn: {
        padding: 5,
    }
});
