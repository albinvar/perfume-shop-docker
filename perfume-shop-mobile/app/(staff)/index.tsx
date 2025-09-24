import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface StoreDetails {
  id: number;
  name: string;
  place: string;
  phone?: string;
  email?: string;
}

interface DashboardItem {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  description: string;
  screen: string;
  color: string;
}

export default function StaffDashboard() {
  const router = useRouter();
  const { user, signOut, refreshUser, fetchWithAuth } = useAuth();
  const [storeDetails, setStoreDetails] = useState<StoreDetails | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardItems: DashboardItem[] = [
    {
      title: 'Products',
      icon: 'inventory',
      description: 'Manage products and inventory',
      screen: 'products',
      color: '#6C5CE7'
    },
    {
      title: 'Purchases',
      icon: 'shopping-cart',
      description: 'Record new purchases',
      screen: 'purchases',
      color: '#00B894'
    },
    {
      title: 'Sales',
      icon: 'point-of-sale',
      description: 'Record new sales',
      screen: 'sales',
      color: '#FD79A8'
    },
    {
      title: 'Customers',
      icon: 'people',
      description: 'Manage customer information',
      screen: 'customers',
      color: '#0984E3'
    },
    {
      title: 'Privilege Cards',
      icon: 'card-membership',
      description: 'Manage customer cards',
      screen: 'PrivilegeCardManagement',
      color: '#FDCB6E'
    },
    {
      title: 'Profile',
      icon: 'account-circle',
      description: 'View and update profile',
      screen: 'staff_profile',
      color: '#A29BFE'
    },
  ];

  const loadStoreDetails = async () => {
    try {
      setLoadingStore(true);
      setError(null);
      
      await refreshUser();
      
      if (!user?.store) {
        setError('No store assigned to your account');
        return;
      }

      const response = await fetchWithAuth(`/api/stores/${user.store}/`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch store details: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data?.id) {
        throw new Error('Invalid store data received from server');
      }
      
      setStoreDetails(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load store information. Please try again.';
      console.error('Error loading store details:', errorMessage);
      setError(errorMessage);
      setStoreDetails(null);
    } finally {
      setLoadingStore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStoreDetails();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStoreDetails();
  }, [user?.store]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigation = (screen: string) => {
    router.push(`/(staff)/${screen}`);
  };

  const handleProfilePress = () => {
    router.push('/(staff)/staff_profile');
  };

  if (loadingStore) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#6C5CE7']}
          tintColor="#6C5CE7"
        />
      }
    >
      {/* Header with user info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.userName}>{user?.username || 'Staff Member'}</Text>
          
          {/* Store Details Section */}
          <View style={styles.storeContainer}>
            <View style={styles.storeHeader}>
              <MaterialIcons name="store" size={20} color="#FFF" />
              <Text style={styles.storeTitle}>STORE DETAILS</Text>
            </View>
            
            {error ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={16} color="#FF6B6B" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={loadStoreDetails}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : storeDetails ? (
              <>
                <Text style={styles.storeName}>{storeDetails.name}</Text>
                <View style={styles.storeDetailRow}>
                  <MaterialIcons name="location-on" size={16} color="#FFFFFF" />
                  <Text style={styles.storeDetail}>{storeDetails.place}</Text>
                </View>
                {storeDetails.phone && (
                  <View style={styles.storeDetailRow}>
                    <MaterialIcons name="phone" size={16} color="#FFFFFF" />
                    <Text style={styles.storeDetail}>{storeDetails.phone}</Text>
                  </View>
                )}
                {storeDetails.email && (
                  <View style={styles.storeDetailRow}>
                    <MaterialIcons name="email" size={16} color="#FFFFFF" />
                    <Text style={styles.storeDetail}>{storeDetails.email}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.storeDetail}>No store information available</Text>
            )}
          </View>
        </View>
        <View style={styles.profileButtonContainer}>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <MaterialIcons name="account-circle" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dashboard content */}
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dashboard </Text>
          <Text style={styles.sectionSubtitle}>Access key features instantly</Text>
        </View>
        
        <View style={styles.dashboardGrid}>
          {dashboardItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleNavigation(item.screen)}
              activeOpacity={0.8}
              style={styles.cardContainer}
            >
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                    <MaterialIcons name={item.icon} size={24} color="#FFF" />
                  </View>
                  <Title style={styles.cardTitle}>{item.title}</Title>
                  <Paragraph style={styles.cardDescription}>
                    {item.description}
                  </Paragraph>
                  <View style={styles.cardArrow}>
                    <MaterialIcons name="arrow-forward" size={20} color={item.color} />
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Footer with logout button */}
      <View style={styles.footer}>
        <Button 
          mode="contained" 
          onPress={handleLogout}
          style={styles.signOutButton}
          labelStyle={styles.signOutButtonText}
          icon={() => <MaterialIcons name="logout" size={20} color="#FFF" />}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C5CE7',
    fontFamily: 'Inter-Medium',
  },
  header: {
    padding: isTablet ? 30 : 24,
    paddingBottom: isTablet ? 40 : 30,
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: isTablet ? 18 : 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  userName: {
    fontSize: isTablet ? 28 : 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  storeContainer: {
    marginTop: 16,
    padding: isTablet ? 20 : 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: isTablet ? '80%' : '100%',
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeTitle: {
    fontSize: isTablet ? 14 : 12,
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'Inter-SemiBold',
  },
  storeName: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  storeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeDetail: {
    fontSize: isTablet ? 15 : 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.2)',
    padding: 12,
    borderRadius: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  errorText: {
    color: '#FFEBEE',
    fontSize: isTablet ? 14 : 13,
    marginLeft: 8,
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 13 : 12,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  profileButtonContainer: {
    marginLeft: 16,
  },
  profileButton: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    padding: isTablet ? 30 : 20,
    marginTop: 10,
  },
  sectionHeader: {
    marginBottom: isTablet ? 30 : 24,
  },
  sectionTitle: {
    fontSize: isTablet ? 26 : 22,
    fontWeight: '700',
    color: '#2D3436',
    fontFamily: 'Inter-Bold',
  },
  sectionSubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: '#636E72',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: isTablet ? '48%' : '100%',
    marginBottom: isTablet ? 24 : 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    height: isTablet ? 180 : 160,
  },
  cardContent: {
    padding: isTablet ? 24 : 20,
    height: '100%',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  cardDescription: {
    fontSize: isTablet ? 14 : 13,
    color: '#636E72',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  cardArrow: {
    position: 'absolute',
    bottom: isTablet ? 24 : 20,
    right: isTablet ? 24 : 20,
  },
  footer: {
    paddingHorizontal: isTablet ? 30 : 24,
    paddingTop: 16,
  },
  signOutButton: {
    backgroundColor: '#FF7675',
    borderRadius: 12,
    paddingVertical: isTablet ? 12 : 10,
    shadowColor: '#FF7675',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  signOutButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: isTablet ? 16 : 15,
    fontFamily: 'Inter-SemiBold',
  },
});