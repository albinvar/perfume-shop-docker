import { Stack } from 'expo-router';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  return (
    <PaperProvider>
      <View style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen
            name="index"
            options={{
              title: 'Admin Dashboard',
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              title: 'My Profile',
            }}
          />
          
        </Stack>
      </View>
    </PaperProvider>
  );
}