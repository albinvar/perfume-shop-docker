import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,   
  TextInput, 
  Image, 
  ActivityIndicator, 
  ScrollView, 
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ViewStyle,
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

interface Store {
  id: string;
  name: string;
}

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
  fadeAnim: Animated.Value;
}

interface LoginSettings {
  logo_url?: string;
  first_part_text?: string;
  second_part_text?: string;
  first_part_color?: string;
  second_part_color?: string;
  subtitle?: string;
}

const { width } = Dimensions.get('window');

export default function Login() {
  const { signIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loginType, setLoginType] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [storeId, setStoreId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [assignedStores, setAssignedStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loginSettings, setLoginSettings] = useState<LoginSettings | null>(null);

  const BASE_URL = 'https://app-backend-code.onrender.com';

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    const fadeAnim = new Animated.Value(0);
    
    setToastMessages(prev => [...prev, { id, text: message, type, fadeAnim }]);
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id: number) => {
    setToastMessages(prev => {
      const toastToRemove = prev.find(msg => msg.id === id);
      if (toastToRemove) {
        Animated.timing(toastToRemove.fadeAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start(() => {
          setToastMessages(prev => prev.filter(msg => msg.id !== id));
        });
      }
      return prev;
    });
  };

  const fetchStores = async () => {
    try {
      setStoresLoading(true);
      setFetchError('');
      const response = await fetch(`${BASE_URL}/api/stores/`);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      const formattedStores = data.map((store: any) => ({
        id: store.id.toString(),
        name: store.name || `Store ${store.id}`
      }));

      setStores(formattedStores);

      if (formattedStores.length === 0) {
        showToast('No stores available. Contact administrator.', 'error');
      }
    } catch (error: any) {
      console.error('Error fetching stores:', error);
      showToast('Failed to load stores. Pull to refresh.', 'error');
      setStores([]);
    } finally {
      setStoresLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLoginSettings = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/master/login-settings/`);
      if (response.ok) {
        const data = await response.json();
        setLoginSettings(data);
      }
    } catch (error) {
      console.error('Error fetching login settings:', error);
    }
  };

  const fetchAssignedStores = async (username: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/accounts/staff-stores/?username=${username}`);
      if (response.ok) {
        const data = await response.json();
        setAssignedStores(data.stores);
        
        if (data.stores.length === 1) {
          setStoreId(data.stores[0].id);
          showToast(`Auto-selected your assigned store: ${data.stores[0].name}`, 'info');
        }
      }
    } catch (error) {
      console.error('Error fetching assigned stores:', error);
      setAssignedStores([]);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchLoginSettings();
  }, []);

  useEffect(() => {
    if (username && loginType === 'STAFF') {
      const debounceTimer = setTimeout(() => {
        fetchAssignedStores(username);
      }, 500);
      
      return () => clearTimeout(debounceTimer);
    } else {
      setAssignedStores([]);
    }
  }, [username, loginType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStores();
    fetchLoginSettings();
  };

  const handleLogin = async () => {
    if (loginType === 'STAFF' && !storeId) {
      showToast('Please select your assigned store', 'error');
      return;
    }

    if (!username || !password) {
      showToast('Both username and password are required', 'error');
      return;
    }

    setFormLoading(true);
    try {
      await signIn(username, password, loginType, storeId);
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        router.replace(loginType === 'ADMIN' ? '/(admin)' : '/(staff)');
      }, 1500);
    } catch (error: any) {
      console.error('Login failed:', error);
      showToast(
        error?.message || 'Invalid username or password', 
        'error'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const availableStores = loginType === 'STAFF' && assignedStores.length > 0 
    ? assignedStores 
    : stores;

  const getToastStyle = (type: 'success' | 'error' | 'info'): ViewStyle => {
    switch (type) {
      case 'success': return styles.toastSuccess;
      case 'error': return styles.toastError;
      case 'info': return styles.toastInfo;
      default: return styles.toastInfo;
    }
  };

  const ToastContainer = () => (
    <View style={styles.toastContainer}>
      {toastMessages.map((toast) => (
        <Animated.View
          key={toast.id}
          style={[
            styles.toast,
            getToastStyle(toast.type),
            { opacity: toast.fadeAnim }
          ]}
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingContainer}
    >
      <LinearGradient
        colors={['#f90707', '#ff4e49', '#ff797b', '#ffa1a8', '#ffc7ce', '#ffc2d0', '#ffbdd3', '#ffb8d7', '#f288cf', '#d659d4', '#a430e1', '#301ef4']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#FFFFFF']}
            tintColor="#FFFFFF"
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {loginSettings?.logo_url ? (
              <View style={styles.logoWrapper}>
                <Image 
                  source={{ uri: loginSettings.logo_url }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}></Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>
            <Text style={[styles.titleWhite, loginSettings?.first_part_color && { color: loginSettings.first_part_color }]}>
              {loginSettings?.first_part_text }
            </Text>
            <Text style={[styles.titleRed, loginSettings?.second_part_color && { color: loginSettings.second_part_color }]}>
              {loginSettings?.second_part_text }
            </Text>
          </Text>
          <Text style={styles.subtitle}>
            {loginSettings?.subtitle }
          </Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Login</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Login As</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={loginType}
                onValueChange={(itemValue) => {
                  setLoginType(itemValue);
                  setStoreId('');
                }}
                style={styles.picker}
                dropdownIconColor="#6C63FF"
              >
                <Picker.Item label="Administrator" value="ADMIN" />
                <Picker.Item label="Store Staff" value="STAFF" />
              </Picker>
            </View>
          </View>

          {loginType === 'STAFF' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Store</Text>
              {storesLoading ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="small" color="#6C63FF" />
                  <Text style={styles.loaderText}>Loading stores...</Text>
                </View>
              ) : fetchError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{fetchError}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={fetchStores}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={storeId}
                    onValueChange={(itemValue) => setStoreId(itemValue)}
                    style={styles.picker}
                    dropdownIconColor="#6C63FF"
                  >
                    <Picker.Item 
                      label={assignedStores.length > 0 ? 'Select your store' : 'Select a store'} 
                      value="" 
                      enabled={false} 
                    />
                    {availableStores.map(store => (
                      <Picker.Item 
                        key={store.id} 
                        label={store.name} 
                        value={store.id} 
                      />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={20} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#A1A1A1"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!formLoading && !authLoading}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <MaterialIcons name="lock" size={20} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#A1A1A1"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!formLoading && !authLoading}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#6C63FF" 
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.button, 
              (formLoading || authLoading || (loginType === 'STAFF' && !storeId)) && styles.disabledButton
            ]}
            onPress={handleLogin}
            disabled={formLoading || authLoading || (loginType === 'STAFF' && !storeId)}
          >
            <LinearGradient
              colors={['#6C63FF', '#8E85FF']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {(formLoading || authLoading) ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>TRUEBIT TECHNOLOGIES & INVENTIONS PVT.LTD v1.0</Text>
          <Text style={styles.footerText}>© {new Date().getFullYear()} All Rights Reserved</Text>
        </View>
      </ScrollView>
      <ToastContainer />
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleWhite: {
    color: '#FFFFFF',
  },
  titleRed: {
    color: '#FF6B6B',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
     borderRadius: 75,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  logoPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    color: '#2D3748',
    height: 50,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#2D3748',
    fontSize: 16,
    paddingVertical: 0,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    color: '#2D3748',
    fontSize: 16,
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    marginTop: 20,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  loaderText: {
    marginLeft: 12,
    color: '#4A5568',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: 'rgb(255, 255, 255)',
    marginBottom: 4,
    textShadowColor: 'rgba(114, 113, 113, 0.2)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 2,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    padding: 15,
    borderRadius: 12,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    width: width * 0.9,
  },
  toastSuccess: {
    backgroundColor: '#4BB543',
  },
  toastError: {
    backgroundColor: '#FF3333',
  },
  toastInfo: {
    backgroundColor: '#0099CC',
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});