import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import {
  DataTable,
  Button,
  TextInput,
  Modal,
  Portal,
  Card,
  Avatar,
  Title,
  HelperText,
  IconButton,
  Chip
} from 'react-native-paper';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'https://app-backend-code.onrender.com';

interface Staff {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  place: string;
  photo?: string;
  photo_url?: string;
  store?: {
    id: number;
    name: string;
  };
  store_name?: string;
  password?: string;
}

interface Store {
  id: number;
  name: string;
}

interface FormData {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  place: string;
  password: string;
  store_id: string;
}

const StaffManagement = () => {
  const { token, signOut: logout, user } = useAuth();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [staffToDelete, setStaffToDelete] = useState<number | null>(null);
  const [passwordVisible, setPasswordVisible] = useState<{[key: number]: boolean}>({});
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [storesLoading, setStoresLoading] = useState(true);
  const [staffsLoading, setStaffsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [imageErrors, setImageErrors] = useState<{[key: number]: boolean}>({});
  const [formVisible, setFormVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  const formDataRef = useRef<FormData>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    place: '',
    password: '',
    store_id: '',
  });

  const formScrollViewRef = useRef<ScrollView>(null);

  const fetchStaffs = useCallback(async () => {
    try {
      setStaffsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/accounts/staff/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStaffs(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setError('Failed to fetch staff data');
      setStaffs([]);
      
      if (error instanceof Error && error.message.includes('401')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [{ text: 'OK', onPress: () => logout?.() }]
        );
      }
    } finally {
      setStaffsLoading(false);
      setRefreshing(false);
    }
  }, [token, logout]);

  const fetchStores = useCallback(async () => {
    try {
      setStoresLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/stores/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStores(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error('Error fetching stores:', error);
      setError('Failed to fetch stores data');
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const verifyResponse = await fetch(`${API_BASE_URL}/api/accounts/profile/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!verifyResponse.ok) {
          throw new Error('Session expired');
        }
        
        await fetchStaffs();
        await fetchStores();
      } catch (error) {
        console.error('Auth check failed:', error);
        if (error instanceof Error && error.message.includes('Session expired')) {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please login again.',
            [{ text: 'OK', onPress: () => logout?.() }]
          );
        }
      }
    };

    checkAuthAndFetchData();
  }, [token, fetchStaffs, fetchStores, logout]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStaffs();
  }, [fetchStaffs]);

  const handleOpenForm = useCallback((staff: Staff | null = null) => {
    if (staff) {
      setCurrentStaff(staff);
      setEditMode(true);
      formDataRef.current = {
        username: staff.username,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email || '',
        phone: staff.phone || '',
        address: staff.address || '',
        place: staff.place || '',
        password: '',
        store_id: staff.store?.id?.toString() || '',
      };
      setImage(staff.photo_url || staff.photo || null);
    } else {
      setCurrentStaff(null);
      setEditMode(false);
      formDataRef.current = {
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        place: '',
        password: '',
        store_id: '',
      };
      setImage(null);
    }
    setFormVisible(true);
  }, []);

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    formDataRef.current = {
      ...formDataRef.current,
      [field]: value,
    };
  }, []);

  const pickImage = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'We need camera roll permissions to select images');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      setLoading(true);
      const form = new FormData();
      const currentFormData = formDataRef.current;
      
      if (editMode && currentStaff) {
        form.append('id', currentStaff.id.toString());
        form.append('first_name', currentFormData.first_name);
        form.append('last_name', currentFormData.last_name);
        form.append('email', currentFormData.email);
        form.append('phone', currentFormData.phone);
        form.append('address', currentFormData.address);
        form.append('place', currentFormData.place);
        form.append('store_id', currentFormData.store_id);
      } else {
        form.append('username', currentFormData.username);
        form.append('first_name', currentFormData.first_name);
        form.append('last_name', currentFormData.last_name);
        form.append('email', currentFormData.email);
        form.append('phone', currentFormData.phone);
        form.append('address', currentFormData.address);
        form.append('place', currentFormData.place);
        form.append('password', currentFormData.password);
        form.append('store_id', currentFormData.store_id);
        form.append('role', 'STAFF');
      }
      
      if (image && !image.startsWith('http')) {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        form.append('photo', {
          uri: image,
          name: filename || 'staff_photo.jpg',
          type: type,
        } as any);
      }

      const url = editMode && currentStaff 
        ? `${API_BASE_URL}/api/accounts/staff/${currentStaff.id}/`
        : `${API_BASE_URL}/api/accounts/register/`;
      
      const method = editMode && currentStaff ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: form,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process staff');
      }

      setFormVisible(false);
      fetchStaffs();
      setError(null);
    } catch (error) {
      console.error('Error submitting form:', error);
      setError(error instanceof Error ? error.message : 'Failed to process staff');
      
      if (error instanceof Error && error.message.includes('401')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [{ text: 'OK', onPress: () => logout?.() }]
        );
      }
    } finally {
      setLoading(false);
    }
  }, [editMode, currentStaff, image, token, fetchStaffs, logout]);

  const confirmDelete = useCallback((staffId: number) => {
    setStaffToDelete(staffId);
    setDeleteModalVisible(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!staffToDelete) return;
    
    try {
      setDeleteLoading(staffToDelete);
      
      const verifyResponse = await fetch(`${API_BASE_URL}/api/accounts/profile/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!verifyResponse.ok) {
        throw new Error('Session expired. Please login again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/accounts/staff/${staffToDelete}/delete/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to delete staff (status: ${response.status})`);
      }

      await fetchStaffs();
      
      Alert.alert(
        'Success',
        'Staff member deleted successfully'
      );
    } catch (error) {
      console.error('Delete error:', error);
      
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete staff'
      );
      
      if (error instanceof Error && error.message.includes('Session expired')) {
        logout?.();
      }
    } finally {
      setDeleteLoading(null);
      setDeleteModalVisible(false);
      setStaffToDelete(null);
    }
  }, [staffToDelete, token, fetchStaffs, logout]);

  const getStaffImage = useCallback((staff: Staff) => {
    if (staff.photo_url) return staff.photo_url;
    if (staff.photo) return staff.photo.startsWith('http') ? staff.photo : `${API_BASE_URL}${staff.photo}`;
    return 'https://via.placeholder.com/150/cccccc/ffffff?text=Staff';
  }, []);

  const formatPhoneNumber = useCallback((phone: string) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
  }, []);

  const togglePasswordVisibility = useCallback((staffId: number) => {
    setPasswordVisible(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  }, []);

  const handleImageError = useCallback((staffId: number) => {
    setImageErrors(prev => ({...prev, [staffId]: true}));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.mainScrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#6C63FF']}
            tintColor="#6C63FF"
          />
        }
      >
        {staffs.length > 0 && (
          <View style={styles.carouselContainer}>
            <View style={styles.sectionHeader}>
              <Title style={styles.sectionTitle}>Featured Staff</Title>
              <Chip icon="star" style={styles.featuredChip}>Featured</Chip>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {staffs.slice(0, 5).map(staff => (
                <TouchableOpacity 
                  key={staff.id} 
                  style={styles.staffCard}
                  onPress={() => handleOpenForm(staff)}
                >
                  {!imageErrors[staff.id] ? (
                    <Image 
                      source={{ uri: getStaffImage(staff) }} 
                      style={styles.staffImage}
                      onError={() => handleImageError(staff.id)}
                    />
                  ) : (
                    <View style={[styles.staffImage, styles.staffImagePlaceholder]}>
                      <Ionicons name="person" size={50} color="#6C63FF" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
                    style={styles.imageOverlay}
                  />
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{staff.first_name} {staff.last_name}</Text>
                    <View style={styles.staffDetailRow}>
                      <Ionicons name="at-circle" size={14} color="#FFD700" />
                      <Text style={styles.staffDetailText}>@{staff.username}</Text>
                    </View>

                    <View style={styles.staffDetailRow}>
                      <Ionicons name="call" size={14} color="#FFD700" />
                      <Text style={styles.staffDetailText}>{formatPhoneNumber(staff.phone)}</Text>
                    </View>
                    


                    <View style={styles.staffDetailRow}>
                      <Ionicons name="business" size={14} color="#4CAF50" />
                      <Text style={styles.staffDetailText}>{staff.store_name || 'No Store'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.header}>
          <Title style={styles.headerText}>Staff Management</Title>
          {user?.role === 'ADMIN' && (
            <Button 
              mode="contained" 
              onPress={() => handleOpenForm()}
              style={styles.addButton}
              icon="plus"
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
            >
              Add Staff
            </Button>
          )}
        </View>

        {error && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <View style={styles.errorContent}>
                <MaterialIcons name="error-outline" size={24} color="#D32F2F" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {staffsLoading ? (
          <ActivityIndicator animating={true} size="large" color="#6C63FF" style={styles.loader} />
        ) : (
          <Card style={styles.tableCard} elevation={3}>
            <DataTable>
              <DataTable.Header style={styles.tableHeader}>
                <DataTable.Title style={styles.staffCell}><Text style={styles.tableHeaderText}>Staff</Text></DataTable.Title>
                <DataTable.Title style={styles.storeCell}><Text style={styles.tableHeaderText}>Store</Text></DataTable.Title>
                {user?.role === 'ADMIN' && (
                  <>
                    <DataTable.Title style={styles.passwordCell}><Text style={styles.tableHeaderText}>Password</Text></DataTable.Title>
                    <DataTable.Title style={styles.actionsCell}><Text style={styles.tableHeaderText}>Actions</Text></DataTable.Title>
                  </>
                )}
              </DataTable.Header>

              {staffs.length > 0 ? (
                staffs.map(staff => (
                  <DataTable.Row key={staff.id} style={styles.tableRow}>
                    <DataTable.Cell style={styles.staffCell}>
                      <TouchableOpacity 
                        style={styles.staffRow}
                        onPress={() => handleOpenForm(staff)}
                      >
                        {!imageErrors[staff.id] ? (
                          <Avatar.Image 
                            size={40} 
                            source={{ uri: getStaffImage(staff) }} 
                            style={styles.avatar}
                            onError={() => handleImageError(staff.id)}
                          />
                        ) : (
                          <Avatar.Text 
                            size={40} 
                            label={`${staff.first_name.charAt(0)}${staff.last_name.charAt(0)}`}
                            style={styles.avatar}
                          />
                        )}
                        <View style={styles.staffTextContainer}>
                          <Text style={styles.staffNameCell}>{staff.first_name} {staff.last_name}</Text>
                          <Text style={styles.staffUsername}>@{staff.username}</Text>
                          
                        </View>
                      </TouchableOpacity>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.storeCell}>
                      <Text style={styles.storeText} numberOfLines={2}>
                        {staff.store_name || 'N/A'}
                      </Text>
                    </DataTable.Cell>

                    {user?.role === 'ADMIN' && (
                      <>
                        <DataTable.Cell style={styles.passwordCell}>
                          <View style={styles.passwordContainer}>
                            <Text style={styles.passwordText}>
                              {passwordVisible[staff.id] ? staff.password || 'N/A' : '••••••'}
                            </Text>
                            <IconButton
                              icon={passwordVisible[staff.id] ? "eye-off" : "eye"}
                              size={16}
                              onPress={() => togglePasswordVisibility(staff.id)}
                              style={styles.passwordIcon}
                            />
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell style={styles.actionsCell}>
                          <View style={styles.actionsContainer}>
                            <TouchableOpacity 
                              style={styles.actionButton}
                              onPress={() => handleOpenForm(staff)}
                              disabled={loading || deleteLoading === staff.id}
                            >
                              <FontAwesome name="pencil" size={18} color="#4CAF50" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.actionButton}
                              onPress={() => confirmDelete(staff.id)}
                              disabled={loading || deleteLoading === staff.id}
                            >
                              {deleteLoading === staff.id ? (
                                <ActivityIndicator size="small" color="#F44336" />
                              ) : (
                                <FontAwesome name="trash" size={18} color="#F44336" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </DataTable.Cell>
                      </>
                    )}
                  </DataTable.Row>
                ))
              ) : (
                <View style={styles.noData}>
                  <Ionicons name="people-outline" size={48} color="#9E9E9E" />
                  <Text style={styles.noDataText}>No staff members found</Text>
                </View>
              )}
            </DataTable>
          </Card>
        )}
      </ScrollView>

      {/* Add/Edit Staff Modal */}
      <Portal>
        <Modal 
          visible={formVisible} 
          onDismiss={() => setFormVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <ScrollView 
              ref={formScrollViewRef}
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Card style={styles.modalCard}>
                <Card.Title 
                  title={editMode ? 'Edit Staff' : 'Add New Staff'} 
                  titleStyle={styles.modalTitle}
                  right={() => (
                    <TouchableOpacity 
                      onPress={() => setFormVisible(false)}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={24} color="#6C63FF" />
                    </TouchableOpacity>
                  )}
                />
                <Card.Content style={styles.modalContent}>
                  {(image) && (
                    <View style={styles.imagePreviewContainer}>
                      <Image 
                        source={{ uri: image }} 
                        style={styles.modalImagePreview}
                      />
                      <TouchableOpacity 
                        style={styles.changeImageButton}
                        onPress={pickImage}
                      >
                        <Ionicons name="camera" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {!editMode && (
                    <>
                      <TextInput
                        label="Username *"
                        defaultValue={formDataRef.current.username}
                        onChangeText={(text) => handleInputChange('username', text)}
                        style={styles.input}
                        mode="outlined"
                        left={<TextInput.Icon icon="account" />}
                      />
                      <HelperText type="error" visible={!formDataRef.current.username}>
                        Username is required
                      </HelperText>
                    </>
                  )}
                  
                  <TextInput
                    label="First Name *"
                    defaultValue={formDataRef.current.first_name}
                    onChangeText={(text) => handleInputChange('first_name', text)}
                    style={styles.input}
                    mode="outlined"
                    left={<TextInput.Icon icon="account-details" />}
                  />
                  <HelperText type="error" visible={!formDataRef.current.first_name}>
                    First name is required
                  </HelperText>
                  
                  <TextInput
                    label="Last Name *"
                    defaultValue={formDataRef.current.last_name}
                    onChangeText={(text) => handleInputChange('last_name', text)}
                    style={styles.input}
                    mode="outlined"
                    left={<TextInput.Icon icon="account-details" />}
                  />
                  <HelperText type="error" visible={!formDataRef.current.last_name}>
                    Last name is required
                  </HelperText>
                  
                  <TextInput
                    label="Email"
                    defaultValue={formDataRef.current.email}
                    onChangeText={(text) => handleInputChange('email', text)}
                    style={styles.input}
                    keyboardType="email-address"
                    mode="outlined"
                    left={<TextInput.Icon icon="email" />}
                  />
                  
                  <TextInput
                    label="Phone"
                    defaultValue={formDataRef.current.phone}
                    onChangeText={(text) => handleInputChange('phone', text)}
                    style={styles.input}
                    keyboardType="phone-pad"
                    mode="outlined"
                    left={<TextInput.Icon icon="phone" />}
                  />
                  
                  <TextInput
                    label="Address"
                    defaultValue={formDataRef.current.address}
                    onChangeText={(text) => handleInputChange('address', text)}
                    style={styles.input}
                    mode="outlined"
                    multiline
                    left={<TextInput.Icon icon="home" />}
                  />
                  
                  <TextInput
                    label="Place"
                    defaultValue={formDataRef.current.place}
                    onChangeText={(text) => handleInputChange('place', text)}
                    style={styles.input}
                    mode="outlined"
                    left={<TextInput.Icon icon="map-marker" />}
                  />
                  
                  {!editMode && (
                    <>
                      <TextInput
                        label="Password *"
                        defaultValue={formDataRef.current.password}
                        onChangeText={(text) => handleInputChange('password', text)}
                        style={styles.input}
                        secureTextEntry
                        mode="outlined"
                        left={<TextInput.Icon icon="lock" />}
                      />
                      <HelperText type="error" visible={!formDataRef.current.password}>
                        Password is required
                      </HelperText>
                    </>
                  )}
                  
                  <View style={styles.pickerContainer}>
                    {storesLoading ? (
                      <ActivityIndicator animating={true} size="small" color="#6C63FF" />
                    ) : (
                      <Picker
                        selectedValue={formDataRef.current.store_id}
                        onValueChange={(itemValue) => handleInputChange('store_id', itemValue)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select Store" value="" />
                        {stores.map(store => (
                          <Picker.Item key={store.id} label={store.name} value={store.id.toString()} />
                        ))}
                      </Picker>
                    )}
                  </View>
                  
                  {!image && (
                    <Button 
                      mode="outlined" 
                      onPress={pickImage}
                      style={styles.imageButton}
                      icon="image"
                      labelStyle={styles.buttonLabel}
                    >
                      Select Staff Image
                    </Button>
                  )}
                  
                  <View style={styles.modalButtons}>
                    <Button 
                      mode="contained" 
                      onPress={handleSubmit}
                      style={styles.submitButton}
                      loading={loading}
                      disabled={loading}
                      labelStyle={styles.buttonLabel}
                      icon={editMode ? "content-save" : "plus"}
                    >
                      {editMode ? 'Update Staff' : 'Add Staff'}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>

      {/* Delete Confirmation Modal */}
      <Portal>
        <Modal 
          visible={deleteModalVisible} 
          onDismiss={() => setDeleteModalVisible(false)}
          contentContainerStyle={styles.deleteModalContainer}
        >
          <Card style={styles.deleteModalCard}>
            <Card.Content>
              <View style={styles.deleteModalHeader}>
                <MaterialIcons name="warning" size={32} color="#F44336" />
                <Title style={styles.deleteModalTitle}>Confirm Delete</Title>
              </View>
              <Text style={styles.deleteModalText}>
                Are you sure you want to delete this staff member? This action cannot be undone.
              </Text>
              
              <View style={styles.deleteModalButtons}>
                <Button 
                  mode="outlined" 
                  onPress={() => setDeleteModalVisible(false)}
                  style={styles.deleteModalCancelButton}
                  labelStyle={styles.deleteModalButtonText}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={handleDelete}
                  style={styles.deleteModalConfirmButton}
                  labelStyle={styles.deleteModalButtonText}
                  loading={deleteLoading !== null}
                  disabled={deleteLoading !== null}
                  icon="delete"
                >
                  Delete
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  mainScrollView: {
    flex: 1,
    padding: 16,
  },
  carouselContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    color: '#2D3748',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  featuredChip: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  carousel: {
    paddingHorizontal: 8,
  },
  staffCard: {
    width: width * 0.7,
    height: 180,
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  staffImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#EDF2F7',
  },
  staffImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  staffInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  staffName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  staffDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  staffDetailText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  addButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    elevation: 2,
  },
  buttonContent: {
    flexDirection: 'row-reverse',
  },
  buttonLabel: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    marginBottom: 16,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    fontSize: 14,
  },
  tableCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tableHeader: {
    backgroundColor: '#6C63FF',
  },
  tableHeaderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  staffCell: {
    flex: 2,
    paddingVertical: 12,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  staffNameCell: {
    fontWeight: '600',
    color: '#2D3748',
    fontSize: 14,
  },
  staffUsername: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#6C63FF',
    marginLeft: 4,
  },
  storeCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  storeText: {
    color: '#4A5568',
    fontSize: 16,
  },
  passwordCell: {
    flex: 1.5,
    justifyContent: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordText: {
    color: '#4A5568',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  passwordIcon: {
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
  actionsCell: {
    flex: 0.8,
    justifyContent: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    padding: 6,
  },
  avatar: {
    backgroundColor: '#EDF2F7',
  },
  loader: {
    marginTop: 40,
  },
  noData: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: '#718096',
    marginTop: 16,
    fontSize: 16,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: 'white',
    padding: 0,
    margin: 0,
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalCard: {
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  closeButton: {
    padding: 8,
    marginRight: 10,
  },
  modalContent: {
    paddingBottom: 20,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
  },
  modalImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    resizeMode: 'cover',
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 10,
    right: '35%',
    backgroundColor: '#6C63FF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
  imageButton: {
    marginBottom: 16,
    borderColor: '#6C63FF',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'white',
  },
  modalButtons: {
    marginTop: 8,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 6,
  },
  deleteModalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  deleteModalCard: {
    backgroundColor: 'white',
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#2D3748',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 24,
    lineHeight: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  deleteModalCancelButton: {
    marginRight: 10,
    borderColor: '#6C63FF',
    borderRadius: 8,
  },
  deleteModalConfirmButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
  },
  deleteModalButtonText: {
    fontWeight: 'bold',
  },
});

export default StaffManagement;