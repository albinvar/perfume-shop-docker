import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const AdminDashboardScreen = () => {
  const dashboardItems = [
    {
      title: 'Staff Management',
      icon: 'people',
      description: 'Manage staff members and their roles',
      screen: 'StaffManagement',
    },
    {
      title: 'Store Management',
      icon: 'store',
      description: 'Manage store settings and inventory',
      screen: 'StoreManagement',
    },
    {
      title: 'Product Management',
      icon: 'inventory',
      description: 'Manage products and categories',
      screen: 'ProductManagement',
    },
    {
      title: 'Purchase Management',
      icon: 'shopping-cart',
      description: 'Manage purchases and suppliers',
      screen: 'PurchaseManagement',
    },
    {
      title: 'Sales Report',
      icon: 'assessment',
      description: 'View sales reports and analytics',
      screen: 'SalesReport',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Admin</Text>
        <Text style={styles.subText}>Manage your perfume shop efficiently</Text>
      </View>

      <View style={styles.dashboardGrid}>
        {dashboardItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.cardContainer}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.iconContainer}>
                  <MaterialIcons name={item.icon} size={40} color="#6200ee" />
                </View>
                <Title style={styles.cardTitle}>{item.title}</Title>
                <Paragraph style={styles.cardDescription}>
                  {item.description}
                </Paragraph>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#6200ee',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 5,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  cardContainer: {
    width: '50%',
    padding: 5,
  },
  card: {
    margin: 5,
    elevation: 4,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
});

export default AdminDashboardScreen; 