import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/DashboardScreen';
import ProductManagementScreen from '../screens/admin/ProductManagementScreen';
import PurchaseManagementScreen from '../screens/admin/PurchaseManagementScreen';
import SalesManagementScreen from '../screens/admin/SalesManagementScreen';
import StaffManagementScreen from '../screens/admin/StaffManagementScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import ProfileScreen from '../screens/admin/ProfileScreen';

// Staff Screens
import StaffDashboardScreen from '../screens/staff/DashboardScreen';
import StaffProductScreen from '../screens/staff/ProductScreen';
import StaffSalesScreen from '../screens/staff/SalesScreen';
import StaffProfileScreen from '../screens/staff/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Purchases') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'Sales') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Staff') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Products" component={ProductManagementScreen} />
      <Tab.Screen name="Purchases" component={PurchaseManagementScreen} />
      <Tab.Screen name="Sales" component={SalesManagementScreen} />
      <Tab.Screen name="Staff" component={StaffManagementScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const StaffTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Sales') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={StaffDashboardScreen} />
      <Tab.Screen name="Products" component={StaffProductScreen} />
      <Tab.Screen name="Sales" component={StaffSalesScreen} />
      <Tab.Screen name="Profile" component={StaffProfileScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : user.role === 'ADMIN' ? (
        <Stack.Screen name="AdminTabs" component={AdminTabs} />
      ) : (
        <Stack.Screen name="StaffTabs" component={StaffTabs} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator; 