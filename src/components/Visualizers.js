
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

/**
 * A highly customizable Bar Chart built with raw views for maximum performance.
 * @param {Array} data - Array of { label, value1, value2 }
 */
export const SimpleBarChart = ({ data, labels, color1, color2 }) => {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    if (!data || data.length === 0) return null;

    const maxVal = Math.max(...data.flatMap(d => [d.v1, d.v2, 100]));
    const chartHeight = 180;

    return (
        <View style={styles.barChartContainer}>
            <View style={styles.chartBody}>
                {data.map((item, index) => (
                    <View key={index} style={styles.barGroup}>
                        <View style={styles.barsContainer}>
                            <View style={[styles.bar, {
                                height: (item.v1 / maxVal) * chartHeight,
                                backgroundColor: color1,
                                borderTopLeftRadius: 4,
                                borderTopRightRadius: 4
                            }]} />
                            <View style={[styles.bar, {
                                height: (item.v2 / maxVal) * chartHeight,
                                backgroundColor: color2,
                                borderTopLeftRadius: 4,
                                borderTopRightRadius: 4
                            }]} />
                        </View>
                        <Text style={styles.barLabel}>{item.label}</Text>
                    </View>
                ))}
            </View>
            <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color1 }]} /><Text style={styles.legendText}>{labels[0]}</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color2 }]} /><Text style={styles.legendText}>{labels[1]}</Text></View>
            </View>
        </View>
    );
};

/**
 * A modern Donut chart for category distribution.
 */
export const CategoryRing = ({ data }) => {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    if (!data || data.length === 0) return null;

    const total = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <View style={styles.ringContainer}>
            <View style={styles.ringList}>
                {data.map((item, index) => (
                    <View key={index} style={styles.ringRow}>
                        <View style={[styles.indicator, { backgroundColor: item.color }]} />
                        <Text style={styles.ringLabel}>{item.label}</Text>
                        <View style={styles.ringTrack}>
                            <View style={[styles.ringFill, { width: `${(item.value / total) * 100}%`, backgroundColor: item.color }]} />
                        </View>
                        <Text style={styles.ringValue}>₹{item.value.toLocaleString()}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

/**
 * A sleek Line Chart for tracking trends over time.
 */
export const SimpleLineChart = ({ data, color }) => {
    const { colors } = useTheme();
    const styles = React.useMemo(() => getStyles(colors), [colors]);

    if (!data || data.length === 0) return null;

    const maxVal = Math.max(...data.map(d => d.value), 100);
    const chartHeight = 150;
    const spacing = (width - 80) / (data.length - 1 || 1);

    return (
        <View style={styles.lineChartContainer}>
            <View style={[styles.lineChartBody, { height: chartHeight }]}>
                {/* SVG-like Line Path using Absolute Positioning */}
                <View style={styles.lineContainer}>
                    {data.map((item, index) => {
                        if (index === data.length - 1) return null;
                        const nextItem = data[index + 1];
                        const x1 = index * spacing;
                        const y1 = chartHeight - (item.value / maxVal) * chartHeight;
                        const x2 = (index + 1) * spacing;
                        const y2 = chartHeight - (nextItem.value / maxVal) * chartHeight;

                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const length = Math.sqrt(dx * dx + dy * dy);
                        const angle = Math.atan2(dy, dx);

                        return (
                            <View
                                key={index}
                                style={[styles.lineSegment, {
                                    width: length,
                                    left: x1,
                                    top: y1,
                                    transform: [{ rotate: `${angle}rad` }],
                                    backgroundColor: color
                                }]}
                            />
                        );
                    })}
                    {/* Points */}
                    {data.map((item, index) => (
                        <View
                            key={`p-${index}`}
                            style={[styles.point, {
                                left: index * spacing - 4,
                                top: chartHeight - (item.value / maxVal) * chartHeight - 4,
                                borderColor: color,
                                backgroundColor: colors.CARD_BG
                            }]}
                        />
                    ))}
                </View>
            </View>
            <View style={styles.lineLabels}>
                {data.map((item, index) => (
                    <Text key={index} style={styles.barLabel}>{item.label}</Text>
                ))}
            </View>
        </View>
    );
};

const getStyles = (colors) => StyleSheet.create({
    barChartContainer: {
        paddingVertical: 10,
        width: '100%',
    },
    chartBody: {
        flexDirection: 'row',
        alignItems: 'bottom',
        justifyContent: 'space-around',
        height: 180,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    barGroup: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    barsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    bar: {
        width: 12,
        marginHorizontal: 2,
    },
    barLabel: {
        fontSize: 10,
        color: colors.TEXT_SECONDARY,
        marginTop: 8,
        fontWeight: '500',
    },
    lineChartContainer: {
        marginTop: 10,
        width: '100%',
    },
    lineChartBody: {
        width: '100%',
        position: 'relative',
        borderBottomWidth: 1,
        borderBottomColor: colors.BORDER,
    },
    lineContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    lineSegment: {
        position: 'absolute',
        height: 2.5,
        borderRadius: 1,
        transformOrigin: 'left center',
    },
    point: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 2,
        zIndex: 10,
    },
    lineLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 15,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    legendText: {
        fontSize: 12,
        color: colors.TEXT_PRIMARY,
    },
    ringContainer: {
        width: '100%',
    },
    ringList: {
        marginTop: 10,
    },
    ringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    ringLabel: {
        width: 80,
        fontSize: 13,
        color: colors.TEXT_PRIMARY,
    },
    ringTrack: {
        flex: 1,
        height: 6,
        backgroundColor: colors.isDark ? '#333' : '#F5F5F5',
        borderRadius: 3,
        marginHorizontal: 10,
        overflow: 'hidden',
    },
    ringFill: {
        height: '100%',
        borderRadius: 3,
    },
    ringValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.TEXT_PRIMARY,
        width: 70,
        textAlign: 'right',
    },
});
