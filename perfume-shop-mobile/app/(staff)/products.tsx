import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import {
  DataTable,
  Button,
  TextInput,
  Modal,
  Portal,
  Menu,
  Divider,
  Dialog,
  ActivityIndicator,
  Chip,
  HelperText,
  Snackbar,
} from 'react-native-paper';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

// Types
interface Product {
  id: number;
  product_code: string;
  name: string;
  hsn_code?: string;
  mrp: number;
  discount: number;
  calculated_price: number;
  barcode: string;
  category?: { id: number; name: string };
  tax1?: { id: number; name: string; rate: number };
  tax2?: { id: number; name: string; rate: number };
  tax1_name?: string;
  tax2_name?: string;
  unit?: { id: number; name: string; symbol: string };
  store?: { id: number; name: string } | number | null;
  store_name?: string;
  image_url?: string;
  description?: string;
  purchase_rate?: number;
  sale_rate?: number;
  tax_type: 'INCLUSIVE' | 'EXCLUSIVE';
  opening_stock?: number;
  sold_quantity?: number;
}

interface Category {
  id: number;
  name: string;
}

interface Tax {
  id: number;
  name: string;
  rate: number;
}

interface Unit {
  id: number;
  name: string;
  symbol: string;
}

interface Store {
  id: number;
  name: string;
}

interface User {
  role: 'ADMIN' | 'STAFF';
  store?: { id: number; name: string } | number | null;
}

interface FormState {
  product_code: string;
  name: string;
  hsn_code: string;
  category_id: string;
  mrp: string;
  discount: string;
  purchase_rate: string;
  sale_rate: string;
  tax1_id: string;
  tax2_id: string;
  tax_type: 'INCLUSIVE' | 'EXCLUSIVE';
  opening_stock: string;
  description: string;
  barcode: string;
  unit_id: string;
  store_id: string;
}

const { width, height } = Dimensions.get('window');
const BASE_URL = 'https://app-backend-code.onrender.com';
const COMPANY_PREFIX = "COMP";
const BARCODE_SEPARATOR = "-";
const PRICE_SEPARATOR = "₹";

const ProductForm: React.FC<{
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (formData: FormState & { image?: string | null }) => Promise<void>;
  initialData?: Product | null;
  categories: Category[];
  taxes: Tax[];
  units: Unit[];
  stores: Store[];
  isLoading: boolean;
  user: User | null;
  products: Product[];
}> = ({
  visible,
  onDismiss,
  onSubmit,
  initialData,
  categories,
  taxes,
  units,
  stores,
  isLoading,
  user,
  products,
}) => {
  const [formState, setFormState] = useState<FormState>({
    product_code: '',
    name: '',
    hsn_code: '',
    category_id: '',
    mrp: '',
    discount: '0',
    purchase_rate: '',
    sale_rate: '',
    tax1_id: '',
    tax2_id: '',
    tax_type: 'INCLUSIVE',
    opening_stock: '',
    description: '',
    barcode: '',
    unit_id: '',
    store_id: user?.role === 'ADMIN' ? '' : 
             (user?.store && typeof user.store === 'object' ? 
              user.store.id.toString() : 
              user?.store?.toString() || ''),
  });

  const [image, setImage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [tax1MenuVisible, setTax1MenuVisible] = useState(false);
  const [tax2MenuVisible, setTax2MenuVisible] = useState(false);
  const [taxTypeMenuVisible, setTaxTypeMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setFormState({
          product_code: initialData.product_code,
          name: initialData.name,
          hsn_code: initialData.hsn_code || '',
          category_id: initialData.category?.id?.toString() || '',
          mrp: initialData.mrp.toString(),
          discount: initialData.discount?.toString() || '0',
          purchase_rate: initialData.purchase_rate?.toString() || '',
          sale_rate: initialData.sale_rate?.toString() || initialData.calculated_price?.toString() || initialData.mrp.toString(),
          tax1_id: initialData.tax1?.id?.toString() || '',
          tax2_id: initialData.tax2?.id?.toString() || '',
          tax_type: initialData.tax_type || 'INCLUSIVE',
          opening_stock: initialData.opening_stock?.toString() || '0',
          description: initialData.description || '',
          barcode: initialData.barcode,
          unit_id: initialData.unit?.id?.toString() || '',
          store_id: initialData.store 
            ? (typeof initialData.store === 'object' 
              ? initialData.store.id.toString() 
              : initialData.store.toString())
            : '',
        });
        setImage(initialData.image_url || null);
      } else {
        setFormState({
          product_code: '',
          name: '',
          hsn_code: '',
          category_id: '',
          mrp: '',
          discount: '0',
          purchase_rate: '',
          sale_rate: '',
          tax1_id: '',
          tax2_id: '',
          tax_type: 'INCLUSIVE',
          opening_stock: '',
          description: '',
          barcode: '',
          unit_id: '',
          store_id: user?.role === 'ADMIN' ? '' : 
                   (user?.store && typeof user.store === 'object' ? 
                    user.store.id.toString() : 
                    user?.store?.toString() || ''),
        });
        setImage(null);
      }
      setFormErrors({});
    }
  }, [visible, initialData, user]);

  const generateProductCode = () => {
    const highestCode = products.reduce((max, product) => {
      const codeNumber = parseInt(product.product_code.split('-').pop() || '0');
      return Math.max(max, codeNumber);
    }, 0);
    
    return `${String(highestCode + 1).padStart(3, '0')}`;
  };

  const generateBarcode = (productCode: string, name: string, finalPrice: number) => {
    const cleanName = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 5);
    return `${COMPANY_PREFIX}${BARCODE_SEPARATOR}${productCode}${BARCODE_SEPARATOR}${cleanName}${BARCODE_SEPARATOR}${PRICE_SEPARATOR}${finalPrice.toFixed(2)}`;
  };

  const priceCalculations = useMemo(() => {
    const mrp = parseFloat(formState.mrp) || 0;
    const discountPercentage = parseFloat(formState.discount) || 0;
    const discountAmount = (mrp * discountPercentage) / 100;
    const priceAfterDiscount = mrp - discountAmount;
    
    const tax1Rate = formState.tax1_id ? 
      taxes.find(t => t.id.toString() === formState.tax1_id)?.rate || 0 : 0;
    const tax2Rate = formState.tax2_id ? 
      taxes.find(t => t.id.toString() === formState.tax2_id)?.rate || 0 : 0;
    
    let price = priceAfterDiscount;
    let tax1Amount = 0;
    let tax2Amount = 0;
    
    if (formState.tax_type === 'EXCLUSIVE') {
      if (tax1Rate > 0) tax1Amount = (priceAfterDiscount * tax1Rate) / 100;
      if (tax2Rate > 0) tax2Amount = (priceAfterDiscount * tax2Rate) / 100;
      price += tax1Amount + tax2Amount;
    }
    
    let saleRate = formState.sale_rate;
    if (!saleRate || saleRate === formState.mrp || parseFloat(saleRate) === parseFloat(price.toFixed(2))) {
      saleRate = price.toFixed(2);
    }

    return {
      finalPrice: isNaN(price) ? 0 : price,
      discountAmount: discountAmount.toFixed(2),
      tax1Rate,
      tax2Rate,
      tax1Amount,
      tax2Amount,
      totalTaxAmount: tax1Amount + tax2Amount,
      priceAfterDiscount: priceAfterDiscount.toFixed(2),
      saleRate
    };
  }, [formState.mrp, formState.discount, formState.tax_type, formState.sale_rate, formState.tax1_id, formState.tax2_id, taxes]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFormState(prev => ({
        ...prev,
        barcode: generateBarcode(
          prev.product_code || generateProductCode(), 
          prev.name, 
          priceCalculations.finalPrice
        ),
        sale_rate: priceCalculations.saleRate
      }));
    }, 500);

    return () => clearTimeout(timeout);
  }, [formState.product_code, formState.name, priceCalculations.finalPrice]);

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formState.name.trim()) errors.name = 'Product name is required';
    if (!formState.mrp.trim()) errors.mrp = 'MRP is required';
    
    if (formState.mrp && isNaN(Number(formState.mrp))) {
      errors.mrp = 'MRP must be a number';
    }

    if (formState.discount && (isNaN(Number(formState.discount)) || Number(formState.discount) < 0 || Number(formState.discount) > 100)) {
      errors.discount = 'Discount must be between 0 and 100';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      await onSubmit({
        ...formState,
        image: image && !image.startsWith('http') ? image : null
      });
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'We need access to your photos to upload images');
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

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const getTaxName = (id: string, taxNumber: number) => {
    if (!id) return `Tax ${taxNumber}`;
    const tax = taxes.find(t => t.id.toString() === id);
    return tax ? `${tax.name} (${tax.rate}%)` : `Tax ${taxNumber}`;
  };

  const getCategoryName = (id: string) => 
    categories.find(c => c.id.toString() === id)?.name || 'Select Category';
  
  const getUnitName = (id: string) => {
    const unit = units.find(u => u.id.toString() === id);
    return unit ? `${unit.name} (${unit.symbol})` : 'Select Unit';
  };

  const getStoreName = (id: string) => {
    if (!id) return 'Global Product';
    const store = stores.find(s => s.id.toString() === id);
    return store ? store.name : `Store ${id}`;
  };

  const renderPriceSummary = () => {
    const { finalPrice, discountAmount, priceAfterDiscount, tax1Rate, tax2Rate, tax1Amount, tax2Amount, totalTaxAmount } = priceCalculations;
    const mrp = parseFloat(formState.mrp || '0');

    return (
      <View style={styles.priceSummaryContainer}>
        <View style={styles.priceSummaryRow}>
          <Text style={styles.priceSummaryLabel}>MRP:</Text>
          <Text style={styles.priceSummaryValue}>
            ₹{mrp.toFixed(2)}
          </Text>
        </View>
        {parseFloat(formState.discount || '0') > 0 && (
          <>
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryLabel}>Discount ({formState.discount}%):</Text>
              <Text style={styles.priceSummaryValue}>
                -₹{discountAmount}
              </Text>
            </View>
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryLabel}>Price After Discount:</Text>
              <Text style={styles.priceSummaryValue}>
                ₹{priceAfterDiscount}
              </Text>
            </View>
          </>
        )}
        {formState.tax1_id && (
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummaryLabel}>{getTaxName(formState.tax1_id, 1)}:</Text>
            <Text style={styles.priceSummaryValue}>
              {formState.tax_type === 'EXCLUSIVE' ? 
                `+₹${tax1Amount.toFixed(2)}` : 'Included'}
            </Text>
          </View>
        )}
        {formState.tax2_id && (
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummaryLabel}>{getTaxName(formState.tax2_id, 2)}:</Text>
            <Text style={styles.priceSummaryValue}>
              {formState.tax_type === 'EXCLUSIVE' ? 
                `+₹${tax2Amount.toFixed(2)}` : 'Included'}
            </Text>
          </View>
        )}
        {formState.tax_type === 'EXCLUSIVE' && (formState.tax1_id || formState.tax2_id) && (
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummaryLabel}>Total Tax:</Text>
            <Text style={styles.priceSummaryValue}>
              +₹{totalTaxAmount.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={[styles.priceSummaryRow, styles.finalPriceRow]}>
          <Text style={[styles.priceSummaryLabel, styles.finalPriceLabel]}>Final Price:</Text>
          <Text style={[styles.priceSummaryValue, styles.finalPriceValue]}>
            ₹{typeof finalPrice === 'number' ? finalPrice.toFixed(2) : finalPrice}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal 
      visible={visible} 
      onDismiss={onDismiss}
      contentContainerStyle={styles.modalContainer}
    >
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.modalHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.modalTitle}>
          {initialData ? 'Edit Product' : 'Add New Product'}
        </Text>
        <TouchableOpacity 
          onPress={onDismiss}
          style={styles.modalCloseButton}
        >
          <MaterialIcons name="close" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.modalScroll}
        contentContainerStyle={styles.modalContent}
        keyboardShouldPersistTaps="handled"
      >
        {user?.role === 'ADMIN' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Store Assignment</Text>
            <Menu
              visible={storeMenuVisible}
              onDismiss={() => setStoreMenuVisible(false)}
              anchor={
                <TouchableOpacity 
                  onPress={() => setStoreMenuVisible(true)}
                  style={styles.menuButton}
                  disabled={isLoading}
                >
                  <TextInput
                    label="Store"
                    value={getStoreName(formState.store_id)}
                    style={styles.modalInput}
                    mode="outlined"
                    editable={false}
                    pointerEvents="none"
                    disabled={isLoading}
                    right={<TextInput.Icon icon="menu-down" />}
                  />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                onPress={() => {
                  setFormState(prev => ({...prev, store_id: ''}));
                  setStoreMenuVisible(false);
                }}
                title="No Store (Global)"
              />
              {stores.map(store => (
                <Menu.Item
                  key={store.id}
                  onPress={() => {
                    setFormState(prev => ({...prev, store_id: store.id.toString()}));
                    setStoreMenuVisible(false);
                  }}
                  title={store.name}
                />
              ))}
            </Menu>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Basic Information</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <TextInput
                label="Product Code"
                value={formState.product_code}
                onChangeText={(text) => handleFieldChange('product_code', text)}
                onEndEditing={() => {
                  const { finalPrice } = priceCalculations;
                  setFormState(prev => ({
                    ...prev,
                    barcode: generateBarcode(prev.product_code || generateProductCode(), prev.name, finalPrice)
                  }));
                }}
                style={styles.modalInput}
                placeholder="Auto-generated if empty"
                mode="outlined"
                disabled={isLoading}
              />
            </View>
            <View style={styles.formColumn}>
              <TextInput
                label="Product Name *"
                value={formState.name}
                onChangeText={(text) => handleFieldChange('name', text)}
                onEndEditing={() => {
                  const { finalPrice } = priceCalculations;
                  setFormState(prev => ({
                    ...prev,
                    barcode: generateBarcode(prev.product_code || generateProductCode(), prev.name, finalPrice)
                  }));
                }}
                style={styles.modalInput}
                mode="outlined"
                disabled={isLoading}
                error={!!formErrors.name}
              />
              {formErrors.name && <HelperText type="error" visible>{formErrors.name}</HelperText>}
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <TextInput
                label="Barcode"
                value={formState.barcode}
                style={styles.modalInput}
                mode="outlined"
                editable={false}
                disabled={isLoading}
                right={<TextInput.Icon icon="barcode" />}
              />
            </View>
            <View style={styles.formColumn}>
              <TextInput
                label="HSN Code"
                value={formState.hsn_code}
                onChangeText={(text) => handleFieldChange('hsn_code', text)}
                style={styles.modalInput}
                mode="outlined"
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchor={
                  <TouchableOpacity 
                    onPress={() => setCategoryMenuVisible(true)}
                    style={styles.menuButton}
                    disabled={isLoading}
                  >
                    <TextInput
                      label="Category"
                      value={getCategoryName(formState.category_id)}
                      style={styles.modalInput}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      disabled={isLoading}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                {categories.map(category => (
                  <Menu.Item
                    key={category.id}
                    onPress={() => {
                      setFormState(prev => ({...prev, category_id: category.id.toString()}));
                      setCategoryMenuVisible(false);
                    }}
                    title={category.name}
                  />
                ))}
              </Menu>
            </View>
          </View>

          <TextInput
            label="Description"
            value={formState.description}
            onChangeText={(text) => handleFieldChange('description', text)}
            style={[styles.modalInput, styles.descriptionInput]}
            multiline
            numberOfLines={3}
            mode="outlined"
            disabled={isLoading}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Pricing & Inventory</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <TextInput
                label="MRP *"
                value={formState.mrp}
                onChangeText={(text) => handleFieldChange('mrp', text)}
                onEndEditing={() => {
                  const { finalPrice } = priceCalculations;
                  setFormState(prev => ({
                    ...prev,
                    barcode: generateBarcode(prev.product_code || generateProductCode(), prev.name, finalPrice),
                    sale_rate: priceCalculations.saleRate
                  }));
                }}
                style={styles.modalInput}
                keyboardType="numeric"
                mode="outlined"
                disabled={isLoading}
                error={!!formErrors.mrp}
                left={<TextInput.Affix text="₹" />}
              />
              {formErrors.mrp && <HelperText type="error" visible>{formErrors.mrp}</HelperText>}
            </View>
            <View style={styles.formColumn}>
              <TextInput
                label="Discount (%)"
                value={formState.discount}
                onChangeText={(text) => {
                  const value = text === '' ? '0' : 
                              Math.min(100, Math.max(0, parseFloat(text) || 0)).toString();
                  handleFieldChange('discount', value);
                }}
                onEndEditing={() => {
                  const { finalPrice } = priceCalculations;
                  setFormState(prev => ({
                    ...prev,
                    barcode: generateBarcode(prev.product_code || generateProductCode(), prev.name, finalPrice),
                    sale_rate: priceCalculations.saleRate
                  }));
                }}
                style={styles.modalInput}
                keyboardType="numeric"
                mode="outlined"
                disabled={isLoading}
                error={!!formErrors.discount}
                left={<TextInput.Affix text="%" />}
              />
              {formErrors.discount && <HelperText type="error" visible>{formErrors.discount}</HelperText>}
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <TextInput
                label="Purchase Rate"
                value={formState.purchase_rate}
                onChangeText={(text) => handleFieldChange('purchase_rate', text)}
                style={styles.modalInput}
                keyboardType="numeric"
                mode="outlined"
                disabled={isLoading}
                left={<TextInput.Affix text="₹" />}
              />
            </View>
            <View style={styles.formColumn}>
              <TextInput
                label="Sale Rate"
                value={formState.sale_rate}
                onChangeText={(text) => handleFieldChange('sale_rate', text)}
                style={styles.modalInput}
                keyboardType="numeric"
                mode="outlined"
                disabled={isLoading}
                left={<TextInput.Affix text="₹" />}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <TextInput
                label="Opening Stock"
                value={formState.opening_stock}
                onChangeText={(text) => handleFieldChange('opening_stock', text)}
                style={styles.modalInput}
                keyboardType="numeric"
                mode="outlined"
                disabled={isLoading}
              />
            </View>
          </View>

          {renderPriceSummary()}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Tax & Units</Text>
          
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Menu
                visible={tax1MenuVisible}
                onDismiss={() => setTax1MenuVisible(false)}
                anchor={
                  <TouchableOpacity 
                    onPress={() => setTax1MenuVisible(true)}
                    style={styles.menuButton}
                    disabled={isLoading}
                  >
                    <TextInput
                      label="Tax 1"
                      value={getTaxName(formState.tax1_id, 1)}
                      style={styles.modalInput}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      disabled={isLoading}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setFormState(prev => ({...prev, tax1_id: ''}));
                    setTax1MenuVisible(false);
                  }}
                  title="No Tax"
                />
                {taxes.map(tax => (
                  <Menu.Item
                    key={`tax1-${tax.id}`}
                    onPress={() => {
                      setFormState(prev => ({...prev, tax1_id: tax.id.toString()}));
                      setTax1MenuVisible(false);
                    }}
                    title={`${tax.name} (${tax.rate}%)`}
                    disabled={tax.id.toString() === formState.tax2_id}
                  />
                ))}
              </Menu>
            </View>
            <View style={styles.formColumn}>
              <Menu
                visible={tax2MenuVisible}
                onDismiss={() => setTax2MenuVisible(false)}
                anchor={
                  <TouchableOpacity 
                    onPress={() => setTax2MenuVisible(true)}
                    style={styles.menuButton}
                    disabled={isLoading}
                  >
                    <TextInput
                      label="Tax 2"
                      value={getTaxName(formState.tax2_id, 2)}
                      style={styles.modalInput}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      disabled={isLoading}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setFormState(prev => ({...prev, tax2_id: ''}));
                    setTax2MenuVisible(false);
                  }}
                  title="No Tax"
                />
                {taxes.map(tax => (
                  <Menu.Item
                    key={`tax2-${tax.id}`}
                    onPress={() => {
                      setFormState(prev => ({...prev, tax2_id: tax.id.toString()}));
                      setTax2MenuVisible(false);
                    }}
                    title={`${tax.name} (${tax.rate}%)`}
                    disabled={tax.id.toString() === formState.tax1_id}
                  />
                ))}
              </Menu>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Menu
                visible={taxTypeMenuVisible}
                onDismiss={() => setTaxTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity 
                    onPress={() => setTaxTypeMenuVisible(true)}
                    style={styles.menuButton}
                    disabled={isLoading}
                  >
                    <TextInput
                      label="Tax Type"
                      value={formState.tax_type === 'INCLUSIVE' ? 'Inclusive' : 'Exclusive'}
                      style={styles.modalInput}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      disabled={isLoading}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setFormState(prev => ({...prev, tax_type: 'INCLUSIVE'}));
                    setTaxTypeMenuVisible(false);
                  }}
                  title="Inclusive"
                />
                <Menu.Item
                  onPress={() => {
                    setFormState(prev => ({...prev, tax_type: 'EXCLUSIVE'}));
                    setTaxTypeMenuVisible(false);
                  }}
                  title="Exclusive"
                />
              </Menu>
            </View>
            <View style={styles.formColumn}>
              <Menu
                visible={unitMenuVisible}
                onDismiss={() => setUnitMenuVisible(false)}
                anchor={
                  <TouchableOpacity 
                    onPress={() => setUnitMenuVisible(true)}
                    style={styles.menuButton}
                    disabled={isLoading}
                  >
                    <TextInput
                      label="Unit"
                      value={getUnitName(formState.unit_id)}
                      style={styles.modalInput}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      disabled={isLoading}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                {units.map(unit => (
                  <Menu.Item
                    key={unit.id}
                    onPress={() => {
                      setFormState(prev => ({...prev, unit_id: unit.id.toString()}));
                      setUnitMenuVisible(false);
                    }}
                    title={`${unit.name} (${unit.symbol})`}
                  />
                ))}
              </Menu>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Product Image</Text>
          
          <Button 
            mode="outlined" 
            onPress={pickImage}
            style={styles.imageButton}
            icon="image"
            disabled={isLoading}
            labelStyle={styles.imageButtonLabel}
          >
            {image ? 'Change Image' : 'Select Image'}
          </Button>
          
          {image && (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: image }} 
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </View>
          )}
        </View>

        <View style={styles.formActions}>
          <Button 
            mode="contained" 
            onPress={handleSubmit}
            style={styles.submitButton}
            icon="content-save"
            loading={isLoading}
            disabled={isLoading}
            labelStyle={styles.submitButtonLabel}
          >
            {initialData ? 'Update Product' : 'Save Product'}
          </Button>
          <Button 
            mode="outlined" 
            onPress={onDismiss}
            style={styles.cancelButton}
            icon="cancel"
            disabled={isLoading}
            labelStyle={styles.cancelButtonLabel}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </Modal>
  );
};

const StaffProductManagement = () => {
  const { token, user } = useAuth() as { token: string; user: User | null };
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const enhancedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || JSON.stringify(errorData));
      }

      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }, [token]);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await enhancedFetch('/api/products/');
      const data: Product[] = await response.json();
      
      // Fetch stores if user is admin or if we don't have them yet
      let storesList = stores;
      if (storesList.length === 0) {
        storesList = await enhancedFetch('/api/stores/').then(res => res.json());
        setStores(storesList);
      }

      // Enhance products with store information
      const enhancedProducts = data.map(product => {
        let storeInfo: Store | undefined;
        if (product.store) {
          if (typeof product.store === 'object') {
            storeInfo = product.store;
          } else if (typeof product.store === 'number') {
            storeInfo = storesList.find(s => s.id === product.store);
          }
        }

        return {
          ...product,
          store: storeInfo || product.store,
          tax1_name: product.tax1_name || (product.tax1 ? `${product.tax1.name} (${product.tax1.rate}%)` : undefined),
          tax2_name: product.tax2_name || (product.tax2 ? `${product.tax2.name} (${product.tax2.rate}%)` : undefined),
          mrp: typeof product.mrp === 'string' ? parseFloat(product.mrp) : product.mrp,
          discount: typeof product.discount === 'string' ? parseFloat(product.discount) : product.discount,
          calculated_price: typeof product.calculated_price === 'string' ? 
            parseFloat(product.calculated_price) : 
            product.calculated_price || 0,
          sold_quantity: product.sold_quantity || 0,
        };
      });
      
      setProducts(enhancedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      showSnackbar('Failed to fetch products');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [enhancedFetch, stores]);

  const fetchMasterData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [categoriesRes, taxesRes, unitsRes] = await Promise.all([
        enhancedFetch('/api/master/categories/'),
        enhancedFetch('/api/master/taxes/'),
        enhancedFetch('/api/master/units/'),
      ]);

      setCategories(await categoriesRes.json());
      setTaxes(await taxesRes.json());
      setUnits(await unitsRes.json());
    } catch (error) {
      console.error('Error fetching master data:', error);
      showSnackbar('Failed to fetch master data');
    } finally {
      setIsLoading(false);
    }
  }, [enhancedFetch]);

  useEffect(() => {
    if (token) {
      fetchProducts();
      fetchMasterData();
    }
  }, [token, fetchProducts, fetchMasterData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const openEditModal = useCallback((product: Product) => {
    if (!canModifyProduct(product)) {
      showSnackbar('You do not have permission to edit this product');
      return;
    }
    setEditingProduct(product);
    setModalVisible(true);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setModalVisible(true);
  }, []);

  const handleDeleteClick = useCallback((productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !canModifyProduct(product)) {
      showSnackbar('You do not have permission to delete this product');
      return;
    }
    setProductToDelete(productId);
    setDeleteDialogVisible(true);
  }, [products]);

  const canModifyProduct = (product: Product) => {
    // Staff can modify global products (no store) or products from their own store
    if (!product.store) return true;
    if (!user?.store) return false;
    
    const storeId = typeof product.store === 'object' ? product.store.id : product.store;
    const userStoreId = typeof user.store === 'object' ? user.store.id : user.store;
    return storeId === userStoreId;
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!productToDelete) return;
    
    try {
      setIsLoading(true);
      await enhancedFetch(`/api/products/${productToDelete}/`, {
        method: 'DELETE',
      });

      await fetchProducts();
      showSnackbar('Product deleted successfully');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      showSnackbar(error.message || 'Failed to delete product');
    } finally {
      setIsLoading(false);
      setDeleteDialogVisible(false);
      setProductToDelete(null);
    }
  }, [productToDelete, enhancedFetch, fetchProducts]);

  const handleFormSubmit = async (formData: FormState & { image?: string | null }) => {
    try {
      setIsLoading(true);
      
      const data = new FormData();
      
      // Append all form data
      data.append('product_code', formData.product_code || generateProductCode(products));
      data.append('name', formData.name);
      data.append('hsn_code', formData.hsn_code || '');
      if (formData.category_id) data.append('category', formData.category_id);
      data.append('mrp', formData.mrp);
      data.append('discount', formData.discount || '0');
      data.append('purchase_rate', formData.purchase_rate || '0');
      data.append('sale_rate', formData.sale_rate || formData.mrp);
      if (formData.tax1_id) data.append('tax1', formData.tax1_id);
      if (formData.tax2_id) data.append('tax2', formData.tax2_id);
      data.append('tax_type', formData.tax_type);
      data.append('opening_stock', formData.opening_stock || '0');
      data.append('description', formData.description || '');
      data.append('barcode', formData.barcode);
      if (formData.unit_id) data.append('unit', formData.unit_id);
      
      // Handle store assignment
      if (user?.role === 'STAFF') {
        const userStoreId = typeof user.store === 'object' ? user.store?.id : user.store;
        if (userStoreId) {
          data.append('store', userStoreId.toString());
        }
      } else if (user?.role === 'ADMIN') {
        data.append('store', formData.store_id || '');
      }

      // Handle image upload
      if (formData.image && !formData.image.startsWith('http')) {
        const filename = formData.image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        data.append('image', {
          uri: formData.image,
          name: filename || 'product_image.jpg',
          type: type,
        } as any);
      } else if (editingProduct && !formData.image) {
        data.append('image', '');
      }

      const endpoint = editingProduct 
        ? `/api/products/${editingProduct.id}/`
        : '/api/products/';
      
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || JSON.stringify(errorData));
      }

      setModalVisible(false);
      await fetchProducts();
      showSnackbar(`Product ${editingProduct ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      showSnackbar(error.message || `Failed to ${editingProduct ? 'update' : 'create'} product`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateProductCode = (products: Product[]) => {
    const highestCode = products.reduce((max, product) => {
      const codeNumber = parseInt(product.product_code.split('-').pop() || '0');
      return Math.max(max, codeNumber);
    }, 0);
    
    return `${String(highestCode + 1).padStart(3, '0')}`;
  };

  const calculateProfit = useCallback((product: Product) => {
    const salePrice = product.calculated_price || product.mrp;
    const purchasePrice = product.purchase_rate || 0;
    const soldQuantity = product.sold_quantity || 0;
    
    return (salePrice - purchasePrice) * soldQuantity;
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [products, searchQuery]);

  const getStoreName = useCallback((product: Product) => {
    if (!product.store) return 'Global Product';
    if (typeof product.store === 'object') return product.store.name;
    
    const store = stores.find(s => s.id === product.store);
    return store ? store.name : `Store ${product.store}`;
  }, [stores]);

  const renderProductCard = useCallback((product: Product) => {
    const tax1Name = product.tax1_name || (product.tax1 ? `${product.tax1.name} (${product.tax1.rate}%)` : '');
    const tax2Name = product.tax2_name || (product.tax2 ? `${product.tax2.name} (${product.tax2.rate}%)` : '');
    const finalPrice = product.calculated_price || product.mrp;
    const isEditable = canModifyProduct(product);
    
    return (
      <View key={product.id} style={[
        styles.productCard,
        !isEditable && styles.readOnlyProductCard
      ]}>
        <TouchableOpacity 
          onPress={() => isEditable && openEditModal(product)}
          style={styles.productCardContent}
        >
          {product.image_url ? (
            <Image 
              source={{ uri: product.image_url }} 
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <MaterialIcons name="image" size={24} color="#ccc" />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={styles.productCode}>{product.product_code}</Text>
            
            {product.store ? (
              <Chip 
                mode="outlined" 
                style={styles.storeChip}
                textStyle={styles.storeChipText}
              >
                {getStoreName(product)}
              </Chip>
            ) : (
              <Chip 
                mode="outlined" 
                style={styles.globalChip}
                textStyle={styles.globalChipText}
              >
                Global Product
              </Chip>
            )}
            
            <View style={styles.priceRow}>
              <Text style={styles.productPrice}>
                ₹{product.mrp.toFixed(2)}
              </Text>
              {product.discount > 0 && (
                <Text style={styles.productDiscount}>
                  -{product.discount}%
                </Text>
              )}
            </View>

            <View style={styles.taxInfo}>
              {tax1Name && (
                <Text style={styles.taxText}>
                  {tax1Name}
                </Text>
              )}
              {tax2Name && (
                <Text style={styles.taxText}>
                  {tax2Name}
                </Text>
              )}
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.finalPrice}>
                Final: ₹{finalPrice.toFixed(2)}
              </Text>
            </View>

           
          </View>
        </TouchableOpacity>
        
        {isEditable && (
          <View style={styles.productActions}>
            <TouchableOpacity 
              onPress={() => openEditModal(product)}
              style={styles.actionButton}
            >
              <MaterialIcons name="edit" size={20} color="#6200ee" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleDeleteClick(product.id)}
              style={styles.actionButton}
            >
              <MaterialIcons name="delete" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [openEditModal, calculateProfit, handleDeleteClick, getStoreName]);

  const userStoreId = user ? (typeof user.store === 'object' ? user.store?.id : user.store) : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Staff Product Management</Text>
            <Text style={styles.headerSubtitle}>
              {products.length} products available
            </Text>
          </View>
          {userStoreId && (
            <TouchableOpacity 
              onPress={openAddModal}
              style={styles.addButton}
              disabled={isLoading}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          mode="outlined"
          outlineColor="#e0e0e0"
          activeOutlineColor="#6a11cb"
          left={<TextInput.Icon icon="magnify" color="#888" />}
          right={
            searchQuery ? (
              <TextInput.Icon 
                icon="close" 
                color="#888" 
                onPress={() => setSearchQuery('')} 
              />
            ) : null
          }
        />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator 
            animating={true} 
            size="large" 
            color="#6a11cb" 
          />
          <Text style={styles.loaderText}>Loading products...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={['#6a11cb']}
            />
          }
        >
          {filteredProducts.length > 0 ? (
            <View style={styles.productsGrid}>
              {filteredProducts.map(renderProductCard)}
            </View>
          ) : (
            <View style={styles.noProductsContainer}>
              <MaterialIcons name="inventory" size={48} color="#ccc" />
              <Text style={styles.noProductsText}>
                {searchQuery ? 'No matching products found' : 'No products available'}
              </Text>
              {userStoreId && (
                <Button 
                  mode="contained" 
                  onPress={openAddModal}
                  style={styles.addFirstButton}
                  labelStyle={styles.addFirstButtonLabel}
                  icon="plus"
                >
                  Add Your First Product
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      )}

      <ProductForm
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onSubmit={handleFormSubmit}
        initialData={editingProduct}
        categories={categories}
        taxes={taxes}
        units={units}
        stores={stores}
        isLoading={isLoading}
        user={user}
        products={products}
      />

      <Portal>
        <Dialog 
          visible={deleteDialogVisible} 
          onDismiss={() => setDeleteDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>Are you sure you want to delete this product? This action cannot be undone.</Text>
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
              onPress={handleDeleteConfirm} 
              style={styles.dialogDeleteButton}
              labelStyle={styles.dialogButtonLabel}
              loading={isLoading}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

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
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 10,
    color: '#666',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  readOnlyProductCard: {
    opacity: 0.9,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  productCardContent: {
    padding: 12,
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  productInfo: {
    paddingHorizontal: 5,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  storeChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderColor: '#BBDEFB',
  },
  storeChipText: {
    fontSize: 10,
    color: '#1976D2',
  },
  globalChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderColor: '#C8E6C9',
  },
  globalChipText: {
    fontSize: 10,
    color: '#2E7D32',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6a11cb',
  },
  productDiscount: {
    fontSize: 12,
    color: '#f44336',
  },
  taxInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  taxText: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
  },
  finalPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  salesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  salesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  salesText: {
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 4,
  },
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profitText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 4,
  },
  productActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noProductsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProductsText: {
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
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  modalContent: {
    padding: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 5,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  formColumn: {
    flex: 1,
  },
  modalInput: {
    backgroundColor: 'white',
  },
  descriptionInput: {
    minHeight: 80,
  },
  menuButton: {
    flex: 1,
  },
  imageButton: {
    marginBottom: 12,
    borderColor: '#6a11cb',
  },
  imageButtonLabel: {
    color: '#6a11cb',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  priceSummaryContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceSummaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  finalPriceRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 6,
    marginTop: 4,
  },
  finalPriceLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  finalPriceValue: {
    fontWeight: 'bold',
    color: '#6a11cb',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#6a11cb',
  },
  submitButtonLabel: {
    color: 'white',
  },
  cancelButton: {
    flex: 1,
    borderColor: '#6a11cb',
  },
  cancelButtonLabel: {
    color: '#6a11cb',
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
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
  },
  dialogCancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  dialogDeleteButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
  },
  dialogButtonLabel: {
    color: 'white',
    fontWeight: '500',
  },
  snackbar: {
    backgroundColor: '#323232',
    marginBottom: 20,
  },
});

export default StaffProductManagement;