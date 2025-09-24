import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminScreen() {
  const { screen } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {screen?.toString().charAt(0).toUpperCase() + screen?.toString().slice(1)} Management
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200ee',
  },
}); 