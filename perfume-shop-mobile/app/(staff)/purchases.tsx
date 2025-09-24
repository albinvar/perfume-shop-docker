import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { 
  DataTable, 
  Button, 
  TextInput, 
  Modal, 
  Portal, 
  Dialog, 
  Card, 
  Title,
  Searchbar,
  List,
  Menu,
  Chip,
  HelperText,
  Divider
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Animatable from 'react-native-animatable';

interface Supplier {
  id: number;
  name: string;
  gstin: string;
  contact_no: string;
  city: string;
  address: string;
  current_balance: number;
}

interface Tax {
  id?: number;
  name?: string;
  rate?: number;
}

interface Product {
  id: number;
  product_code: string;
  name: string;
  purchase_rate: number;
  tax_type: 'INCLUSIVE' | 'EXCLUSIVE';
  tax1?: Tax;
  tax2?: Tax;
  tax1_name?: string;
  tax2_name?: string;
  stock: number;
  hsn_code?: string;
  barcode?: string;
}

interface PurchaseItem {
  id?: number;
  product_id: number;
  product: Product;
  quantity: number;
  rate: number;
  tax_amount: number;
  amount: number;
  tax1_rate?: number;
  tax2_rate?: number;
  tax1_name?: string;
  tax2_name?: string;
  returned_quantity?: number;
  can_return?: boolean;
  remaining_qty?: number;
}

interface Store {
  id: number;
  name: string;
}

interface Purchase {
  id?: number;
  invoice_no: string;
  date: string;
  payment_type: 'cash' | 'credit';
  status?: 'draft' | 'completed' | 'returned';
  supplier?: Supplier | null;
  items: PurchaseItem[];
  supplier_invoice_no?: string;
  supplier_invoice_date?: string;
  remarks?: string;
  store?: Store;
  created_by?: { id: number; username: string };
  is_return?: boolean;
  return_reference?: Purchase | null;
  return_reference_invoice?: string;
  can_return?: boolean;
}

const PurchaseEntryScreen = () => {
  const { id } = useLocalSearchParams();
  const isEditMode = !!id;
  const { user, fetchWithAuth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [purchase, setPurchase] = useState<Purchase>({
    invoice_no: '',
    date: new Date().toISOString().split('T')[0],
    payment_type: 'cash',
    supplier: null,
    items: [],
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReturnItemModal, setShowReturnItemModal] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [rate, setRate] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSupplierDatePicker, setShowSupplierDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dateError, setDateError] = useState('');
  const [supplierDateError, setSupplierDateError] = useState('');
  const [returnablePurchases, setReturnablePurchases] = useState<Purchase[]>([]);
  const [selectedReturnPurchase, setSelectedReturnPurchase] = useState<Purchase | null>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<{[key: number]: string}>({});
  
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;

  // Helper functions
  const toNumber = (value: number | string): number => {
    if (typeof value === 'string') {
      const numStr = value.replace(/[^0-9.]/g, '');
      return parseFloat(numStr) || 0;
    }
    return value || 0;
  };

  const formatCurrency = (value: number | string): string => {
    const num = toNumber(value);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const validateDate = (dateString: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  const handleDateChange = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setPurchase(prev => ({ ...prev, date: dateString }));
    setDateError('');
  };

  const handleSupplierDateChange = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    setPurchase(prev => ({ ...prev, supplier_invoice_date: dateString }));
    setSupplierDateError('');
  };

  const extractTaxRate = (tax: Tax | undefined, taxName: string | undefined): number => {
    if (tax?.rate) return tax.rate;
    if (taxName) {
      const match = taxName.match(/\((\d+\.?\d*)%\)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return 0;
  };

  const formatTaxDisplay = (tax: Tax | undefined, taxName: string | undefined): string => {
    if (tax?.name && tax.rate !== undefined) return `${tax.name} (${tax.rate}%)`;
    if (taxName) {
      if (taxName.includes('(') && taxName.includes('%)')) {
        return taxName;
      }
      const rateMatch = taxName.match(/(\d+\.?\d*)%?/);
      const rate = rateMatch ? rateMatch[1] : '0';
      const nameMatch = taxName.match(/^([^(]+)/);
      const name = nameMatch ? nameMatch[0].trim() : 'Tax';
      return `${name} (${rate}%)`;
    }
    return 'No Tax';
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch store details
        if (user?.store) {
          const storeResponse = await fetchWithAuth(`/api/stores/${user.store}/`);
          if (storeResponse.ok) {
            const storeData = await storeResponse.json();
            setStore(storeData);
          }
        }

        // Fetch suppliers
        const suppliersResponse = await fetchWithAuth('/api/supplier/suppliers/');
        if (suppliersResponse.ok) {
          const suppliersData = await suppliersResponse.json();
          setSuppliers(suppliersData);
        }

        // Fetch products
        const productsResponse = await fetchWithAuth('/api/products/?expand=tax1,tax2');
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const processedProducts = productsData.map((product: Product) => {
            const tax1Name = formatTaxDisplay(product.tax1, product.tax1_name);
            const tax2Name = formatTaxDisplay(product.tax2, product.tax2_name);
            
            return {
              ...product,
              tax1_name: tax1Name,
              tax2_name: tax2Name,
              purchase_rate: toNumber(product.purchase_rate),
              stock: toNumber(product.stock)
            };
          });
          
          setProducts(processedProducts);
          setFilteredProducts(processedProducts);
        }

        // If in edit mode, fetch the existing purchase
        if (isEditMode) {
          const purchaseResponse = await fetchWithAuth(`/api/purchases/${id}/`);
          if (purchaseResponse.ok) {
            const purchaseData = await purchaseResponse.json();
            setPurchase({
              ...purchaseData,
              supplier: purchaseData.supplier || null,
              date: purchaseData.date || new Date().toISOString().split('T')[0],
              items: purchaseData.items.map((item: any) => ({
                ...item,
                tax1_name: formatTaxDisplay(item.product?.tax1, item.product?.tax1_name),
                tax2_name: formatTaxDisplay(item.product?.tax2, item.product?.tax2_name),
                tax1_rate: extractTaxRate(item.product?.tax1, item.product?.tax1_name),
                tax2_rate: extractTaxRate(item.product?.tax2, item.product?.tax2_name)
              }))
            });
            setShowForm(true);
          } else {
            throw new Error('Failed to fetch purchase data');
          }
        } else {
          // For new purchase, fetch next invoice number
          const invoiceResponse = await fetchWithAuth('/api/purchases/next_invoice_number/');
          if (invoiceResponse.ok) {
            const invoiceData = await invoiceResponse.json();
            setPurchase(prev => ({ 
              ...prev, 
              invoice_no: invoiceData.invoice_no,
              date: new Date().toISOString().split('T')[0]
            }));
          }
        }

        // Fetch purchases list
        await fetchPurchases();

      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load required data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.store]);

  const fetchPurchases = async () => {
    try {
      setRefreshing(true);
      const response = await fetchWithAuth(`/api/purchases/?store=${user?.store}&expand=supplier,items.product,created_by,return_reference`);
      
      if (response.ok) {
        const data = await response.json();
        const processedData = data.map((purchase: Purchase) => ({
          ...purchase,
          supplier: purchase.supplier || null,
          items: purchase.items.map((item: any) => ({
            ...item,
            tax1_name: formatTaxDisplay(item.product?.tax1, item.product?.tax1_name),
            tax2_name: formatTaxDisplay(item.product?.tax2, item.product?.tax2_name)
          }))
        }));
        setPurchases(processedData);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
      Alert.alert('Error', 'Could not load purchases history');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchReturnablePurchases = async () => {
    try {
      const response = await fetchWithAuth('/api/purchases/returnable_purchases/');
      if (response.ok) {
        const data = await response.json();
        setReturnablePurchases(data);
      }
    } catch (error) {
      console.error('Failed to fetch returnable purchases:', error);
    }
  };

  const fetchReturnableItems = async (purchaseId: number) => {
    try {
      const response = await fetchWithAuth(`/api/purchases/${purchaseId}/returnable_items/`);
      if (response.ok) {
        const data = await response.json();
        setReturnItems(data);
        // Initialize quantities with remaining quantities
        const quantities: {[key: number]: string} = {};
        data.forEach((item: any) => {
          quantities[item.id] = item.remaining_quantity.toString();
        });
        setReturnQuantities(quantities);
      }
    } catch (error) {
      console.error('Failed to fetch returnable items:', error);
    }
  };

  // Product search
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p => 
          p?.name?.toLowerCase().includes(query) || 
          p?.product_code?.toLowerCase().includes(query) ||
          p?.hsn_code?.toLowerCase().includes(query) ||
          p?.barcode?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, products]);

  // Purchase item management
  const calculateItemAmount = (qty: number, itemRate: number, product: Product) => {
    let amount = qty * itemRate;
    let taxAmount = 0;
    
    const tax1Rate = extractTaxRate(product.tax1, product.tax1_name);
    const tax2Rate = extractTaxRate(product.tax2, product.tax2_name);
    
    if (product.tax_type === 'EXCLUSIVE') {
      const tax1 = (amount * tax1Rate) / 100;
      const tax2 = (amount * tax2Rate) / 100;
      
      taxAmount = tax1 + tax2;
      amount += taxAmount;
    }
    
    return { 
      amount, 
      taxAmount,
      tax1Rate,
      tax2Rate,
      tax1Name: formatTaxDisplay(product.tax1, product.tax1_name),
      tax2Name: formatTaxDisplay(product.tax2, product.tax2_name)
    };
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Please select a product');
      return;
    }
    
    const qty = toNumber(quantity);
    const itemRate = toNumber(rate) || selectedProduct.purchase_rate;

    if (isNaN(qty)) {
      Alert.alert('Error', 'Quantity must be a number');
      return;
    }

    if (qty <= 0) {
      Alert.alert('Error', 'Quantity must be greater than 0');
      return;
    }
    
    if (isNaN(itemRate)) {
      Alert.alert('Error', 'Rate must be a number');
      return;
    }
    if (itemRate <= 0) {
      Alert.alert('Error', 'Rate must be greater than 0');
      return;
    }

    const { 
      amount, 
      taxAmount,
      tax1Rate,
      tax2Rate,
      tax1Name,
      tax2Name
    } = calculateItemAmount(qty, itemRate, selectedProduct);
    
    const existingItemIndex = purchase.items.findIndex(i => i.product_id === selectedProduct.id);

    if (existingItemIndex >= 0) {
      const updatedItems = [...purchase.items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: qty,
        rate: itemRate,
        tax_amount: taxAmount,
        amount: amount,
        tax1_rate: tax1Rate,
        tax2_rate: tax2Rate,
        tax1_name: tax1Name,
        tax2_name: tax2Name
      };
      setPurchase(prev => ({ ...prev, items: updatedItems }));
    } else {
      const newItem: PurchaseItem = {
        product_id: selectedProduct.id,
        product: selectedProduct,
        quantity: qty,
        rate: itemRate,
        tax_amount: taxAmount,
        amount: amount,
        tax1_rate: tax1Rate,
        tax2_rate: tax2Rate,
        tax1_name: tax1Name,
        tax2_name: tax2Name
      };
      setPurchase(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }

    setSelectedProduct(null);
    setQuantity('1');
    setRate('');
    setShowProductModal(false);
  };

  const handleRemoveItem = (index: number) => {
    setItemToDelete(index);
    setShowDeleteDialog(true);
  };

  const confirmRemoveItem = () => {
    if (itemToDelete !== null) {
      const newItems = [...purchase.items];
      newItems.splice(itemToDelete, 1);
      setPurchase(prev => ({ ...prev, items: newItems }));
    }
    setShowDeleteDialog(false);
    setItemToDelete(null);
  };

  // Purchase submission
  const validatePurchase = () => {
    if (!purchase.supplier) {
      Alert.alert('Error', 'Please select a supplier');
      return false;
    }
    
    if (purchase.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return false;
    }

    if (!validateDate(purchase.date)) {
      setDateError('Invalid date format. Use YYYY-MM-DD');
      return false;
    }

    if (purchase.supplier_invoice_date && !validateDate(purchase.supplier_invoice_date)) {
      setSupplierDateError('Invalid date format. Use YYYY-MM-DD');
      return false;
    }

    return true;
  };

  const calculateTotals = () => {
    return purchase.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleSubmit = async () => {
    if (!validatePurchase()) return;

    try {
      setIsSubmitting(true);
      
      const totalAmount = calculateTotals();

      const purchaseData = {
        invoice_no: purchase.invoice_no,
        date: purchase.date,
        payment_type: purchase.payment_type,
        supplier_id: purchase.supplier?.id,
        store: user?.store,
        supplier_invoice_no: purchase.supplier_invoice_no || null,
        supplier_invoice_date: purchase.supplier_invoice_date || null,
        remarks: purchase.remarks || null,
        items: purchase.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          rate: item.rate
        }))
      };

      let response;
      if (isEditMode) {
        response = await fetchWithAuth(`/api/purchases/${id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(purchaseData)
        });
      } else {
        response = await fetchWithAuth('/api/purchases/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(purchaseData)
        });
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || responseData.message || 'Failed to save purchase');
      }

      Alert.alert('Success', `Purchase ${isEditMode ? 'updated' : 'created'} successfully`);
      resetForm();
      fetchPurchases();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Purchase submission error:', error);
        Alert.alert('Error', error.message || 'Failed to save purchase');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedReturnPurchase) return;
    
    try {
      setIsSubmitting(true);
      
      // Prepare return items
      const items = returnItems
        .filter(item => returnQuantities[item.id] && parseFloat(returnQuantities[item.id]) > 0)
        .map(item => ({
          product_id: item.product_id,
          quantity: parseFloat(returnQuantities[item.id]),
          rate: item.rate
        }));
      
      if (items.length === 0) {
        Alert.alert('Error', 'Please select at least one item to return');
        return;
      }

      const returnData = {
        date: new Date().toISOString().split('T')[0],
        payment_type: selectedReturnPurchase.payment_type,
        return_reference_id: selectedReturnPurchase.id,
        remarks: `Return for ${selectedReturnPurchase.invoice_no}`,
        items: items
      };

      const response = await fetchWithAuth('/api/purchases/create_return/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(returnData)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || responseData.message || 'Failed to create return');
      }

      Alert.alert('Success', 'Purchase return created successfully');
      setShowReturnModal(false);
      setShowReturnItemModal(false);
      setSelectedReturnPurchase(null);
      setReturnItems([]);
      setReturnQuantities({});
      fetchPurchases();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Return submission error:', error);
        Alert.alert('Error', error.message || 'Failed to create return');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPurchase({
      invoice_no: '',
      date: new Date().toISOString().split('T')[0],
      payment_type: 'cash',
      supplier: null,
      items: [],
    });
    setSelectedProduct(null);
    setQuantity('1');
    setRate('');
    setShowForm(false);
    fetchPurchases();
  };

  const startNewPurchase = async () => {
    try {
      setLoading(true);
      const invoiceResponse = await fetchWithAuth('/api/purchases/next_invoice_number/');
      if (invoiceResponse.ok) {
        const invoiceData = await invoiceResponse.json();
        setPurchase({
          invoice_no: invoiceData.invoice_no,
          date: new Date().toISOString().split('T')[0],
          payment_type: 'cash',
          supplier: null,
          items: [],
        });
        setShowForm(true);
      }
    } catch (error) {
      console.error('Error starting new purchase:', error);
      Alert.alert('Error', 'Failed to start new purchase');
    } finally {
      setLoading(false);
    }
  };

  const startNewReturn = async () => {
    try {
      setLoading(true);
      await fetchReturnablePurchases();
      setShowReturnModal(true);
    } catch (error) {
      console.error('Error starting return:', error);
      Alert.alert('Error', 'Failed to start return process');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReturnPurchase = (purchase: Purchase) => {
    setSelectedReturnPurchase(purchase);
    fetchReturnableItems(purchase.id!);
    setShowReturnModal(false);
    setShowReturnItemModal(true);
  };

  const handleReturnQuantityChange = (itemId: number, value: string) => {
    setReturnQuantities(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  // Purchase management
  const handleEditPurchase = (purchaseData: Purchase) => {
    setPurchase({
      ...purchaseData,
      supplier: purchaseData.supplier || null,
      items: purchaseData.items.map(item => ({
        ...item,
        tax1_name: formatTaxDisplay(item.product?.tax1, item.product?.tax1_name),
        tax2_name: formatTaxDisplay(item.product?.tax2, item.product?.tax2_name)
      }))
    });
    setShowForm(true);
  };

  const confirmDeletePurchase = (purchaseId: number) => {
    setPurchaseToDelete(purchaseId);
    setDeleteModalVisible(true);
  };

  const handleDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/purchases/${purchaseToDelete}/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        Alert.alert('Success', 'Purchase deleted successfully');
        fetchPurchases();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Delete purchase error:', error);
        Alert.alert('Error', 'Failed to delete purchase');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setDeleteModalVisible(false);
      setPurchaseToDelete(null);
    }
  };

  const renderProductDetails = (product: Product) => {
    return (
      <Card style={styles.productDetailsCard}>
        <Card.Content>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCode}>{product.product_code}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>HSN Code:</Text>
            <Text style={styles.productInfoValue}>{product.hsn_code || 'N/A'}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Barcode:</Text>
            <Text style={styles.productInfoValue}>{product.barcode || 'N/A'}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Current Rate:</Text>
            <Text style={styles.productInfoValue}>{formatCurrency(product.purchase_rate)}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Stock:</Text>
            <Text style={styles.productInfoValue}>{product.stock}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax 1:</Text>
            <Text style={styles.productInfoValue}>
              {formatTaxDisplay(product.tax1, product.tax1_name)}
            </Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax 2:</Text>
            <Text style={styles.productInfoValue}>
              {formatTaxDisplay(product.tax2, product.tax2_name)}
            </Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax Type:</Text>
            <Text style={styles.productInfoValue}>
              {product.tax_type === 'INCLUSIVE' ? 'Inclusive' : 'Exclusive'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPurchaseItem = (item: PurchaseItem, index: number) => {
    return (
      <View key={index} style={styles.mobileItemContainer}>
        <View style={styles.mobileItemHeader}>
          <Text style={styles.mobileProductName} numberOfLines={1}>
            {item.product?.name || 'Unknown Product'}
          </Text>
          <Text style={styles.mobileProductAmount}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
        
        <View style={styles.mobileItemDetails}>
          <Text style={styles.mobileDetailText}>
            Qty: {item.quantity} @ {formatCurrency(item.rate)}
          </Text>
          <TouchableOpacity onPress={() => handleRemoveItem(index)}>
            <MaterialIcons name="delete" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
        
        {item.tax1_name && (
          <Text style={styles.mobileTaxText}>
            {item.tax1_name} {item.tax2_name ? `+ ${item.tax2_name}` : ''}
          </Text>
        )}
      </View>
    );
  };

  const renderReturnItem = (item: any) => {
    return (
      <Card key={item.id} style={styles.returnItemCard}>
        <Card.Content>
          <View style={styles.returnItemHeader}>
            <Text style={styles.returnItemName}>{item.product_name}</Text>
            <Text style={styles.returnItemCode}>{item.product_code}</Text>
          </View>
          
          <View style={styles.returnItemInfo}>
            <Text style={styles.returnItemLabel}>Original Qty:</Text>
            <Text style={styles.returnItemValue}>{item.original_quantity}</Text>
          </View>
          
          <View style={styles.returnItemInfo}>
            <Text style={styles.returnItemLabel}>Already Returned:</Text>
            <Text style={styles.returnItemValue}>{item.returned_quantity}</Text>
          </View>
          
          <View style={styles.returnItemInfo}>
            <Text style={styles.returnItemLabel}>Remaining:</Text>
            <Text style={styles.returnItemValue}>{item.remaining_quantity}</Text>
          </View>
          
          <View style={styles.returnItemInfo}>
            <Text style={styles.returnItemLabel}>Rate:</Text>
            <Text style={styles.returnItemValue}>{formatCurrency(item.rate)}</Text>
          </View>
          
          <TextInput
            label="Return Quantity"
            value={returnQuantities[item.id] || ''}
            onChangeText={(text) => handleReturnQuantityChange(item.id, text)}
            keyboardType="numeric"
            mode="outlined"
            style={styles.returnQuantityInput}
            error={parseFloat(returnQuantities[item.id] || '0') > item.remaining_quantity}
          />
          
          {parseFloat(returnQuantities[item.id] || '0') > item.remaining_quantity && (
            <HelperText type="error" visible={true}>
              Cannot return more than remaining quantity
            </HelperText>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPurchaseForm = () => {
    return (
      <>
        {/* Store Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          {store ? (
            <View style={styles.storeCard}>
              <Text style={styles.storeName}>{store.name}</Text>
            </View>
          ) : (
            <Text style={styles.noStoreText}>No store assigned to your account</Text>
          )}
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.row}>
            <TextInput
              label="Invoice No"
              value={purchase.invoice_no}
              style={styles.input}
              mode="outlined"
              disabled
            />
          </View>
          
          <View style={styles.row}>
            <View style={styles.dateInputContainer}>
              <TextInput
                label="Invoice Date *"
                value={purchase.date}
                onChangeText={(text) => {
                  setPurchase(prev => ({ ...prev, date: text }));
                  setDateError('');
                }}
                style={styles.input}
                mode="outlined"
                placeholder="YYYY-MM-DD"
                error={!!dateError}
              />
              <HelperText type="error" visible={!!dateError}>
                {dateError}
              </HelperText>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialIcons name="date-range" size={24} color="#6200ee" />
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(purchase.date)}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    handleDateChange(selectedDate);
                  }
                }}
              />
            )}
          </View>
          
          <View style={styles.row}>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={purchase.payment_type}
                onValueChange={(value) => setPurchase(prev => ({ ...prev, payment_type: value }))}
                style={styles.picker}
              >
                <Picker.Item label="Cash" value="cash" />
                <Picker.Item label="Credit" value="credit" />
              </Picker>
            </View>
          </View>
          
          <View style={styles.row}>
            <TextInput
              label="Supplier Invoice No"
              value={purchase.supplier_invoice_no || ''}
              onChangeText={(text) => setPurchase(prev => ({ ...prev, supplier_invoice_no: text }))}
              style={styles.input}
              mode="outlined"
            />
          </View>
          
          <View style={styles.row}>
            <View style={styles.dateInputContainer}>
              <TextInput
                label="Supplier Invoice Date"
                value={purchase.supplier_invoice_date || ''}
                onChangeText={(text) => {
                  setPurchase(prev => ({ ...prev, supplier_invoice_date: text }));
                  setSupplierDateError('');
                }}
                style={styles.input}
                mode="outlined"
                placeholder="YYYY-MM-DD"
                error={!!supplierDateError}
              />
              <HelperText type="error" visible={!!supplierDateError}>
                {supplierDateError}
              </HelperText>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowSupplierDatePicker(true)}
              >
                <MaterialIcons name="date-range" size={24} color="#6200ee" />
              </TouchableOpacity>
            </View>
            {showSupplierDatePicker && (
              <DateTimePicker
                value={purchase.supplier_invoice_date ? 
                  new Date(purchase.supplier_invoice_date) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowSupplierDatePicker(false);
                  if (selectedDate) {
                    handleSupplierDateChange(selectedDate);
                  }
                }}
              />
            )}
          </View>
        </View>
        
        {/* Supplier Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supplier Information</Text>
          
          {purchase.supplier ? (
            <Card style={styles.supplierCard}>
              <Card.Content>
                <View style={styles.supplierHeader}>
                  <Text style={styles.supplierName}>{purchase.supplier.name}</Text>
                  <Chip 
                    mode="outlined" 
                    style={styles.balanceChip}
                    textStyle={styles.balanceChipText}
                  >
                    Balance: {formatCurrency(purchase.supplier.current_balance)}
                  </Chip>
                </View>
                
                <View style={styles.supplierInfoRow}>
                  <Text style={styles.supplierInfoLabel}>GSTIN:</Text>
                  <Text style={styles.supplierInfoValue}>{purchase.supplier.gstin || 'N/A'}</Text>
                </View>
                
                <View style={styles.supplierInfoRow}>
                  <Text style={styles.supplierInfoLabel}>Contact:</Text>
                  <Text style={styles.supplierInfoValue}>{purchase.supplier.contact_no}</Text>
                </View>
                
                <View style={styles.supplierInfoRow}>
                  <Text style={styles.supplierInfoLabel}>Address:</Text>
                  <Text style={styles.supplierInfoValue}>{purchase.supplier.address}</Text>
                </View>
              </Card.Content>
              <Card.Actions>
                <Button 
                  mode="outlined" 
                  onPress={() => setShowSupplierModal(true)}
                  style={styles.changeButton}
                >
                  Change Supplier
                </Button>
              </Card.Actions>
            </Card>
          ) : (
            <Button 
              mode="contained" 
              onPress={() => setShowSupplierModal(true)}
              style={styles.selectButton}
            >
              Select Supplier
            </Button>
          )}
        </View>
        
        {/* Products Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products</Text>
          
          <Searchbar
            placeholder="Search products by name, code, HSN or barcode..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
          
          <Button 
            mode="contained" 
            onPress={() => setShowProductModal(true)}
            style={styles.addButton}
            icon="plus"
          >
            Add Product
          </Button>
          
          {purchase.items.length > 0 ? (
            <View style={styles.itemsContainer}>
              {purchase.items.map((item, index) => renderPurchaseItem(item, index))}
              
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(purchase.items.reduce((sum, item) => sum + item.amount, 0))}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noItemsText}>No products added yet</Text>
          )}
        </View>
        
        {/* Remarks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remarks</Text>
          <TextInput
            label="Remarks"
            value={purchase.remarks || ''}
            onChangeText={(text) => setPurchase(prev => ({ ...prev, remarks: text }))}
            style={styles.remarksInput}
            mode="outlined"
            multiline
            numberOfLines={3}
          />
        </View>
        
        {/* Submit Button */}
        <Button 
          mode="contained" 
          onPress={handleSubmit}
          style={styles.submitButton}
          loading={isSubmitting}
          disabled={isSubmitting || !store}
        >
          {isEditMode ? 'Update Purchase' : 'Save Purchase'}
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={resetForm}
          style={styles.cancelButton}
        >
          Cancel
        </Button>
      </>
    );
  };

  const renderPurchasesList = () => {
    if (loading && purchases.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6a11cb" />
          <Text style={styles.loadingText}>Loading purchases...</Text>
        </View>
      );
    }

    if (purchases.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="receipt" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>No purchases found</Text>
          <Text style={styles.emptySubtext}>Start by creating a new purchase</Text>
        </View>
      );
    }

    return (
      <List.Section>
        {purchases.map((purchaseItem) => (
          <Animatable.View 
            key={purchaseItem.id}
            animation="fadeInUp"
            duration={300}
          >
            <Card style={styles.purchaseCard}>
              <Card.Content>
                <View style={styles.purchaseHeader}>
                  <View>
                    <Text style={styles.invoiceText}>{purchaseItem.invoice_no}</Text>
                    <Text style={styles.purchaseDate}>
                      {formatDate(purchaseItem.date)}
                    </Text>
                    {purchaseItem.supplier && (
                      <Text style={styles.supplierText}>
                        {purchaseItem.supplier.name}
                      </Text>
                    )}
                    <Text style={styles.createdByText}>
                      Created by: {purchaseItem.created_by?.username || 'System'}
                    </Text>
                    {purchaseItem.is_return && purchaseItem.return_reference_invoice && (
                      <Text style={styles.returnReferenceText}>
                        Return for: {purchaseItem.return_reference_invoice}
                      </Text>
                    )}
                    {purchaseItem.status === 'returned' && (
                      <Chip 
                        mode="outlined" 
                        style={styles.returnedChip}
                        textStyle={styles.returnedChipText}
                      >
                        Returned
                      </Chip>
                    )}
                  </View>
                  <View style={styles.purchaseAmountContainer}>
                    <Text style={[
                      styles.purchaseAmount,
                      purchaseItem.is_return ? styles.returnAmount : null
                    ]}>
                      {formatCurrency(purchaseItem.items?.reduce((sum, item) => sum + (item?.amount || 0), 0) || 0)}
                    </Text>
                    <Text style={styles.purchaseItems}>
                      {purchaseItem.items?.length || 0} {purchaseItem.items?.length === 1 ? 'item' : 'items'}
                    </Text>
                    <Text style={styles.paymentType}>
                      {purchaseItem.payment_type === 'cash' ? 'Cash' : 'Credit'}
                    </Text>
                  </View>
                </View>
              </Card.Content>
              <Card.Actions style={styles.cardActions}>
                {!purchaseItem.is_return && purchaseItem.can_return && (
                  <Button 
                    mode="text" 
                    onPress={() => {
                      setSelectedReturnPurchase(purchaseItem);
                      fetchReturnableItems(purchaseItem.id!);
                      setShowReturnItemModal(true);
                    }}
                    textColor="#FF9800"
                    icon="reply"
                  >
                    Return
                  </Button>
                )}
                <Button 
                  mode="text" 
                  onPress={() => handleEditPurchase(purchaseItem)}
                  textColor="#6a11cb"
                  icon="pencil"
                  style={styles.actionButton}
                >
                  Edit
                </Button>
                <Button 
                  mode="text" 
                  onPress={() => confirmDeletePurchase(purchaseItem.id!)}
                  textColor="#f44336"
                  icon="delete"
                  style={styles.actionButton}
                >
                  Delete
                </Button>
              </Card.Actions>
            </Card>
          </Animatable.View>
        ))}
      </List.Section>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {showForm ? 
              (isEditMode ? 'Edit Purchase' : 'New Purchase') : 
              'Purchase History'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {showForm ? `Invoice: ${purchase.invoice_no}` : `${purchases.length} purchases`}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={fetchPurchases}
            colors={['#6a11cb']}
            tintColor="#6a11cb"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Delete Confirmation Dialog */}
        <Portal>
          <Dialog 
            visible={deleteModalVisible} 
            onDismiss={() => setDeleteModalVisible(false)}
            style={styles.dialog}
          >
            <Dialog.Title>Confirm Delete</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to delete this purchase? This action cannot be undone.</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteModalVisible(false)}>Cancel</Button>
              <Button onPress={handleDeletePurchase} style={styles.deleteButton}>
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Item Delete Confirmation Dialog */}
        <Portal>
          <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
            <Dialog.Title>Confirm Delete</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to remove this item?</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button onPress={confirmRemoveItem} style={styles.deleteButton}>
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {showForm ? (
          renderPurchaseForm()
        ) : (
          <>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Purchase History</Text>
              <View style={styles.buttonGroup}>
                <Animatable.View animation="pulse" iterationCount="infinite">
                  <TouchableOpacity 
                    style={styles.newButton}
                    onPress={startNewPurchase}
                  >
                    <MaterialIcons name="add" size={24} color="#FFF" />
                    <Text style={styles.newButtonText}>New Purchase</Text>
                  </TouchableOpacity>
                </Animatable.View>
                <Animatable.View animation="pulse" iterationCount="infinite">
                  <TouchableOpacity 
                    style={styles.returnButton}
                    onPress={startNewReturn}
                  >
                    <Ionicons name="return-down-back" size={24} color="#FFF" />
                    <Text style={styles.returnButtonText}>New Return</Text>
                  </TouchableOpacity>
                </Animatable.View>
              </View>
            </View>

            {renderPurchasesList()}
          </>
        )}

        {/* Supplier Selection Modal */}
        <Portal>
          <Modal 
            visible={showSupplierModal} 
            onDismiss={() => setShowSupplierModal(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Supplier</Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {suppliers.map(supplier => (
                <TouchableOpacity
                  key={supplier.id}
                  onPress={() => {
                    setPurchase(prev => ({ ...prev, supplier }));
                    setShowSupplierModal(false);
                  }}
                  style={styles.supplierItem}
                >
                  <Text style={styles.supplierItemName}>{supplier.name}</Text>
                  <Text style={styles.supplierItemDetail}>GSTIN: {supplier.gstin || 'N/A'}</Text>
                  <Text style={styles.supplierItemDetail}>Balance: {formatCurrency(supplier.current_balance)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Button 
              mode="outlined" 
              onPress={() => setShowSupplierModal(false)}
              style={styles.modalCloseButton}
            >
              Cancel
            </Button>
          </Modal>
        </Portal>
        
        {/* Product Selection Modal */}
        <Portal>
          <Modal 
            visible={showProductModal} 
            onDismiss={() => setShowProductModal(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {filteredProducts.map(product => (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => {
                    setSelectedProduct(product);
                    setRate(product.purchase_rate.toString());
                  }}
                  style={styles.productItem}
                >
                  <Text style={styles.productItemName}>{product.name} ({product.product_code})</Text>
                  {product.hsn_code && (
                    <Text style={styles.productItemDetail}>HSN: {product.hsn_code}</Text>
                  )}
                  <Text style={styles.productItemDetail}>Purchase Rate: {formatCurrency(product.purchase_rate)}</Text>
                  <Text style={styles.productItemDetail}>Stock: {product.stock}</Text>
                  {product.tax1_name && (
                    <Text style={styles.productItemDetail}>Tax 1: {product.tax1_name}</Text>
                  )}
                  {product.tax2_name && (
                    <Text style={styles.productItemDetail}>Tax 2: {product.tax2_name}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {selectedProduct && (
              <View style={styles.productForm}>
                {renderProductDetails(selectedProduct)}
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      label="Quantity"
                      value={quantity}
                      onChangeText={setQuantity}
                      style={styles.numberInput}
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      label="Rate"
                      value={rate}
                      onChangeText={setRate}
                      style={styles.numberInput}
                      keyboardType="numeric"
                      mode="outlined"
                      dense
                    />
                  </View>
                </View>
                
                <Button 
                  mode="contained" 
                  onPress={handleAddItem}
                  style={styles.addItemButton}
                >
                  Add to Purchase
                </Button>
              </View>
            )}
            
            <Button 
              mode="outlined" 
              onPress={() => setShowProductModal(false)}
              style={styles.modalCloseButton}
            >
              Cancel
            </Button>
          </Modal>
        </Portal>
        
        {/* Return Purchase Selection Modal */}
        <Portal>
          <Modal 
            visible={showReturnModal} 
            onDismiss={() => setShowReturnModal(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Purchase to Return</Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {returnablePurchases.length === 0 ? (
                <Text style={styles.noPurchasesText}>No returnable purchases found</Text>
              ) : (
                returnablePurchases.map(purchase => (
                  <TouchableOpacity
                    key={purchase.id}
                    onPress={() => handleSelectReturnPurchase(purchase)}
                    style={styles.purchaseItem}
                  >
                    <Text style={styles.purchaseItemInvoice}>{purchase.invoice_no}</Text>
                    <Text style={styles.purchaseItemDate}>{formatDate(purchase.date)}</Text>
                    <Text style={styles.purchaseItemSupplier}>{purchase.supplier?.name}</Text>
                    <Text style={styles.purchaseItemAmount}>
                      Total: {formatCurrency(purchase.items.reduce((sum, item) => sum + item.amount, 0))}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            
            <Button 
              mode="outlined" 
              onPress={() => setShowReturnModal(false)}
              style={styles.modalCloseButton}
            >
              Cancel
            </Button>
          </Modal>
        </Portal>
        
        {/* Return Items Modal */}
        <Portal>
          <Modal 
            visible={showReturnItemModal} 
            onDismiss={() => setShowReturnItemModal(false)}
            contentContainerStyle={styles.returnModalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Return Items for {selectedReturnPurchase?.invoice_no}
              </Text>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {returnItems.length === 0 ? (
                <Text style={styles.noItemsText}>No items available for return</Text>
              ) : (
                returnItems.map(item => renderReturnItem(item))
              )}
            </ScrollView>
            
            <View style={styles.returnModalFooter}>
              <Button 
                mode="outlined" 
                onPress={() => setShowReturnItemModal(false)}
                style={styles.modalCloseButton}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleReturnSubmit}
                style={styles.submitReturnButton}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Create Return
              </Button>
            </View>
          </Modal>
        </Portal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6a11cb',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 16,
    minWidth: '100%',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  row: {
    flexDirection: 'column',
    marginBottom: 12,
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputContainer: {
    width: '48%',
  },
  numberInput: {
    backgroundColor: 'white',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    marginBottom: 8,
    backgroundColor: 'white',
  },
  dateInputContainer: {
    flex: 1,
    marginBottom: 8,
    position: 'relative',
    width: '100%',
  },
  datePickerButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    width: '100%',
  },
  picker: {
    width: '100%',
    height: 56,
  },
  storeCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noStoreText: {
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  supplierCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  balanceChip: {
    backgroundColor: 'transparent',
    borderColor: '#6a11cb',
  },
  balanceChipText: {
    fontSize: 12,
    color: '#6a11cb',
  },
  supplierInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  supplierInfoLabel: {
    fontSize: 14,
    color: '#616161',
  },
  supplierInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  changeButton: {
    alignSelf: 'flex-end',
    margin: 8,
  },
  selectButton: {
    marginTop: 8,
    width: '100%',
  },
  searchBar: {
    marginBottom: 16,
  },
  addButton: {
    marginBottom: 16,
    backgroundColor: '#6a11cb',
    width: '100%',
  },
  productDetailsCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productCode: {
    fontSize: 12,
    color: '#757575',
  },
  productInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productInfoLabel: {
    fontSize: 14,
    color: '#616161',
  },
  productInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  productForm: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  itemsContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
  },
  mobileItemContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  mobileItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mobileProductName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  mobileProductAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6a11cb',
  },
  mobileItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mobileDetailText: {
    fontSize: 12,
    color: '#757575',
  },
  mobileTaxText: {
    fontSize: 11,
    color: '#757575',
    fontStyle: 'italic',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  totalAmount: {
    fontWeight: 'bold',
    color: '#6a11cb',
  },
  noItemsText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
  remarksInput: {
    backgroundColor: 'white',
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#6a11cb',
    width: '100%',
  },
  cancelButton: {
    marginTop: 8,
    borderColor: '#6a11cb',
    width: '100%',
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 8,
    maxHeight: '90%',
    width: '95%',
  },
  returnModalContainer: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 8,
    maxHeight: '90%',
    width: '95%',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: '70%',
    paddingHorizontal: 16,
  },
  supplierItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  supplierItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  supplierItemDetail: {
    fontSize: 14,
    color: '#666',
  },
  productItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  productItemDetail: {
    fontSize: 14,
    color: '#666',
  },
  purchaseItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  purchaseItemInvoice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  purchaseItemDate: {
    fontSize: 14,
    color: '#666',
  },
  purchaseItemSupplier: {
    fontSize: 14,
    color: '#6a11cb',
  },
  purchaseItemAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  addItemButton: {
    marginTop: 12,
    backgroundColor: '#6a11cb',
  },
  modalCloseButton: {
    margin: 16,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
  },
  // Purchase List Styles
  pageHeader: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6a11cb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#6a11cb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    flex: 1,
    marginRight: 8,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    flex: 1,
  },
  newButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  returnButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  purchaseCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  purchaseDate: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  supplierText: {
    fontSize: 14,
    color: '#6a11cb',
    marginTop: 4,
  },
  createdByText: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
  },
  returnReferenceText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
    fontStyle: 'italic',
  },
  returnedChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'transparent',
    borderColor: '#f44336',
  },
  returnedChipText: {
    color: '#f44336',
    fontSize: 12,
  },
  purchaseAmountContainer: {
    alignItems: 'flex-end',
  },
  purchaseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6a11cb',
  },
  returnAmount: {
    color: '#f44336',
  },
  purchaseItems: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  paymentType: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingTop: 0,
    paddingBottom: 8,
  },
  actionButton: {
    minWidth: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    textAlign: 'center',
    color: '#757575',
    marginVertical: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BDBDBD',
    marginTop: 8,
  },
  noPurchasesText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
  },
  // Return Items Styles
  returnItemCard: {
    marginBottom: 16,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  returnItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  returnItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  returnItemCode: {
    fontSize: 12,
    color: '#757575',
  },
  returnItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  returnItemLabel: {
    fontSize: 14,
    color: '#616161',
  },
  returnItemValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  returnQuantityInput: {
    marginTop: 8,
    backgroundColor: 'white',
  },
  returnModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitReturnButton: {
    backgroundColor: '#FF9800',
  },
});

export default PurchaseEntryScreen;