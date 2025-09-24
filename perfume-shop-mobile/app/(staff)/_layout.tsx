import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function StaffLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Staff Dashboard',
          }}
        />
        <Stack.Screen
          name="staff_profile"
          options={{
            title: 'My Profile',
          }}
        />
        
      </Stack>
    </View>
  );
}