import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from './contexts/AuthContext';
import { Provider as PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <PaperProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen 
              name="(auth)" 
              options={{ 
                headerShown: false,
                gestureEnabled: false 
              }} 
            />
            <Stack.Screen 
              name="(admin)" 
              options={{ 
                headerShown: false,
                gestureEnabled: false 
              }} 
            />
            <Stack.Screen 
              name="(staff)" 
              options={{ 
                headerShown: false,
                gestureEnabled: false 
              }} 
            />
            <Stack.Screen 
              name="index" 
              options={{ 
                headerShown: false 
              }} 
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </AuthProvider>
  );
}