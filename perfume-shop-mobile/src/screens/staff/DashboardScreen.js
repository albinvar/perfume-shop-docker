import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const StaffDashboardScreen = () => {
  const dashboardItems = [
    {
      title: 'Product Details',
      icon: 'inventory',
      description: 'View and manage products',
      screen: 'ProductDetails',
    },
    {
      title: 'Purchase Entry',
      icon: 'shopping-cart',
      description: 'Record new purchases',
      screen: 'PurchaseEntry',
    },
    {
      title: 'Sales Entry',
      icon: 'point-of-sale',
      description: 'Record new sales',
      screen: 'SalesEntry',
    },
    {
      title: 'Customer Entry',
      icon: 'people',
      description: 'Manage customers',
      screen: 'CustomerEntry',
    },
    {
      title: 'Reports',
      icon: 'assessment',
      description: 'View reports',
      screen: 'Reports',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Image
            source={require('../../assets/default-profile.png')}
            style={styles.profileImage}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Welcome, Staff Name</Text>
            <Text style={styles.roleText}>Staff Member</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickStats}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>Today's Sales</Title>
            <Paragraph style={styles.statValue}>₹0.00</Paragraph>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content>
            <Title style={styles.statTitle}>Total Products</Title>
            <Paragraph style={styles.statValue}>0</Paragraph>
          </Card.Content>
        </Card>
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
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  roleText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 5,
  },
  quickStats: {
    flexDirection: 'row',
    padding: 10,
  },
  statCard: {
    flex: 1,
    margin: 5,
    elevation: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200ee',
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

export default StaffDashboardScreen; 