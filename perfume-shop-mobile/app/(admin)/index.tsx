import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [weather, setWeather] = useState({ temp: '24°C', condition: 'Sunny' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
    }, 1000);

    return () => {
      clearInterval(timeInterval);
    };
  }, []);

  const dashboardItems = [
    {
      title: 'Staffs',
      icon: 'people',
      description: 'Manage team members',
      screen: 'staff-management',
      color: '#6C63FF'
    },
    {
      title: 'Stores',
      icon: 'store',
      description: 'Manage locations',
      screen: 'store-management',
      color: '#FF6584'
    },
    {
      title: 'Suppliers',
      icon: 'local-shipping',
      description: 'Manage vendors',
      screen: 'supplier-management',
      color: '#FFA34D'
    },
    {
      title: 'Products',
      icon: 'inventory',
      description: 'Manage inventory',
      screen: 'product-management',
      color: '#4CAF50'
    },
    {
      title: 'Reports',
      icon: 'assessment',
      description: 'View analytics',
      screen: 'reports',
      color: '#2196F3'
    },
    {
      title: 'Master Management',
      icon: 'settings',
      description: ' Management configuration',
      screen: 'master-management',
      color: '#9C27B0'
    },
     {
      title: 'Customer Entry',
      icon: 'person-add',
      description: 'Manage customer data',
      screen: 'customer-entry',
      color: '#FF9800'  // Orange color
    },
    {
      title: 'Privilege Cards',
      icon: 'card-membership',
      description: 'Manage loyalty cards',
      screen: 'privilege-cards',
      color: '#607D8B'  // Blue gray color
    },

  ];

  const handleNavigation = (screen: string) => {
    router.push(`/(admin)/${screen}`);
  };

  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getWeatherIcon = () => {
    switch(weather.condition.toLowerCase()) {
      case 'sunny':
        return <FontAwesome name="sun-o" size={20} color="#FFA500" />;
      case 'rainy':
        return <FontAwesome name="umbrella" size={20} color="#2196F3" />;
      case 'cloudy':
        return <FontAwesome name="cloud" size={20} color="#757575" />;
      default:
        return <FontAwesome name="cloud" size={20} color="#757575" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Modern Header with Gradient */}
      <LinearGradient
        colors={['#6C63FF', '#8E2DE2']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <Text style={styles.welcome}>Welcome back </Text>
            <Text style={styles.username}>{user?.username || 'Admin'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          
          <View style={styles.weatherTimeContainer}>
            <View style={styles.weatherContainer}>
              {getWeatherIcon()}
              <Text style={styles.weatherText}>{weather.temp}</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{currentTime}</Text>
              <Text style={styles.dateText}>{currentDate}</Text>
            </View>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => handleNavigation('profile')}
            >
              <MaterialIcons name="admin-panel-settings" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Admin Dashboard</Text>
          
          {/* Dashboard Grid */}
          <View style={styles.dashboardGrid}>
            {dashboardItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.cardContainer, { backgroundColor: item.color }]}
                onPress={() => handleNavigation(item.screen)}
                activeOpacity={0.9}
              >
                <View style={styles.card}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name={item.icon as any} size={28} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDescription}>
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Professional Profile Card */}
          <TouchableOpacity 
            style={styles.profileCard}
            onPress={() => handleNavigation('profile')}
            activeOpacity={0.9}
          >
            <View style={styles.profileContent}>
              <View style={styles.profileImageContainer}>
                <MaterialIcons name="admin-panel-settings" size={40} color="#6C63FF" />
              </View>
              <View style={styles.profileText}>
                <Text style={styles.profileName}>{user?.username || 'Administrator'}</Text>
                <Text style={styles.profileRole}>System Administrator</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
              <MaterialIcons 
                name="chevron-right" 
                size={24} 
                color="#888" 
                style={styles.profileChevron} 
              />
            </View>
          </TouchableOpacity>

          {/* Enhanced Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogoutPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF6584', '#FF8E53']}
              style={styles.logoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.logoutContent}>
                <MaterialIcons name="logout" size={22} color="#FFF" />
                <Text style={styles.logoutButtonText}>Sign Out</Text>
                <View style={styles.logoutArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Sign Out</Text>
            <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    padding: 24,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  weatherTimeContainer: {
    alignItems: 'flex-end',
  },
  weatherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  weatherText: {
    color: '#fff',
    marginLeft: 5,
    fontFamily: 'Inter_500Medium',
  },
  timeContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  dateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  welcome: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Inter_300Light',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
    fontFamily: 'Inter_700Bold',
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    fontFamily: 'Inter_700Bold',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  card: {
    padding: 20,
    alignItems: 'center',
    minHeight: 160,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  cardDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Inter_400Regular',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Inter_600SemiBold',
  },
  profileRole: {
    fontSize: 14,
    color: '#6C63FF',
    marginTop: 2,
    fontFamily: 'Inter_500Medium',
  },
  profileEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  profileChevron: {
    marginLeft: 8,
  },
  logoutButton: {
    marginTop: 25,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  logoutGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    marginRight: 8,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  logoutArrow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    fontFamily: 'Inter_700Bold',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
    fontFamily: 'Inter_400Regular',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  modalCancelText: {
    color: '#666',
    fontFamily: 'Inter_500Medium',
  },
  modalConfirmButton: {
    backgroundColor: '#FF6584',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalConfirmText: {
    color: '#FFF',
    fontFamily: 'Inter_600SemiBold',
  },
});