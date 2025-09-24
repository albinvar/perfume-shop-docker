import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Surface, ActivityIndicator, Snackbar, HelperText } from 'react-native-paper';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const API_BASE_URL = 'https://app-backend-code.onrender.com';

export default function AdminRegister() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState({
    username: false,
    password: false,
    confirmPassword: false,
    firstName: false,
    lastName: false,
    email: false,
  });

  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/check-admin-exists/`);
        const data = await response.json();
        setAdminExists(data.admin_exists);
        
        if (data.admin_exists) {
          showMessage('An admin already exists. Only one admin is allowed.', 'error');
          setTimeout(() => router.replace('../login'), 3000);
        }
      } catch (error) {
        console.error('Error checking admin existence:', error);
      }
    };
    
    checkAdminExists();
  }, []);

  const validateField = (field: string, value: string): boolean => {
    let isValid = true;
    
    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      isValid = emailRegex.test(value);
    } else if (field === 'password') {
      isValid = value.length >= 6;
    } else if (field === 'confirmPassword') {
      isValid = value === formData.password;
    } else if (['username', 'firstName', 'lastName'].includes(field)) {
      isValid = value.trim().length > 0;
    }
    
    setErrors(prev => ({ ...prev, [field]: !isValid }));
    return isValid;
  };

  const showMessage = (message: string, type: string = 'error') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  const handleRegister = async () => {
    if (adminExists) {
      showMessage('Admin registration is not allowed. An admin already exists.');
      return;
    }

    const isUsernameValid = validateField('username', formData.username);
    const isPasswordValid = validateField('password', formData.password);
    const isConfirmPasswordValid = validateField('confirmPassword', formData.confirmPassword);
    const isFirstNameValid = validateField('firstName', formData.firstName);
    const isLastNameValid = validateField('lastName', formData.lastName);
    const isEmailValid = validateField('email', formData.email);

    if (!isUsernameValid || !isPasswordValid || !isConfirmPasswordValid || 
        !isFirstNameValid || !isLastNameValid || !isEmailValid) {
      showMessage('Please correct the errors in the form');
      return;
    }

    try {
      setLoading(true);

      const data = {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone || '',
        role: 'ADMIN',
        is_staff: false,
        is_superuser: true
      };

      const response = await fetch(`${API_BASE_URL}/api/admin-register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json().catch(() => null);

      if (response.ok) {
        showMessage('Admin registration successful! Redirecting to login...', 'success');
        setTimeout(() => router.replace('../login'), 2000);
      } else {
        let errorMessage = 'Admin registration failed. Please try again.';
        if (responseData) {
          if (responseData.username) {
            errorMessage = `Username: ${Array.isArray(responseData.username) ? responseData.username.join(', ') : responseData.username}`;
          } else if (responseData.email) {
            errorMessage = `Email: ${Array.isArray(responseData.email) ? responseData.email.join(', ') : responseData.email}`;
          } else if (responseData.detail) {
            errorMessage = responseData.detail;
          } else if (responseData.error) {
            errorMessage = responseData.error;
          } else if (typeof responseData === 'object') {
            errorMessage = Object.entries(responseData)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
              .join('\n');
          }
        }
        showMessage(errorMessage);
      }
    } catch (error) {
      console.error('Admin registration error:', error);
      showMessage('An error occurred during registration. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (adminExists) {
    return (
      <ImageBackground 
        source={require('../../assets/images/auth-bg.jpg')} 
        style={styles.backgroundImage}
        blurRadius={2}
      >
        <View style={styles.container}>
          <Surface style={styles.surface} elevation={5}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBackground}>
                <FontAwesome5 name="user-shield" size={32} color="#fff" />
              </View>
              <Text style={styles.title}>Admin Exists</Text>
              <Text style={styles.subtitle}>Only one admin account is allowed</Text>
            </View>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>
                An admin account already exists in the system. Please contact the existing admin for access.
              </Text>
              <Button
                mode="contained"
                onPress={() => router.replace('../login')}
                style={styles.loginButton}
                labelStyle={styles.loginButtonLabel}
              >
                Go to Login
              </Button>
            </View>
          </Surface>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground 
      source={require('../../assets/images/auth-bg.jpg')} 
      style={styles.backgroundImage}
      blurRadius={2}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Surface style={styles.surface} elevation={5}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBackground}>
                <FontAwesome5 name="user-shield" size={32} color="#fff" />
              </View>
              <Text style={styles.title}>Admin Registration</Text>
              <Text style={styles.subtitle}>Create the first admin account</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Username *"
                  value={formData.username}
                  onChangeText={(value) => {
                    setFormData(prev => ({ ...prev, username: value }));
                    validateField('username', value);
                  }}
                  onBlur={() => validateField('username', formData.username)}
                  autoCapitalize="none"
                />
                <HelperText type="error" visible={errors.username}>
                  Username is required
                </HelperText>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Password * (min 6 characters)"
                  value={formData.password}
                  onChangeText={(value) => {
                    setFormData(prev => ({ ...prev, password: value }));
                    validateField('password', value);
                  }}
                  onBlur={() => validateField('password', formData.password)}
                  secureTextEntry
                />
                <HelperText type="error" visible={errors.password}>
                  Password must be at least 6 characters
                </HelperText>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm Password *"
                  value={formData.confirmPassword}
                  onChangeText={(value) => {
                    setFormData(prev => ({ ...prev, confirmPassword: value }));
                    validateField('confirmPassword', value);
                  }}
                  onBlur={() => validateField('confirmPassword', formData.confirmPassword)}
                  secureTextEntry
                />
                <HelperText type="error" visible={errors.confirmPassword}>
                  Passwords must match
                </HelperText>
              </View>

              <View style={styles.nameContainer}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    placeholder="First Name *"
                    value={formData.firstName}
                    onChangeText={(value) => {
                      setFormData(prev => ({ ...prev, firstName: value }));
                      validateField('firstName', value);
                    }}
                    onBlur={() => validateField('firstName', formData.firstName)}
                  />
                  <HelperText type="error" visible={errors.firstName}>
                    First name is required
                  </HelperText>
                </View>

                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    placeholder="Last Name *"
                    value={formData.lastName}
                    onChangeText={(value) => {
                      setFormData(prev => ({ ...prev, lastName: value }));
                      validateField('lastName', value);
                    }}
                    onBlur={() => validateField('lastName', formData.lastName)}
                  />
                  <HelperText type="error" visible={errors.lastName}>
                    Last name is required
                  </HelperText>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Email *"
                  value={formData.email}
                  onChangeText={(value) => {
                    setFormData(prev => ({ ...prev, email: value }));
                    validateField('email', value);
                  }}
                  onBlur={() => validateField('email', formData.email)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <HelperText type="error" visible={errors.email}>
                  Valid email is required
                </HelperText>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={formData.phone}
                  onChangeText={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.adminNote}>
                <Text style={styles.adminNoteText}>
                  Note: This is the initial admin registration. Only one admin account is allowed in the system.
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleRegister}
                style={styles.registerButton}
                labelStyle={styles.registerButtonLabel}
                disabled={loading || adminExists}
              >
                {loading ? <ActivityIndicator color="#fff" /> : 'Create Admin Account'}
              </Button>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={() => router.replace('../login')}
                style={styles.loginLink}
              >
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginTextBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </ScrollView>
        
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={snackbarType === 'success' ? 2000 : 4000}
          style={[
            styles.snackbar,
            snackbarType === 'success' ? styles.successSnackbar : styles.errorSnackbar
          ]}
          action={{
            label: 'Dismiss',
            textColor: '#fff',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          <View style={styles.snackbarContent}>
            <MaterialIcons 
              name={snackbarType === 'success' ? 'check-circle' : 'error'} 
              size={20} 
              color="#fff" 
              style={styles.snackbarIcon} 
            />
            <Text style={styles.snackbarText}>{snackbarMessage}</Text>
          </View>
        </Snackbar>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  surface: {
    borderRadius: 16,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBackground: {
    width: 80,
    height: 80,
    backgroundColor: '#d63031',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2d3436',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#636e72',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: '#f5f6fa',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#dfe6e9',
  },
  inputError: {
    borderColor: '#e17055',
  },
  adminNote: {
    backgroundColor: '#ffeaa7',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  adminNoteText: {
    color: '#6c5ce7',
    fontSize: 14,
    textAlign: 'center',
  },
  registerButton: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#d63031',
    elevation: 2,
  },
  registerButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dfe6e9',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#636e72',
    fontSize: 14,
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: 10,
  },
  loginText: {
    color: '#636e72',
    fontSize: 15,
  },
  loginTextBold: {
    color: '#d63031',
    fontWeight: '600',
  },
  snackbar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderRadius: 0,
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snackbarIcon: {
    marginRight: 8,
  },
  snackbarText: {
    color: '#fff',
    fontSize: 15,
  },
  successSnackbar: {
    backgroundColor: '#00b894',
  },
  errorSnackbar: {
    backgroundColor: '#d63031',
  },
  messageContainer: {
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    color: '#636e72',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#d63031',
    elevation: 2,
    width: '100%',
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});