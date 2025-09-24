import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Modal as RNModal
} from 'react-native';
import {
  DataTable,
  Button,
  TextInput,
  Portal,
  Card,
  Avatar,
  Title,
  HelperText,
  IconButton,
  Chip,
  Dialog
} from 'react-native-paper';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { debounce } from 'lodash';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'https://app-backend-code.onrender.com/api/master';

// Type definitions
interface Category {
  id: number;
  name: string;
  description: string;
}

interface Tax {
  id: number;
  name: string;
  rate: number;
  description: string;
}

interface Printer {
  id: number;
  name: string;
  model: string;
  ip_address: string;
  port: string;
}

interface Unit {
  id: number;
  name: string;
  type: 'SALE' | 'PURCHASE';
  symbol: string;
}

interface LoginSettings {
  id: number;
  logo_url: string | null;
  company_name: string;
  first_part_text: string;
  second_part_text: string;
  first_part_color: string;
  second_part_color: string;
  subtitle: string;
}

type FormData = {
  name: string;
  description: string;
  rate: string;
  model: string;
  ip_address: string;
  port: string;
  type: 'SALE' | 'PURCHASE';
  symbol: string;
  logo: any;
  company_name: string;
  first_part_text: string;
  second_part_text: string;
  first_part_color: string;
  second_part_color: string;
  subtitle: string;
};

type MasterTab = 'categories' | 'taxes'  | 'units' | 'login-settings';

const MasterManagement = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loginSettings, setLoginSettings] = useState<LoginSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  
  // Form state management using ref to prevent unnecessary re-renders
  const formDataRef = useRef<FormData>({
    name: '',
    description: '',
    rate: '',
    model: '',
    ip_address: '',
    port: '',
    type: 'SALE',
    symbol: '',
    logo: null,
    company_name: '',
    first_part_text: '',
    second_part_text: '',
    first_part_color: '#FFFFFF',
    second_part_color: '#FF6B6B',
    subtitle: ''
  });

  const [currentItemId, setCurrentItemId] = useState<number | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const isEditMode = useMemo(() => currentItemId !== null, [currentItemId]);

  // Debounced input handler to prevent rapid state updates
  const debouncedHandleInputChange = useCallback(
    debounce((field: keyof FormData, value: string) => {
      formDataRef.current = {
        ...formDataRef.current,
        [field]: value
      };
    }, 150),
    []
  );

  // Clear debounce on unmount
  useEffect(() => {
    return () => {
      debouncedHandleInputChange.cancel();
    };
  }, [debouncedHandleInputChange]);

  // Fetch data with proper cleanup
  const fetchData = useCallback(async () => {
    let isMounted = true;
    
    try {
      setDataLoading(true);
      setError(null);
      
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      let response;
      switch (activeTab) {
        case 'categories':
          response = await fetch(`${API_BASE_URL}/categories/`, { headers });
          const categoriesData = await response.json();
          if (isMounted) setCategories(categoriesData);
          break;
        case 'taxes':
          response = await fetch(`${API_BASE_URL}/taxes/`, { headers });
          const taxesData = await response.json();
          if (isMounted) setTaxes(taxesData);
          break;
        
        case 'units':
          response = await fetch(`${API_BASE_URL}/units/`, { headers });
          const unitsData = await response.json();
          if (isMounted) setUnits(unitsData);
          break;
        case 'login-settings':
          response = await fetch(`${API_BASE_URL}/login-settings/`, { headers });
          const settingsData = await response.json();
          if (isMounted) {
            setLoginSettings(settingsData);
            if (settingsData.logo_url) {
              setLogoPreview(settingsData.logo_url);
            }
          }
          break;
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data. Please try again.');
      }
    } finally {
      if (isMounted) {
        setDataLoading(false);
        setRefreshing(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Reset form only when needed (when opening for new item)
  const resetForm = useCallback(() => {
    formDataRef.current = {
      name: '',
      description: '',
      rate: '',
      model: '',
      ip_address: '',
      port: '',
      type: 'SALE',
      symbol: '',
      logo: null,
      company_name: '',
      first_part_text: '',
      second_part_text: '',
      first_part_color: '#FFFFFF',
      second_part_color: '#FF6B6B',
      subtitle: ''
    };
    setCurrentItemId(null);
    setLogoPreview(null);
  }, []);

  // Image picker with proper cleanup
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
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          formDataRef.current.logo = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type });
        } else {
          formDataRef.current.logo = {
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg'
          };
        }
        
        setLogoPreview(asset.uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      setError('Failed to select image');
    }
  }, []);

  // Open form for new item
  const openAddForm = useCallback(() => {
    resetForm();
    
    if (activeTab === 'login-settings' && loginSettings) {
      formDataRef.current = {
        ...formDataRef.current,
        company_name: loginSettings.company_name,
        first_part_text: loginSettings.first_part_text,
        second_part_text: loginSettings.second_part_text,
        first_part_color: loginSettings.first_part_color,
        second_part_color: loginSettings.second_part_color,
        subtitle: loginSettings.subtitle
      };
    }
    
    setFormModalVisible(true);
  }, [activeTab, loginSettings, resetForm]);

  // Open form for editing existing item
  const openEditForm = useCallback((item: Category | Tax | Printer | Unit | LoginSettings) => {
    setCurrentItemId(item.id);
    
    // Create a new object to avoid mutating the original item
    const formFields: Partial<FormData> = {};
    switch (activeTab) {
      case 'categories':
        formFields.name = (item as Category).name;
        formFields.description = (item as Category).description || '';
        break;
      case 'taxes':
        formFields.name = (item as Tax).name;
        formFields.rate = (item as Tax).rate.toString();
        formFields.description = (item as Tax).description || '';
        break;
      
      case 'units':
        formFields.name = (item as Unit).name;
        formFields.type = (item as Unit).type;
        formFields.symbol = (item as Unit).symbol;
        break;
      case 'login-settings':
        const settings = item as LoginSettings;
        formFields.company_name = settings.company_name;
        formFields.first_part_text = settings.first_part_text;
        formFields.second_part_text = settings.second_part_text;
        formFields.first_part_color = settings.first_part_color;
        formFields.second_part_color = settings.second_part_color;
        formFields.subtitle = settings.subtitle;
        if (settings.logo_url) {
          setLogoPreview(settings.logo_url);
        }
        break;
    }
    
    formDataRef.current = {
      ...formDataRef.current,
      ...formFields
    };
    setFormModalVisible(true);
  }, [activeTab]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      setLoading(true);
      
      // Validation
      if (activeTab !== 'login-settings' && !formDataRef.current.name.trim()) {
        throw new Error('Name is required');
      }

      switch (activeTab) {
        case 'taxes':
          if (!formDataRef.current.rate || isNaN(parseFloat(formDataRef.current.rate))) {
            throw new Error('Valid rate is required');
          }
          break;
        
        case 'units':
          if (!['SALE', 'PURCHASE'].includes(formDataRef.current.type)) {
            throw new Error('Type must be either SALE or PURCHASE');
          }
          if (!formDataRef.current.symbol.trim()) {
            throw new Error('Symbol is required');
          }
          break;
        case 'login-settings':
          if (!formDataRef.current.company_name.trim()) {
            throw new Error('Company name is required');
          }
          break;
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      };

      let response;
      
      if (activeTab === 'login-settings') {
        const formData = new FormData();
        
        if (formDataRef.current.logo) {
          if (Platform.OS === 'web') {
            formData.append('logo', formDataRef.current.logo);
          } else {
            formData.append('logo', {
              uri: formDataRef.current.logo.uri,
              name: formDataRef.current.logo.name,
              type: formDataRef.current.logo.type
            } as any);
          }
        }
        
        formData.append('company_name', formDataRef.current.company_name);
        formData.append('first_part_text', formDataRef.current.first_part_text);
        formData.append('second_part_text', formDataRef.current.second_part_text);
        formData.append('first_part_color', formDataRef.current.first_part_color);
        formData.append('second_part_color', formDataRef.current.second_part_color);
        formData.append('subtitle', formDataRef.current.subtitle);

        headers['Content-Type'] = 'multipart/form-data';
        
        response = await fetch(`${API_BASE_URL}/login-settings/`, {
          method: 'PATCH',
          headers,
          body: formData,
        });
      } else {
        const endpoint = `/${activeTab}/`;
        const payload = getPayloadForActiveTab();
        
        headers['Content-Type'] = 'application/json';
        
        if (isEditMode && currentItemId) {
          response = await fetch(`${API_BASE_URL}${endpoint}${currentItemId}/`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
          });
        } else {
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
        }
      }

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.detail || 'Operation failed');
      }

      setFormModalVisible(false);
      fetchData();
      Alert.alert(
        'Success', 
        `${activeTab === 'login-settings' ? 'Login settings' : activeTab.slice(0, -1)} ${isEditMode ? 'updated' : 'created'} successfully`
      );
    } catch (error) {
      console.error('Submission error:', error);
      setError(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentItemId, isEditMode, token, fetchData]);

  // Get payload based on active tab
  const getPayloadForActiveTab = useCallback(() => {
    const payload: any = {
      name: formDataRef.current.name.trim()
    };

    switch (activeTab) {
      case 'categories':
        payload.description = formDataRef.current.description.trim();
        break;
      case 'taxes':
        payload.rate = parseFloat(formDataRef.current.rate);
        payload.description = formDataRef.current.description.trim();
        break;
      
      case 'units':
        payload.type = formDataRef.current.type;
        payload.symbol = formDataRef.current.symbol.trim();
        break;
    }

    return payload;
  }, [activeTab]);

  // Delete operations
  const confirmDelete = useCallback((id: number) => {
    setCurrentItemId(id);
    setDeleteDialogVisible(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!currentItemId) return;
    
    try {
      setLoading(true);
      
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      const response = await fetch(`${API_BASE_URL}/${activeTab}/${currentItemId}/`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setDeleteDialogVisible(false);
      setCurrentItemId(null);
      fetchData();
      Alert.alert('Success', 'Item deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete item');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentItemId, token, fetchData]);

  // Form field renderers
  const renderLoginSettingsForm = useCallback(() => {
    return (
      <>
        <View style={styles.logoPreviewContainer}>
          {logoPreview ? (
            <Image 
              source={{ uri: logoPreview }} 
              style={styles.logoPreview} 
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialIcons name="image" size={48} color="#ccc" />
              <Text style={styles.logoPlaceholderText}>Logo Preview</Text>
            </View>
          )}
        </View>
        
        <Button 
          mode="outlined" 
          onPress={pickImage}
          style={styles.uploadButton}
          icon="upload"
        >
          {formDataRef.current.logo ? 'Change Logo' : 'Upload Logo'}
        </Button>
        
        <TextInput
          label="Company Name *"
          defaultValue={formDataRef.current.company_name}
          onChangeText={(text) => debouncedHandleInputChange('company_name', text)}
          style={styles.input}
          mode="outlined"
          disabled={loading}
        />
        
        <View style={styles.splitTextContainer}>
          <View style={styles.splitTextInput}>
            <TextInput
              label="First Part Text *"
              defaultValue={formDataRef.current.first_part_text}
              onChangeText={(text) => debouncedHandleInputChange('first_part_text', text)}
              style={styles.input}
              mode="outlined"
              disabled={loading}
            />
          </View>
          <View style={styles.splitTextInput}>
            <TextInput
              label="Second Part Text *"
              defaultValue={formDataRef.current.second_part_text}
              onChangeText={(text) => debouncedHandleInputChange('second_part_text', text)}
              style={styles.input}
              mode="outlined"
              disabled={loading}
            />
          </View>
        </View>
        
        <View style={styles.splitTextContainer}>
          <View style={styles.colorInputContainer}>
            <Text style={styles.colorLabel}>First Part Color *</Text>
            <View style={styles.colorInputWrapper}>
              <TextInput
                defaultValue={formDataRef.current.first_part_color}
                onChangeText={(text) => debouncedHandleInputChange('first_part_color', text)}
                style={[styles.input, styles.colorInput]}
                mode="outlined"
                disabled={loading}
                left={<TextInput.Affix text="#" />}
              />
              <View 
                style={[
                  styles.colorPreview, 
                  { backgroundColor: formDataRef.current.first_part_color }
                ]} 
              />
            </View>
          </View>
          <View style={styles.colorInputContainer}>
            <Text style={styles.colorLabel}>Second Part Color *</Text>
            <View style={styles.colorInputWrapper}>
              <TextInput
                defaultValue={formDataRef.current.second_part_color}
                onChangeText={(text) => debouncedHandleInputChange('second_part_color', text)}
                style={[styles.input, styles.colorInput]}
                mode="outlined"
                disabled={loading}
                left={<TextInput.Affix text="#" />}
              />
              <View 
                style={[
                  styles.colorPreview, 
                  { backgroundColor: formDataRef.current.second_part_color }
                ]} 
              />
            </View>
          </View>
        </View>
        
        <TextInput
          label="Subtitle *"
          defaultValue={formDataRef.current.subtitle}
          onChangeText={(text) => debouncedHandleInputChange('subtitle', text)}
          style={styles.input}
          mode="outlined"
          disabled={loading}
        />
      </>
    );
  }, [logoPreview, loading, pickImage, debouncedHandleInputChange]);

  const renderFormFields = useCallback(() => {
    switch (activeTab) {
      case 'categories':
        return (
          <>
            <TextInput
              label="Name *"
              defaultValue={formDataRef.current.name}
              onChangeText={(text) => debouncedHandleInputChange('name', text)}
              style={styles.input}
              mode="outlined"
              disabled={loading}
            />
            <TextInput
              label="Description"
              defaultValue={formDataRef.current.description}
              onChangeText={(text) => debouncedHandleInputChange('description', text)}
              style={[styles.input, styles.descriptionInput]}
              multiline
              numberOfLines={3}
              mode="outlined"
              disabled={loading}
            />
          </>
        );
      case 'taxes':
        return (
          <>
            <TextInput
              label="Name *"
              defaultValue={formDataRef.current.name}
              onChangeText={(text) => debouncedHandleInputChange('name', text)}
              style={styles.input}
              mode="outlined"
              disabled={loading}
            />
            <TextInput
              label="Rate (%) *"
              defaultValue={formDataRef.current.rate}
              onChangeText={(text) => debouncedHandleInputChange('rate', text)}
              style={styles.input}
              keyboardType="numeric"
              mode="outlined"
              disabled={loading}
              left={<TextInput.Affix text="%" />}
            />
            <TextInput
              label="Description"
              defaultValue={formDataRef.current.description}
              onChangeText={(text) => debouncedHandleInputChange('description', text)}
              style={[styles.input, styles.descriptionInput]}
              multiline
              numberOfLines={3}
              mode="outlined"
              disabled={loading}
            />
          </>
        );
      
      case 'units':
        return (
          <>
            <TextInput
              label="Name *"
              defaultValue={formDataRef.current.name}
              onChangeText={(text) => debouncedHandleInputChange('name', text)}
              style={styles.input}
              mode="outlined"
              disabled={loading}
            />
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Type *</Text>
              <Picker
                selectedValue={formDataRef.current.type}
                onValueChange={(itemValue) => 
                  debouncedHandleInputChange('type', itemValue as 'SALE' | 'PURCHASE')
                }
                enabled={!loading}
              >
                <Picker.Item label="Sale Unit" value="SALE" />
                <Picker.Item label="Purchase Unit" value="PURCHASE" />
              </Picker>
            </View>
            <TextInput
              label="Symbol *"
              defaultValue={formDataRef.current.symbol}
              onChangeText={(text) => debouncedHandleInputChange('symbol', text)}
              style={styles.input}
              mode="outlined"
              maxLength={5}
              disabled={loading}
            />
          </>
        );
      case 'login-settings':
        return renderLoginSettingsForm();
      default:
        return null;
    }
  }, [activeTab, loading, debouncedHandleInputChange, renderLoginSettingsForm]);

  // Content renderers
  const renderLoginSettingsContent = useCallback(() => {
    return (
      <View style={styles.loginSettingsContainer}>
        <View style={styles.loginSettingsPreview}>
          <View style={styles.loginPreviewHeader}>
            {loginSettings?.logo_url ? (
              <Image 
                source={{ uri: loginSettings.logo_url }} 
                style={styles.loginPreviewLogo} 
                resizeMode="contain"
              />
            ) : (
              <View style={styles.loginPreviewLogoPlaceholder}>
                <MaterialIcons name="image" size={48} color="#ccc" />
              </View>
            )}
            <Text style={styles.loginPreviewTitle}>
              <Text style={{ color: loginSettings?.first_part_color || '#FFFFFF' }}>
                {loginSettings?.first_part_text || 'TRUE'}
              </Text>
              <Text style={{ color: loginSettings?.second_part_color || '#FF6B6B' }}>
                {loginSettings?.second_part_text || 'BIT'}
              </Text>
            </Text>
            <Text style={styles.loginPreviewSubtitle}>
              {loginSettings?.subtitle || 'TECHNOLOGIES & INVENTIONS PVT.LTD'}
            </Text>
          </View>
        </View>
        
        <Button 
          mode="contained" 
          onPress={openAddForm}
          style={styles.editLoginSettingsButton}
          labelStyle={styles.editLoginSettingsButtonLabel}
          icon="pencil"
        >
          Edit Login Page Settings
        </Button>
      </View>
    );
  }, [loginSettings, openAddForm]);

  const renderDataTableRows = useCallback(() => {
    const currentData = 
      activeTab === 'categories' ? categories :
      activeTab === 'taxes' ? taxes :
     
      units;

    return currentData.map(item => (
      <DataTable.Row key={item.id} style={styles.dataRow}>
        {renderDataTableCells(item)}
        <DataTable.Cell style={styles.actionsCell}>
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={() => openEditForm(item)}
              style={styles.actionButton}
              disabled={loading}
            >
              <MaterialIcons name="edit" size={20} color="#6200ee" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => confirmDelete(item.id)}
              style={styles.actionButton}
              disabled={loading}
            >
              <MaterialIcons name="delete" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        </DataTable.Cell>
      </DataTable.Row>
    ));
  }, [activeTab, categories, taxes, units, loading, openEditForm, confirmDelete]);

  const renderDataTableCells = useCallback((item: Category | Tax | Printer | Unit) => {
    switch (activeTab) {
      case 'categories':
        const category = item as Category;
        return (
          <>
            <DataTable.Cell style={styles.nameColumn}>{category.name}</DataTable.Cell>
            <DataTable.Cell style={styles.descriptionColumn}>{category.description}</DataTable.Cell>
          </>
        );
      case 'taxes':
        const tax = item as Tax;
        return (
          <>
            <DataTable.Cell style={styles.nameColumn}>{tax.name}</DataTable.Cell>
            <DataTable.Cell numeric style={styles.rateColumn}>{tax.rate}%</DataTable.Cell>
            <DataTable.Cell style={styles.descriptionColumn}>{tax.description}</DataTable.Cell>
          </>
        );
     
      case 'units':
        const unit = item as Unit;
        return (
          <>
            <DataTable.Cell style={styles.nameColumn}>{unit.name}</DataTable.Cell>
            <DataTable.Cell style={styles.typeColumn}>
              {unit.type === 'SALE' ? 'Sale' : 'Purchase'}
            </DataTable.Cell>
            <DataTable.Cell style={styles.symbolColumn}>{unit.symbol}</DataTable.Cell>
          </>
        );
      default:
        return null;
    }
  }, [activeTab]);

  const renderDataTableHeader = useCallback(() => {
    switch (activeTab) {
      case 'categories':
        return (
          <DataTable.Header>
            <DataTable.Title style={styles.nameColumn}>Name</DataTable.Title>
            <DataTable.Title style={styles.descriptionColumn}>Description</DataTable.Title>
            <DataTable.Title style={styles.actionsColumn}>Actions</DataTable.Title>
          </DataTable.Header>
        );
      case 'taxes':
        return (
          <DataTable.Header>
            <DataTable.Title style={styles.nameColumn}>Name</DataTable.Title>
            <DataTable.Title numeric style={styles.rateColumn}>Rate</DataTable.Title>
            <DataTable.Title style={styles.descriptionColumn}>Description</DataTable.Title>
            <DataTable.Title style={styles.actionsColumn}>Actions</DataTable.Title>
          </DataTable.Header>
        );
      
      case 'units':
        return (
          <DataTable.Header>
            <DataTable.Title style={styles.nameColumn}>Name</DataTable.Title>
            <DataTable.Title style={styles.typeColumn}>Type</DataTable.Title>
            <DataTable.Title style={styles.symbolColumn}>Symbol</DataTable.Title>
            <DataTable.Title style={styles.actionsColumn}>Actions</DataTable.Title>
          </DataTable.Header>
        );
      default:
        return null;
    }
  }, [activeTab]);

  const renderContent = useCallback(() => {
    if (dataLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator 
            animating={true} 
            size="large" 
            color="#6a11cb" 
          />
          <Text style={styles.loaderText}>Loading {activeTab.replace('-', ' ')}...</Text>
        </View>
      );
    }

    if (activeTab === 'login-settings') {
      return renderLoginSettingsContent();
    }

    const currentData = 
      activeTab === 'categories' ? categories :
      activeTab === 'taxes' ? taxes : 
      units;

    if (currentData.length === 0) {
      return (
        <View style={styles.noItemsContainer}>
          <MaterialIcons 
            name={
              activeTab === 'categories' ? 'category' :
              activeTab === 'taxes' ? 'attach-money' :
              'help-outline' // default icon
            } 
            size={48} 
            color="#ccc" 
          />
          <Text style={styles.noItemsText}>
            No {activeTab} available
          </Text>
          <Button 
            mode="contained" 
            onPress={openAddForm}
            style={styles.addFirstButton}
            labelStyle={styles.addFirstButtonLabel}
            icon="plus"
          >
            Add Your First {activeTab.slice(0, -1)}
          </Button>
        </View>
      );
    }

    return (
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tableContainer}
      >
        <DataTable style={styles.dataTable}>
          {renderDataTableHeader()}
          {renderDataTableRows()}
        </DataTable>
      </ScrollView>
    );
  }, [
    activeTab, 
    dataLoading, 
    categories, 
    taxes, 
    units, 
    renderLoginSettingsContent, 
    openAddForm, 
    renderDataTableHeader, 
    renderDataTableRows
  ]);

  // Tab navigation
  const renderTab = useCallback((tab: MasterTab, icon: string, label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity 
        style={[styles.tab, isActive && styles.activeTab]}
        onPress={() => setActiveTab(tab)}
      >
        <MaterialIcons 
          name={icon as any} 
          size={20} 
          color={isActive ? 'white' : '#6a11cb'} 
        />
        <Text style={[styles.tabText, isActive && styles.activeTabText]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }, [activeTab]);

  return (
    <View style={styles.container}>
      {/* Header with gradient */}
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Master Management</Text>
            <Text style={styles.headerSubtitle}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
            </Text>
          </View>
          {activeTab !== 'login-settings' && (
            <TouchableOpacity 
              onPress={openAddForm}
              style={styles.addButton}
              disabled={loading}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Tab navigation */}
      <ScrollView 
        horizontal 
        style={styles.tabContainer}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContent}
      >
        {renderTab('categories', 'category', 'Categories')}
        {renderTab('taxes', 'attach-money', 'Taxes')}
        {renderTab('units', 'straighten', 'Units')}
        {renderTab('login-settings', 'login', 'Login Settings')}
      </ScrollView>

      {/* Error display */}
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

      {/* Main content */}
      <ScrollView 
        style={styles.mainScrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#6a11cb']}
            tintColor="#6a11cb"
          />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* Add/Edit Form Modal */}
      <RNModal
        visible={formModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <Card style={styles.modalCard}>
                <Card.Title 
                  title={`${isEditMode ? 'Edit' : 'Add'} ${activeTab === 'login-settings' ? 'Login Settings' : activeTab.slice(0, -1)}`}
                  titleStyle={styles.modalTitle}
                  right={() => (
                    <IconButton 
                      icon="close"
                      onPress={() => setFormModalVisible(false)}
                      style={styles.closeButton}
                    />
                  )}
                />
                <Card.Content style={styles.modalContent}>
                  <ScrollView style={styles.modalScrollView}>
                    {renderFormFields()}
                  </ScrollView>
                  
                  <View style={styles.modalButtons}>
                    <Button 
                      mode="contained" 
                      onPress={handleSubmit}
                      style={styles.submitButton}
                      loading={loading}
                      disabled={loading}
                    >
                      {isEditMode ? 'Update' : 'Save'}
                    </Button>
                    <Button 
                      mode="outlined" 
                      onPress={() => setFormModalVisible(false)}
                      style={styles.cancelButton}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </View>
          </KeyboardAvoidingView>
        </View>
      </RNModal>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog 
          visible={deleteDialogVisible} 
          onDismiss={() => setDeleteDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Are you sure you want to delete this {activeTab === 'login-settings' ? 'login settings' : activeTab.slice(0, -1)}? 
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => setDeleteDialogVisible(false)}
              style={styles.dialogCancelButton}
              labelStyle={styles.dialogButtonLabel}
            >
              Cancel
            </Button>
            <Button 
              onPress={handleDelete} 
              style={styles.dialogDeleteButton}
              labelStyle={styles.dialogButtonLabel}
              loading={loading}
              disabled={loading}
              icon="delete"
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

// Styles (same as before)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  tabContainer: {
    marginTop: 10,
    maxHeight: 50,
  },
  tabContent: {
    paddingHorizontal: 15,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
  },
  activeTab: {
    backgroundColor: '#6a11cb',
  },
  tabText: {
    marginLeft: 8,
    color: '#6a11cb',
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
  },
  errorCard: {
    margin: 15,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
    color: '#D32F2F',
  },
  mainScrollView: {
    flex: 1,
    paddingTop: 10,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    marginTop: 10,
    color: '#666',
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noItemsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  addFirstButton: {
    borderRadius: 8,
    backgroundColor: '#6a11cb',
    paddingVertical: 5,
  },
  addFirstButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  loginSettingsContainer: {
    flex: 1,
    padding: 20,
  },
  loginSettingsPreview: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loginPreviewHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loginPreviewLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    marginBottom: 24,
  },
  loginPreviewLogoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginPreviewTitle: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loginPreviewSubtitle: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  editLoginSettingsButton: {
    borderRadius: 8,
    backgroundColor: '#6a11cb',
    paddingVertical: 8,
  },
  editLoginSettingsButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  tableContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  dataTable: {
    width: '100%',
  },
  dataRow: {
    minHeight: 60,
  },
  nameColumn: {
    width: 150,
  },
  descriptionColumn: {
    width: 200,
  },
  rateColumn: {
    width: 80,
  },
  modelColumn: {
    width: 120,
  },
  ipColumn: {
    width: 150,
  },
  typeColumn: {
    width: 100,
  },
  symbolColumn: {
    width: 80,
  },
  actionsColumn: {
    width: 100,
  },
  actionsCell: {
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalCard: {
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  closeButton: {
    marginRight: 10,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalScrollView: {
    maxHeight: Dimensions.get('window').height * 0.4,
  },
  input: {
    backgroundColor: 'white',
    marginBottom: 12,
  },
  descriptionInput: {
    minHeight: 80,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.54)',
    marginBottom: 4,
    paddingLeft: 12,
  },
  logoPreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoPreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
  },
  logoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    marginTop: 8,
    color: '#888',
  },
  uploadButton: {
    marginBottom: 20,
    borderColor: '#6a11cb',
  },
  splitTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  splitTextInput: {
    width: '48%',
  },
  colorInputContainer: {
    width: '48%',
  },
  colorLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.54)',
    marginBottom: 4,
  },
  colorInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorInput: {
    flex: 1,
    marginRight: 10,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  modalButtons: {
    marginTop: 8,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    backgroundColor: '#6a11cb',
    borderRadius: 10,
    paddingVertical: 6,
    flex: 1,
    marginRight: 8,
  },
  cancelButton: {
    borderColor: '#6a11cb',
    borderRadius: 10,
    paddingVertical: 6,
    flex: 1,
    marginLeft: 8,
  },
  // Dialog styles
  dialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
  },
  dialogTitle: {
    color: '#333',
    fontWeight: 'bold',
  },
  dialogText: {
    color: '#666',
    lineHeight: 20,
  },
  dialogActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dialogCancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginRight: 8,
  },
  dialogDeleteButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
  },
  dialogButtonLabel: {
    color: 'white',
    fontWeight: '500',
  },
});

export default MasterManagement;