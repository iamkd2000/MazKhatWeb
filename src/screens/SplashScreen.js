
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, StatusBar, Dimensions } from 'react-native';
import { COLORS } from '../styles/colors';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ onFinish }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const taglineFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            })
        ]).start();

        // Tagline delay
        setTimeout(() => {
            Animated.timing(taglineFade, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }, 600);

        // Completion timeout
        const timer = setTimeout(() => {
            onFinish();
        }, 1800);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />

            <View style={styles.content}>
                <Animated.View style={{
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                    alignItems: 'center'
                }}>
                    <View style={styles.logoCircle}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.appName}>MaZaKhat</Text>
                </Animated.View>
            </View>

            <Animated.View style={[styles.footer, { opacity: taglineFade }]}>
                <Text style={styles.devBy}>Developed By</Text>
                <Text style={styles.kd}>KD</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    logoCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    logo: {
        width: 80,
        height: 80,
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 20,
        letterSpacing: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        alignItems: 'center',
    },
    devBy: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    kd: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 5,
    }
});

export default SplashScreen;
