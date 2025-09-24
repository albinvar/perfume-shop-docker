import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity
} from 'react-native';
import { 
  TextInput, 
  Button, 
  Title, 
  Avatar, 
  Text, 
  IconButton, 
  HelperText,
  useTheme,
  Card,
  Divider,
  ActivityIndicator
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface UserData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  place: string;
}

interface PasswordData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserData>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    place: '',
  });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({
    password: '',
    confirm: '',
    username: '',
    current_password: '',
  });
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        place: user.place || '',
      });
      if (user.photo) {
        setAvatarUri(user.photo);
      }
    }

    // Animation on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [user]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      // Here you would typically upload the image to your server
    }
  };

  const validatePassword = () => {
    const newErrors = { ...errors, password: '', confirm: '' };
    let isValid = true;

    if (passwordData.new_password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    } else if (['password', '12345678', 'qwerty', 'muhammed'].includes(passwordData.new_password.toLowerCase())) {
      newErrors.password = 'Password is too common';
      isValid = false;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const validateUsername = (username: string) => {
    const newErrors = { ...errors, username: '' };
    let isValid = true;

    if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
      isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Only letters, numbers and underscores allowed';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleUpdateProfile = async () => {
    // Validate username first
    if (!validateUsername(formData.username)) {
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');

      // Prepare payload - include current password if username is being changed
      const payload: any = { ...formData };
      if (formData.username !== user?.username) {
        if (!passwordData.current_password) {
          setErrors({ ...errors, current_password: 'Current password is required' });
          return;
        }
        payload.current_password = passwordData.current_password;
      }

      const response = await fetch('https://app-backend-code.onrender.com/api/accounts/profile/update/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        // Handle backend validation errors
        if (data.username) {
          setErrors({ ...errors, username: Array.isArray(data.username) ? data.username[0] : data.username });
          throw new Error(data.username);
        }
        if (data.current_password) {
          setErrors({ ...errors, current_password: Array.isArray(data.current_password) ? data.current_password[0] : data.current_password });
          throw new Error(data.current_password);
        }
        throw new Error(data.error || 'Failed to update profile');
      }

      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
      refreshUser();
      // Clear password fields after successful update
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!validatePassword()) return;

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');

      const response = await fetch('https://app-backend-code.onrender.com/api/accounts/profile/update/',  {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.current_password) {
          setErrors({ ...errors, current_password: Array.isArray(data.current_password) ? data.current_password[0] : data.current_password });
          throw new Error(data.current_password);
        }
        if (data.new_password) {
          setErrors({ ...errors, password: Array.isArray(data.new_password) ? data.new_password[0] : data.new_password });
          throw new Error(data.new_password);
        }
        throw new Error(data.error || 'Failed to update password');
      }

      Alert.alert('Success', 'Password updated successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setShowPasswordFields(false);
      refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const renderViewMode = () => (
    <Animated.View 
      style={[
        styles.infoContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.infoRow}>
            <MaterialIcons name="person-outline" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Username</Text>
              <Text style={styles.value}>{formData.username || 'Not provided'}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.value}>
                {formData.first_name} {formData.last_name}
              </Text>
            </View>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{formData.email || 'Not provided'}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{formData.phone || 'Not provided'}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialIcons name="home" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{formData.address || 'Not provided'}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialIcons name="place" size={24} color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{formData.place || 'Not provided'}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  const renderEditMode = () => (
    <Animated.View 
      style={[
        styles.editForm,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Card style={styles.card}>
        <Card.Content>
          <TextInput
            label="Username"
            value={formData.username}
            onChangeText={(text) => {
              setFormData({...formData, username: text});
              validateUsername(text);
            }}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account" />}
            error={!!errors.username}
          />
          <HelperText type="error" visible={!!errors.username}>
            {errors.username}
          </HelperText>

          {formData.username !== user?.username && (
            <>
              <Text style={styles.noteText}>
                Changing username requires current password verification
              </Text>
              <TextInput
                label="Current Password"
                value={passwordData.current_password}
                onChangeText={(text) => {
                  setPasswordData({...passwordData, current_password: text});
                  setErrors({...errors, current_password: ''});
                }}
                secureTextEntry={!showPassword}
                style={styles.input}
                mode="outlined"
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                error={!!errors.current_password}
              />
              <HelperText type="error" visible={!!errors.current_password}>
                {errors.current_password}
              </HelperText>
            </>
          )}

          <TextInput
            label="First Name"
            value={formData.first_name}
            onChangeText={(text) => setFormData({...formData, first_name: text})}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account-details" />}
          />
          <TextInput
            label="Last Name"
            value={formData.last_name}
            onChangeText={(text) => setFormData({...formData, last_name: text})}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account-details" />}
          />
          <TextInput
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({...formData, email: text})}
            style={styles.input}
            keyboardType="email-address"
            mode="outlined"
            left={<TextInput.Icon icon="email" />}
          />
          <TextInput
            label="Phone"
            value={formData.phone}
            onChangeText={(text) => setFormData({...formData, phone: text})}
            style={styles.input}
            keyboardType="phone-pad"
            mode="outlined"
            left={<TextInput.Icon icon="phone" />}
          />
          <TextInput
            label="Address"
            value={formData.address}
            onChangeText={(text) => setFormData({...formData, address: text})}
            style={styles.input}
            multiline
            mode="outlined"
            left={<TextInput.Icon icon="home-map-marker" />}
          />
          <TextInput
            label="Place"
            value={formData.place}
            onChangeText={(text) => setFormData({...formData, place: text})}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="map-marker" />}
          />

          {!showPasswordFields ? (
            <Button 
              mode="contained-tonal"
              onPress={() => setShowPasswordFields(true)}
              style={styles.passwordButton}
              icon="lock-reset"
              labelStyle={styles.passwordButtonLabel}
              contentStyle={styles.passwordButtonContent}
            >
              Change Password
            </Button>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="lock" size={24} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                  Change Password
                </Text>
              </View>
              
              <View style={styles.passwordRequirements}>
                <Text style={styles.passwordNoteTitle}>Password requirements:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={16} 
                    color={passwordData.new_password.length >= 8 ? theme.colors.primary : theme.colors.onSurfaceDisabled} 
                  />
                  <Text style={styles.requirementText}>Minimum 8 characters</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={16} 
                    color={!/^\d+$/.test(passwordData.new_password) ? theme.colors.primary : theme.colors.onSurfaceDisabled} 
                  />
                  <Text style={styles.requirementText}>Cannot be entirely numeric</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={16} 
                    color={passwordData.new_password !== passwordData.current_password ? theme.colors.primary : theme.colors.onSurfaceDisabled} 
                  />
                  <Text style={styles.requirementText}>Different from current password</Text>
                </View>
              </View>

              <TextInput
                label="Current Password"
                value={passwordData.current_password}
                onChangeText={(text) => {
                  setPasswordData({...passwordData, current_password: text});
                  setErrors({...errors, current_password: ''});
                }}
                secureTextEntry={!showPassword}
                style={styles.input}
                mode="outlined"
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                error={!!errors.current_password}
              />
              <HelperText type="error" visible={!!errors.current_password}>
                {errors.current_password}
              </HelperText>
              <TextInput
                label="New Password"
                value={passwordData.new_password}
                onChangeText={(text) => {
                  setPasswordData({...passwordData, new_password: text});
                  validatePassword();
                }}
                secureTextEntry={!showPassword}
                style={styles.input}
                mode="outlined"
                left={<TextInput.Icon icon="lock-plus" />}
                error={!!errors.password}
              />
              <HelperText type="error" visible={!!errors.password}>
                {errors.password}
              </HelperText>
              <TextInput
                label="Confirm New Password"
                value={passwordData.confirm_password}
                onChangeText={(text) => {
                  setPasswordData({...passwordData, confirm_password: text});
                  validatePassword();
                }}
                secureTextEntry={!showPassword}
                style={styles.input}
                mode="outlined"
                left={<TextInput.Icon icon="lock-check" />}
                error={!!errors.confirm}
              />
              <HelperText type="error" visible={!!errors.confirm}>
                {errors.confirm}
              </HelperText>
            </>
          )}
        </Card.Content>
      </Card>
    </Animated.View>
  );

  return (
    <ScrollView 
      contentContainerStyle={[
        styles.scrollContainer, 
        { backgroundColor: theme.colors.background }
      ]}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={isEditing ? pickImage : undefined}>
              <View style={styles.avatarContainer}>
                {avatarUri ? (
                  <Avatar.Image 
                    size={100} 
                    source={{ uri: avatarUri }} 
                    style={styles.avatar}
                  />
                ) : (
                  <Avatar.Icon 
                    size={100} 
                    icon="account" 
                    style={[styles.avatar, { backgroundColor: theme.colors.surface }]} 
                  />
                )}
                {isEditing && (
                  <View style={styles.editAvatarBadge}>
                    <MaterialIcons name="edit" size={20} color="white" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Title style={[styles.title, { color: theme.colors.onPrimary }]}>
                {formData.first_name || 'Profile'}
              </Title>
              <Text style={[styles.subtitle, { color: theme.colors.onPrimary }]}>
                @{formData.username} • {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
              </Text>
            </View>
            
            {!isEditing ? (
              <IconButton
                icon="pencil"
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
                size={24}
                iconColor={theme.colors.onPrimary}
              />
            ) : (
              <IconButton
                icon="close"
                onPress={() => {
                  setIsEditing(false);
                  setShowPasswordFields(false);
                  setPasswordData({
                    current_password: '',
                    new_password: '',
                    confirm_password: '',
                  });
                  setErrors({ password: '', confirm: '', username: '', current_password: '' });
                }}
                style={styles.editButton}
                size={24}
                iconColor={theme.colors.onPrimary}
              />
            )}
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating={true} size="large" />
          </View>
        ) : isEditing ? renderEditMode() : renderViewMode()}

        {isEditing && (
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={showPasswordFields ? handlePasswordChange : handleUpdateProfile}
              loading={loading}
              disabled={loading}
              style={[styles.button, styles.saveButton]}
              icon={showPasswordFields ? "lock-check" : "content-save"}
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
            >
              {showPasswordFields ? 'Update Password' : 'Save Changes'}
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerGradient: {
    padding: 24,
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    borderWidth: 3,
    borderColor: 'white',
    elevation: 4,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  editButton: {
    marginLeft: 'auto',
  },
  infoContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  card: {
    borderRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  label: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 4,
    marginLeft: 44,
  },
  editForm: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  passwordButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  passwordButtonLabel: {
    fontSize: 14,
  },
  passwordButtonContent: {
    height: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  passwordRequirements: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  passwordNoteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 13,
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
    elevation: 2,
  },
  saveButton: {
    flex: 1,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  buttonContent: {
    height: 48,
  },
});