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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'https://app-backend-code.onrender.com';

interface Store {
  id: string;
  name: string;
  place: string;
  email: string;
  phone: string;
  store_id: string;
  gst_number: string;
  photo?: string;
  photo_url?: string;
}

interface FormData {
  name: string;
  place: string;
  email: string;
  phone: string;
  store_id: string;
  gst_number: string;
}

const StoreManagement = () => {
  const { token, user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});
  const [editMode, setEditMode] = useState(false);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  
  // Use ref for form data to prevent unnecessary re-renders
  const formDataRef = useRef<FormData>({
    name: '',
    place: '',
    email: '',
    phone: '',
    store_id: '',
    gst_number: '',
  });

  const formScrollViewRef = useRef<ScrollView>(null);

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
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
      Alert.alert('Error', 'Could not load stores. Please try again later.');
    } finally {
      setStoresLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStores();
  }, [fetchStores]);

  const getStoreImage = useCallback((store: Store): string => {
    if (store.photo_url) {
      return store.photo_url;
    }
    if (store.photo) {
      return store.photo.startsWith('http') ? store.photo : `${API_BASE_URL}${store.photo}`;
    }
    return 'https://via.placeholder.com/150/cccccc/ffffff?text=Store';
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
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  }, []);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formDataRef.current.name) errors.name = 'Store Name is required';
    if (!formDataRef.current.place) errors.place = 'Location is required';
    if (!formDataRef.current.phone) errors.phone = 'Phone number is required';
    if (!formDataRef.current.store_id) errors.store_id = 'Store ID is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  const handleOpenForm = useCallback((store: Store | null = null) => {
    if (store) {
      setEditMode(true);
      setCurrentStoreId(store.id);
      formDataRef.current = {
        name: store.name,
        place: store.place,
        email: store.email || '',
        phone: store.phone,
        store_id: store.store_id,
        gst_number: store.gst_number || '',
      };
      setImage(getStoreImage(store));
    } else {
      setEditMode(false);
      setCurrentStoreId(null);
      formDataRef.current = {
        name: '',
        place: '',
        email: '',
        phone: '',
        store_id: '',
        gst_number: '',
      };
      setImage(null);
    }
    setFormErrors({});
    setFormVisible(true);
  }, [getStoreImage]);

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    formDataRef.current = {
      ...formDataRef.current,
      [field]: value,
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (user?.role !== 'ADMIN') {
      Alert.alert('Error', 'Only admin users can manage stores');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      
      // Add all form data to FormData
      form.append('name', formDataRef.current.name);
      form.append('place', formDataRef.current.place);
      form.append('email', formDataRef.current.email);
      form.append('phone', formDataRef.current.phone);
      form.append('store_id', formDataRef.current.store_id);
      form.append('gst_number', formDataRef.current.gst_number);

      // Handle image upload
      if (image && !image.startsWith('http')) {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        form.append('photo', {
          uri: image,
          name: filename || 'store_photo.jpg',
          type: type,
        } as any);
      } else if (editMode && !image) {
        // If in edit mode and image is removed
        form.append('photo', '');
      }

      const url = editMode && currentStoreId 
        ? `${API_BASE_URL}/api/stores/${currentStoreId}/`
        : `${API_BASE_URL}/api/stores/`;
      
      const method = editMode && currentStoreId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || JSON.stringify(errorData));
      }

      setFormVisible(false);
      await fetchStores();
      Alert.alert('Success', `Store ${editMode ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', error.message || `Failed to ${editMode ? 'update' : 'create'} store. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [validateForm, user?.role, image, editMode, currentStoreId, token, fetchStores]);

  const confirmDeleteStore = useCallback((storeId: string) => {
    setStoreToDelete(storeId);
    setDeleteModalVisible(true);
  }, []);

  const handleDeleteStore = useCallback(async () => {
    if (!storeToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/stores/${storeToDelete}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        await fetchStores();
        Alert.alert('Success', 'Store deleted successfully');
      } else {
        throw new Error('Failed to delete store');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      Alert.alert('Error', error.message || 'Failed to delete store. Please try again.');
    } finally {
      setDeleteLoading(false);
      setDeleteModalVisible(false);
      setStoreToDelete(null);
    }
  }, [storeToDelete, token, fetchStores]);

  const handleImageError = useCallback((storeId: string) => {
    setImageErrors(prev => ({...prev, [storeId]: true}));
  }, []);

  const formatPhoneNumber = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
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
        {/* Featured Stores Carousel */}
        {stores.length > 0 && (
          <View style={styles.carouselContainer}>
            <View style={styles.sectionHeader}>
              <Title style={styles.sectionTitle}>Featured Stores</Title>
              <Chip icon="star" style={styles.featuredChip}>Featured</Chip>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {stores.slice(0, 5).map(store => (
                <TouchableOpacity 
                  key={store.id} 
                  style={styles.storeCard}
                  onPress={() => handleOpenForm(store)}
                >
                  {!imageErrors[store.id] ? (
                    <Image 
                      source={{ uri: getStoreImage(store) }} 
                      style={styles.storeImage}
                      onError={() => handleImageError(store.id)}
                    />
                  ) : (
                    <View style={[styles.storeImage, styles.storeImagePlaceholder]}>
                      <Ionicons name="storefront" size={40} color="#6C63FF" />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.imageOverlay}
                  />
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <View style={styles.storeDetailRow}>
                      <Ionicons name="location-sharp" size={14} color="#D3CAE2" />
                      <Text style={styles.storeDetailText}>{store.place}</Text>
                    </View>
                    <View style={styles.storeDetailRow}>
                      <Ionicons name="call" size={14} color="#E6C17A" />
                      <Text style={styles.storeDetailText}>{formatPhoneNumber(store.phone)}</Text>
                    </View>
                    {store.email && (
                      <View style={styles.storeDetailRow}>
                        <Ionicons name="mail" size={14} color="#3CEB76" />
                        <Text style={styles.storeDetailText}>{store.email}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.header}>
          <Title style={styles.headerText}>Store Management</Title>
          {user?.role === 'ADMIN' && (
            <Button 
              mode="contained" 
              onPress={() => handleOpenForm()}
              style={styles.addButton}
              icon="plus"
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
            >
              Add Store
            </Button>
          )}
        </View>

        {storesLoading ? (
          <ActivityIndicator animating={true} size="large" color="#6C63FF" style={styles.loader} />
        ) : (
          <Card style={styles.tableCard} elevation={3}>
            <DataTable>
              <DataTable.Header style={styles.tableHeader}>
                <DataTable.Title style={styles.storeCell}>
                  <Text style={styles.tableHeaderText}>Store</Text>
                </DataTable.Title>
                <DataTable.Title style={styles.locationCell}>
                  <Text style={styles.tableHeaderText}>Location</Text>
                </DataTable.Title>
                {user?.role === 'ADMIN' && (
                  <DataTable.Title style={styles.actionsCell}>
                    <Text style={styles.tableHeaderText}>Actions</Text>
                  </DataTable.Title>
                )}
              </DataTable.Header>

              {stores.length > 0 ? (
                stores.map(store => (
                  <DataTable.Row key={store.id} style={styles.tableRow}>
                    <DataTable.Cell style={styles.storeCell}>
                      <TouchableOpacity 
                        style={styles.storeRow}
                        onPress={() => handleOpenForm(store)}
                      >
                        {!imageErrors[store.id] ? (
                          <Avatar.Image 
                            size={40} 
                            source={{ uri: getStoreImage(store) }} 
                            style={styles.avatar}
                            onError={() => handleImageError(store.id)}
                          />
                        ) : (
                          <Avatar.Text 
                            size={40} 
                            label={store.name.charAt(0)}
                            style={styles.avatar}
                          />
                        )}
                        <View style={styles.storeTextContainer}>
                          <Text style={styles.storeNameCell}>{store.name}</Text>
                          <Text style={styles.storeId}>ID: {store.store_id}</Text>
                        </View>
                      </TouchableOpacity>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.locationCell}>
                      <View style={styles.locationContent}>
                        <Ionicons name="location-sharp" size={16} color="#6C63FF" />
                        <Text style={styles.locationText}>{store.place}</Text>
                      </View>
                    </DataTable.Cell>
                    {user?.role === 'ADMIN' && (
                      <DataTable.Cell style={styles.actionsCell}>
                        <View style={styles.actionsContainer}>
                          <TouchableOpacity 
                            style={styles.actionButton}
                            onPress={() => handleOpenForm(store)}
                            disabled={loading}
                          >
                            <FontAwesome name="pencil" size={18} color="#4CAF50" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.actionButton}
                            onPress={() => confirmDeleteStore(store.id)}
                            disabled={loading}
                          >
                            {deleteLoading && storeToDelete === store.id ? (
                              <ActivityIndicator size="small" color="#F44336" />
                            ) : (
                              <FontAwesome name="trash" size={18} color="#F44336" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </DataTable.Cell>
                    )}
                  </DataTable.Row>
                ))
              ) : (
                <View style={styles.noData}>
                  <Ionicons name="storefront-outline" size={48} color="#9E9E9E" />
                  <Text style={styles.noDataText}>No stores found</Text>
                </View>
              )}
            </DataTable>
          </Card>
        )}
      </ScrollView>

      {/* Add/Edit Store Modal */}
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
                  title={editMode ? 'Edit Store' : 'Add New Store'} 
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
                  {image && (
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
                  
                  <TextInput
                    label="Store Name *"
                    defaultValue={formDataRef.current.name}
                    onChangeText={(text) => handleInputChange('name', text)}
                    style={styles.input}
                    mode="outlined"
                    error={!!formErrors.name}
                    left={<TextInput.Icon icon="store" />}
                  />
                  <HelperText type="error" visible={!!formErrors.name}>
                    {formErrors.name}
                  </HelperText>
                  
                  <TextInput
                    label="Place *"
                    defaultValue={formDataRef.current.place}
                    onChangeText={(text) => handleInputChange('place', text)}
                    style={styles.input}
                    mode="outlined"
                    error={!!formErrors.place}
                    left={<TextInput.Icon icon="map-marker" />}
                  />
                  <HelperText type="error" visible={!!formErrors.place}>
                    {formErrors.place}
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
                    label="Phone *"
                    defaultValue={formDataRef.current.phone}
                    onChangeText={(text) => handleInputChange('phone', text)}
                    style={styles.input}
                    keyboardType="phone-pad"
                    mode="outlined"
                    error={!!formErrors.phone}
                    left={<TextInput.Icon icon="phone" />}
                  />
                  <HelperText type="error" visible={!!formErrors.phone}>
                    {formErrors.phone}
                  </HelperText>
                  
                  <TextInput
                    label="Store ID *"
                    defaultValue={formDataRef.current.store_id}
                    onChangeText={(text) => handleInputChange('store_id', text)}
                    style={styles.input}
                    mode="outlined"
                    error={!!formErrors.store_id}
                    left={<TextInput.Icon icon="id-card" />}
                  />
                  <HelperText type="error" visible={!!formErrors.store_id}>
                    {formErrors.store_id}
                  </HelperText>
                  
                  <TextInput
                    label="GST Number"
                    defaultValue={formDataRef.current.gst_number}
                    onChangeText={(text) => handleInputChange('gst_number', text)}
                    style={styles.input}
                    mode="outlined"
                    left={<TextInput.Icon icon="receipt" />}
                  />
                  
                  {!image && (
                    <Button 
                      mode="outlined" 
                      onPress={pickImage}
                      style={styles.imageButton}
                      icon="image"
                      labelStyle={styles.buttonLabel}
                    >
                      Select Store Image
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
                      {editMode ? 'Update Store' : 'Add Store'}
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
                Are you sure you want to delete this store? This action cannot be undone.
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
                  onPress={handleDeleteStore}
                  style={styles.deleteModalConfirmButton}
                  labelStyle={styles.deleteModalButtonText}
                  loading={deleteLoading}
                  disabled={deleteLoading}
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
  storeCard: {
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
  storeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#EDF2F7',
  },
  storeImagePlaceholder: {
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
  storeInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  storeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeDetailText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
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
    color: '#E2DFD2',
    fontWeight: 'bold',
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
  storeCell: {
    flex: 3,
    paddingVertical: 12,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  storeNameCell: {
    fontWeight: '600',
    color: '#2D3748',
    fontSize: 14,
  },
  storeId: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  locationCell: {
    flex: 2,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#4A5568',
    fontSize: 13,
    marginLeft: 4,
  },
  actionsCell: {
    flex: 1,
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
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
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

export default StoreManagement;