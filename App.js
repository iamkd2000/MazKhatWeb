// Main App Entry Point with Navigation
console.log("MazKhat App: Loaded Premium UI v1.0.1");
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, ActivityIndicator, View, Text } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import LedgerDetailScreen from './src/screens/LedgerDetailScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import TransactionDetailScreen from './src/screens/TransactionDetailScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import StatementScreen from './src/screens/StatementScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import PINScreen, { isPINEnabled } from './src/security/PINScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SplashScreen from './src/screens/SplashScreen';
import InsightsScreen from './src/screens/InsightsScreen';

// Theme Context
import { ThemeProvider } from './src/context/ThemeContext';

// Styles
import { LIGHT_COLORS as COLORS } from './src/styles/colors';

const Stack = createStackNavigator();

// Authentication Stack
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
  </Stack.Navigator>
);

// Main Application Stack
const AppStack = () => (
  <Stack.Navigator
    initialRouteName="Home"
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
      },
      headerTintColor: COLORS.WHITE,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}
  >
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="LedgerDetail"
      component={LedgerDetailScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="AddTransaction"
      component={AddTransactionScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="TransactionDetail"
      component={TransactionDetailScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="CustomerProfile"
      component={CustomerProfileScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="Statement"
      component={StatementScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="UserProfile"
      component={UserProfileScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="Insights"
      component={InsightsScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="PINSetup"
      options={{ headerShown: false }}
    >
      {(props) => (
        <PINScreen
          {...props}
          mode="setup"
          onSuccess={() => {
            if (props.route.params?.onComplete) props.route.params.onComplete();
            props.navigation.goBack();
          }}
        />
      )}
    </Stack.Screen>
  </Stack.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Splash screen timer
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1800); // Show splash for 1.8 seconds

    console.log("App: Initializing Auth Listener...");
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      console.log("App: Auth State Changed. User:", authUser ? authUser.uid : "None");
      setUser(authUser);
      if (authUser) {
        checkPINStatus();
      } else {
        setIsAuthenticated(false);
        setPinRequired(false);
        setLoading(false);
      }
    }, (error) => {
      console.error("App: Auth Listener Error:", error);
      setLoading(false);
    });

    // Safety timeout to clear loading if auth takes too long
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("App: Auth initialization timed out. Clearing loading state...");
        setLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const checkPINStatus = async () => {
    console.log("App: Checking PIN Status...");
    try {
      const enabled = await isPINEnabled();
      console.log("App: PIN Enabled:", enabled);
      setPinRequired(enabled);
      if (!enabled) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('App: Error checking PIN:', error);
      // Default to safe if error occurs
      setIsAuthenticated(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePINSuccess = () => {
    console.log("App: PIN success!");
    setIsAuthenticated(true);
  };

  console.log("App: Rendering. Loading:", loading, "User:", !!user, "IsAuthenticated:", isAuthenticated);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={{ marginTop: 10 }}>Loading MazKhat...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <AppContent
          user={user}
          pinRequired={pinRequired}
          isAuthenticated={isAuthenticated}
          handlePINSuccess={handlePINSuccess}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent({ user, pinRequired, isAuthenticated, handlePINSuccess }) {
  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : pinRequired && !isAuthenticated ? (
        <PINScreen onSuccess={handlePINSuccess} mode="verify" />
      ) : (
        <AppStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
});
