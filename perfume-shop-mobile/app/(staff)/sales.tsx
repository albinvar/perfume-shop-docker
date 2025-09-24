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
  Linking,
  Platform
} from 'react-native';
import { 
  Button, 
  TextInput, 
  DataTable, 
  Card, 
  Searchbar,
  List,
  Portal,
  Dialog,
  Chip,
  RadioButton,
  Modal
} from 'react-native-paper';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';

interface Tax {
  id?: number;
  name?: string;
  rate?: number;
}

interface Product {
  id: number;
  name: string;
  product_code: string;
  barcode: string;
  mrp: number;
  discount: number;
  sale_rate: number;
  purchase_rate: number;
  opening_stock: number;
  category: { 
    id: number; 
    name: string 
  };
  hsn_code: string;
  tax1?: Tax;
  tax2?: Tax;
  tax1_name?: string;
  tax2_name?: string;
  tax_type: 'INCLUSIVE' | 'EXCLUSIVE';
  image_url?: string;
}

interface PrivilegeCard {
  id: number;
  card_type: string;
  discount_percentage: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  privilege_card?: number;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  store: number;
  token: string;
}

interface AuthContextType {
  user: UserProfile | null;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

interface SaleItem {
  product_id: number;
  product_name: string;
  product_code: string;
  barcode: string;
  quantity: number;
  rate: number;
  discount: number;
  tax1_rate: number;
  tax2_rate: number;
  tax1_name?: string;
  tax2_name?: string;
  tax_type: 'INCLUSIVE' | 'EXCLUSIVE';
  category_name?: string;
  hsn_code?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
}

interface Sale {
  id: number;
  invoice_no: string;
  date: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  final_amount: number;
  payment_method: string;
  items: SaleItem[];
  customer?: Customer & { privilege_card?: PrivilegeCard };
  store: { id: number; name: string };
  created_by: { id: number; username: string };
  is_return?: boolean;
  notes?: string;
  original_sale?: number;
}

const { width } = Dimensions.get('window');

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'ONLINE', label: 'Online Payment' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CREDIT', label: 'Credit' },
];

const SalesEntry = () => {
  const { user, fetchWithAuth } = useAuth() as AuthContextType;
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<(Customer & { privilege_card?: PrivilegeCard })[]>([]);
  const [privilegeCards, setPrivilegeCards] = useState<PrivilegeCard[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeDetails, setStoreDetails] = useState<{ id: number; name: string } | null>(null);
  const [date, setDate] = useState(new Date());
  const [invoiceNo, setInvoiceNo] = useState('SA001');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { privilege_card?: PrivilegeCard }) | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [productPickerKey, setProductPickerKey] = useState(0);
  const [customerPickerKey, setCustomerPickerKey] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const toNumber = (value: number | string): number => {
    if (typeof value === 'string') {
      const numStr = value.replace(/[^0-9.]/g, '');
      return parseFloat(numStr) || 0;
    }
    return value || 0;
  };

  const formatCurrency = (value: number | string): string => {
    const num = toNumber(value);
    return `₹${num.toFixed(2)}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        if (user?.store) {
          const [storeRes, productsRes, customersRes, privilegeCardsRes] = await Promise.all([
            fetchWithAuth(`/api/stores/${user.store}/`),
            fetchWithAuth('/api/products/?for_sale=true&expand=tax1,tax2,category'),
            fetchWithAuth('/api/customers-privilege/customers/'),
            fetchWithAuth('/api/customers-privilege/privilege-cards/'),
          ]);

          if (storeRes.ok) setStoreDetails(await storeRes.json());
          
          if (productsRes.ok) {
            const productsData = await productsRes.json();
            const processedProducts = productsData.map((product: Product) => {
              const tax1Name = formatTaxDisplay(product.tax1, product.tax1_name);
              const tax2Name = formatTaxDisplay(product.tax2, product.tax2_name);
              
              return {
                ...product,
                tax1_name: tax1Name,
                tax2_name: tax2Name,
                mrp: toNumber(product.mrp),
                discount: toNumber(product.discount),
                sale_rate: toNumber(product.sale_rate),
                purchase_rate: toNumber(product.purchase_rate),
                opening_stock: toNumber(product.opening_stock),
              };
            });
            
            setProducts(processedProducts);
            setFilteredProducts(processedProducts);
          }
          
          if (customersRes.ok) {
            const customersData = await customersRes.json();
            if (privilegeCardsRes.ok) {
              const privilegeCardsData = await privilegeCardsRes.json();
              setPrivilegeCards(privilegeCardsData);
              const customersWithCards = customersData.map((customer: Customer) => ({
                ...customer,
                privilege_card: privilegeCardsData.find((card: PrivilegeCard) => card.id === customer.privilege_card)
              }));
              setCustomers(customersWithCards);
            } else {
              setCustomers(customersData);
            }
          }

          await fetchLastInvoice();
        }
      } catch (error) {
        console.error('Initialization error:', error);
        Alert.alert('Error', 'Failed to initialize sales form');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchSales();

    const timer = setInterval(() => setCurrentTime(new Date()), 600000);
    return () => clearInterval(timer);
  }, [user?.store, fetchWithAuth]);

  useEffect(() => {
    if (searchQuery === '') {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.product_code.toLowerCase().includes(query) ||
          p.barcode.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, products]);

  const fetchLastInvoice = async () => {
    try {
      let url = '/api/Sales/last_invoice/';
      if (user?.store) {
        url += `?store=${user.store}`;
      }
      
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.next_invoice) {
        setInvoiceNo(data.next_invoice);
      } else {
        setInvoiceNo('SA001');
      }
    } catch (error) {
      console.error('Failed to fetch last invoice:', error);
      setInvoiceNo('SA001');
    }
  };

  const fetchSales = async () => {
    try {
      setRefreshing(true);
      const response = await fetchWithAuth(`/api/Sales/?store=${user?.store}&expand=customer,items.product,created_by,original_sale`);
      
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      Alert.alert('Error', 'Could not load sales history');
    } finally {
      setRefreshing(false);
    }
  };

  const downloadInvoice = async (saleId: number) => {
    try {
      setPdfLoading(saleId);
      
      const response = await fetchWithAuth(`/api/Sales/${saleId}/download_invoice/`);
      
      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      if (Platform.OS === 'web') {
        // Web handling
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice_${saleId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Mobile handling
        const pdfData = await response.blob();
        const reader = new FileReader();
        
        reader.onload = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (!base64data) throw new Error('Failed to read PDF data');
          
          const fileName = `invoice_${saleId}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          // Write the file
          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Share the file (this will allow user to save or open)
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download Invoice',
            UTI: 'com.adobe.pdf',
          });
        };
        
        reader.onerror = () => {
          throw new Error('Failed to read file');
        };
        
        reader.readAsDataURL(pdfData);
      }
    } catch (error: any) {
      console.error('Invoice download error:', error);
      Alert.alert('Error', error.message || 'Failed to download invoice');
    } finally {
      setPdfLoading(null);
    }
  };

  const downloadPdfToDevice = async () => {
    if (!pdfUri) return;
    
    try {
      setPdfDownloading(true);
      
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = pdfUri;
        link.download = `invoice_${editingSale?.id || 'new'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileName = `invoice_${editingSale?.id || 'new'}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        // First download the file from the URI
        const downloadResumable = FileSystem.createDownloadResumable(
          pdfUri,
          fileUri,
          {}
        );

        const result = await downloadResumable.downloadAsync();
        if (!result) throw new Error('Download failed');
        
        const { uri } = result;
        
        if (Platform.OS === 'android') {
          const contentUri = await FileSystem.getContentUriAsync(uri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/pdf',
          });
        } else {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Invoice',
            UTI: 'com.adobe.pdf',
          });
        }
      }
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', error.message || 'Failed to download PDF');
    } finally {
      setPdfDownloading(false);
    }
  };

  const sharePdf = async () => {
    try {
      if (!pdfUri) return;
      
      if (Platform.OS === 'web') {
        downloadPdfToDevice();
      } else {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error: any) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', error.message || 'Failed to share PDF');
    }
  };

  const handleAddItem = () => {
    try {
      if (!currentProduct) throw new Error('Please select a product');

      const qty = toNumber(quantity);
      const itemRate = toNumber(currentProduct.sale_rate);

      // Validate quantity
      if (isNaN(qty)) {
        setFormErrors({ ...formErrors, quantity: 'Quantity must be a number' });
        return;
      }
      if (qty <= 0) {
        setFormErrors({...formErrors, quantity: 'Quantity must be greater than 0'});
        return;
      }
      
      // Validate rate
      if (isNaN(itemRate)) {
        setFormErrors({...formErrors, rate: 'Rate must be a number'});
        return;
      }
      if (itemRate <= 0) {
        setFormErrors({...formErrors, rate: 'Rate must be greater than 0'});
        return;
      }
      
      // Ensure rate doesn't have too many digits
      const rateStr = itemRate.toString();
      if (rateStr.replace('.', '').length > 10) {
        setFormErrors({...formErrors, rate: 'Rate cannot have more than 10 digits'});
        return;
      }
      
      // Round to 2 decimal places
      const roundedRate = parseFloat(itemRate.toFixed(2));

      // Calculate tax amounts
      const tax1Rate = extractTaxRate(currentProduct.tax1, currentProduct.tax1_name);
      const tax2Rate = extractTaxRate(currentProduct.tax2, currentProduct.tax2_name);
      const tax1Name = formatTaxDisplay(currentProduct.tax1, currentProduct.tax1_name);
      const tax2Name = formatTaxDisplay(currentProduct.tax2, currentProduct.tax2_name);
      
      // Calculate base amount
      const amount = qty * roundedRate;
      let taxAmount = 0;
      
      // Calculate tax if tax type is exclusive
      if (currentProduct.tax_type === 'EXCLUSIVE') {
        taxAmount = amount * (tax1Rate / 100) + amount * (tax2Rate / 100);
      }
      
      // Calculate total amount (including tax)
      let totalAmount = amount + taxAmount;
      let discountRate = 0;
      
      // Apply customer discount if available
      if (selectedCustomer?.privilege_card) {
        discountRate = selectedCustomer.privilege_card.discount_percentage;
        totalAmount = totalAmount * (1 - (discountRate / 100));
      }

      const existingItemIndex = items.findIndex(i => i.product_id === currentProduct.id);

      const newItem: SaleItem = {
        product_id: currentProduct.id,
        product_name: currentProduct.name,
        product_code: currentProduct.product_code,
        barcode: currentProduct.barcode,
        quantity: qty,
        rate: roundedRate,
        discount: discountRate,
        tax1_rate: tax1Rate,
        tax2_rate: tax2Rate,
        tax1_name: tax1Name,
        tax2_name: tax2Name,
        tax_type: currentProduct.tax_type,
        category_name: currentProduct.category?.name,
        hsn_code: currentProduct.hsn_code,
        amount: amount,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };

      if (existingItemIndex >= 0) {
        const updatedItems = [...items];
        updatedItems[existingItemIndex] = newItem;
        setItems(updatedItems);
      } else {
        setItems([...items, newItem]);
      }

      setCurrentProduct(null);
      setQuantity('1');
      setRate('');
      setProductPickerKey(prev => prev + 1);
      setFormErrors({});
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const validateSale = () => {
    const errors: Record<string, string> = {};
    
    if (items.length === 0) {
      errors.items = 'Please add at least one item';
    }

    if (!user?.store) {
      errors.store = 'No store assigned to user';
    }

    const invalidItems = items.filter(item => 
      !item.product_id || 
      isNaN(item.quantity) || item.quantity <= 0 ||
      isNaN(item.rate) || item.rate <= 0 ||
      item.rate.toString().replace('.', '').length > 10
    );
    
    if (invalidItems.length > 0) {
      errors.items = 'All items must have valid product, quantity (>0) and rate (>0 with max 10 digits)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0);
    const totalBeforeDiscount = subtotal + taxAmount;
    
    const discountAmount = selectedCustomer?.privilege_card ? 
      totalBeforeDiscount * (selectedCustomer.privilege_card.discount_percentage / 100) : 0;
    
    const totalAmount = totalBeforeDiscount - discountAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      totalBeforeDiscount
    };
  };

  const handleSubmit = async () => {
    if (!validateSale()) return;

    try {
      setLoading(true);
      
      const { subtotal, discountAmount, taxAmount, totalAmount } = calculateTotals();

      const saleData = {
        invoice_no: invoiceNo,
        date: date.toISOString().split('T')[0],
        store: user?.store,
        customer: selectedCustomer?.id || null,
        payment_method: paymentMode,
        notes: notes,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          rate: parseFloat(item.rate.toFixed(2)),
          discount: item.discount,
          tax1_rate: item.tax1_rate,
          tax2_rate: item.tax2_rate,
          tax_type: item.tax_type,
          amount: item.amount,
          tax_amount: item.tax_amount,
          total_amount: item.total_amount
        }))
      };

      let response;
      if (editingSale) {
        response = await fetchWithAuth(`/api/Sales/${editingSale.id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          },
          body: JSON.stringify(saleData)
        });
      } else {
        response = await fetchWithAuth('/api/Sales/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          },
          body: JSON.stringify(saleData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        
        if (errorData.items) {
          setFormErrors({ items: errorData.items.join(', ') });
        } else if (errorData.non_field_errors) {
          setFormErrors({ general: errorData.non_field_errors.join(', ') });
        } else {
          const fieldErrors = Object.entries(errorData).reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value.join(', ') : String(value);
            return acc;
          }, {} as Record<string, string>);
          setFormErrors(fieldErrors);
        }
        
        throw new Error(errorData.detail || errorData.message || 'Failed to save sale');
      }

      const responseData = await response.json();
      Alert.alert('Success', `Sale ${editingSale ? 'updated' : 'created'} successfully`);
      resetForm();
      fetchSales();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Sale submission error:', error);
        Alert.alert('Error', error.message || 'Failed to save sale');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItems([]);
    setStep(1);
    setShowForm(false);
    setEditingSale(null);
    setSelectedCustomer(null);
    setPaymentMode('CASH');
    setNotes('');
    setDate(new Date());
    setFormErrors({});
    fetchSales();
    fetchLastInvoice();
  };

  const handleEditSale = (sale: Sale) => {
    if (sale.is_return) {
      Alert.alert('Error', 'Cannot edit a return sale');
      return;
    }
    
    setEditingSale(sale);
    setInvoiceNo(sale.invoice_no);
    setDate(new Date(sale.date));
    setItems(sale.items.map(item => ({
      ...item,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      tax_amount: item.tax_amount || 0,
      total_amount: item.total_amount || item.amount,
      tax1_name: item.tax1_name || (item.tax1_rate ? `Tax (${item.tax1_rate}%)` : ''),
      tax2_name: item.tax2_name || (item.tax2_rate ? `Tax (${item.tax2_rate}%)` : '')
    })));
    setSelectedCustomer(sale.customer || null);
    setPaymentMode(sale.payment_method);
    setNotes(sale.notes || '');
    setShowForm(true);
    setStep(1);
    setFormErrors({});
  };

  const confirmDeleteSale = (saleId: number) => {
    setSaleToDelete(saleId);
    setDeleteModalVisible(true);
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;
    
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/Sales/${saleToDelete}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (response.ok) {
        Alert.alert('Success', 'Sale deleted successfully');
        fetchSales();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Delete sale error:', error);
        Alert.alert('Error', 'Failed to delete sale');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setDeleteModalVisible(false);
      setSaleToDelete(null);
    }
  };

  const returnSale = async (saleId: number) => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/Sales/${saleId}/return_sale/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create return sale');
      }

      const responseData = await response.json();
      Alert.alert('Success', 'Return sale created successfully');
      fetchSales();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Return sale error:', error);
        Alert.alert('Error', error.message || 'Failed to create return sale');
      } else {
        console.error('Unknown error:', error);
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderProductDetails = () => {
    if (!currentProduct) return null;

    return (
      <Card style={styles.productDetailsCard}>
        <Card.Content>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{currentProduct.name}</Text>
            <Text style={styles.productCode}>{currentProduct.product_code}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Barcode:</Text>
            <Text style={styles.productInfoValue}>{currentProduct.barcode}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Category:</Text>
            <Text style={styles.productInfoValue}>
              {currentProduct.category?.name || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>HSN Code:</Text>
            <Text style={styles.productInfoValue}>{currentProduct.hsn_code || 'N/A'}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>MRP:</Text>
            <Text style={styles.productInfoValue}>{formatCurrency(currentProduct.mrp)}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Discount:</Text>
            <Text style={styles.productInfoValue}>{currentProduct.discount}%</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Sale Rate:</Text>
            <Text style={styles.productInfoValue}>{formatCurrency(currentProduct.sale_rate)}</Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax 1:</Text>
            <Text style={styles.productInfoValue}>
              {currentProduct.tax1_name || 'No Tax'}
            </Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax 2:</Text>
            <Text style={styles.productInfoValue}>
              {currentProduct.tax2_name || 'No Tax'}
            </Text>
          </View>
          
          <View style={styles.productInfoRow}>
            <Text style={styles.productInfoLabel}>Tax Type:</Text>
            <Text style={styles.productInfoValue}>
              {currentProduct.tax_type === 'INCLUSIVE' ? 'Inclusive' : 'Exclusive'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderCustomerDetails = () => {
    if (!selectedCustomer) return null;

    return (
      <Card style={styles.customerDetailsCard}>
        <Card.Content>
          <View style={styles.customerHeader}>
            <Text style={styles.customerName}>{selectedCustomer.name}</Text>
            {selectedCustomer.privilege_card && (
              <Chip 
                mode="outlined" 
                style={styles.discountChip}
                textStyle={styles.discountChipText}
              >
                {selectedCustomer.privilege_card.card_type} ({selectedCustomer.privilege_card.discount_percentage}% off)
              </Chip>
            )}
          </View>
          
          <View style={styles.customerInfoRow}>
            <Text style={styles.customerInfoLabel}>Phone:</Text>
            <Text style={styles.customerInfoValue}>{selectedCustomer.phone}</Text>
          </View>
          
          <View style={styles.customerInfoRow}>
            <Text style={styles.customerInfoLabel}>Email:</Text>
            <Text style={styles.customerInfoValue}>{selectedCustomer.email || 'N/A'}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPriceSummary = () => {
    const { subtotal, discountAmount, taxAmount, totalAmount, totalBeforeDiscount } = calculateTotals();
    const customerDiscount = selectedCustomer?.privilege_card?.discount_percentage || 0;

    return (
      <Card style={styles.priceSummaryCard}>
        <Card.Content>
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummaryLabel}>Subtotal:</Text>
            <Text style={styles.priceSummaryValue}>{formatCurrency(subtotal)}</Text>
          </View>
          
          {taxAmount > 0 && (
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryLabel}>Tax:</Text>
              <Text style={styles.priceSummaryValue}>+{formatCurrency(taxAmount)}</Text>
            </View>
          )}
          
          <View style={styles.priceSummaryRow}>
            <Text style={styles.priceSummaryLabel}>Total Before Discount:</Text>
            <Text style={styles.priceSummaryValue}>{formatCurrency(totalBeforeDiscount)}</Text>
          </View>
          
          {customerDiscount > 0 && (
            <View style={styles.priceSummaryRow}>
              <Text style={styles.priceSummaryLabel}>Customer Discount ({customerDiscount}%):</Text>
              <Text style={styles.priceSummaryValue}>-{formatCurrency(discountAmount)}</Text>
            </View>
          )}
          
          <View style={[styles.priceSummaryRow, styles.finalAmountRow]}>
            <Text style={[styles.priceSummaryLabel, styles.finalAmountLabel]}>Total Amount:</Text>
            <Text style={[styles.priceSummaryValue, styles.finalAmountValue]}>{formatCurrency(totalAmount)}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderPaymentOptions = () => {
    return (
      <Card style={styles.paymentOptionsCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Payment Mode</Text>
          {PAYMENT_MODES.map(mode => (
            <View key={mode.value} style={styles.paymentOption}>
              <RadioButton
                value={mode.value}
                status={paymentMode === mode.value ? 'checked' : 'unchecked'}
                onPress={() => setPaymentMode(mode.value)}
                color="#6C63FF"
              />
              <Text style={styles.paymentOptionLabel}>{mode.label}</Text>
            </View>
          ))}
          
          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            mode="outlined"
            multiline
            numberOfLines={3}
          />
        </Card.Content>
      </Card>
    );
  };

  const renderSaleItem = (item: SaleItem, index: number) => {
    const isReturnItem = item.quantity < 0;
    
    return (
      <DataTable.Row key={index} style={[styles.tableRow, isReturnItem && styles.returnItemRow]}>
        <DataTable.Cell style={styles.tableCell}>
          {isReturnItem && (
            <View style={styles.returnBadge}>
              <Text style={styles.returnBadgeText}>RETURN</Text>
            </View>
          )}
          <Text style={[styles.productName, isReturnItem && styles.returnItemText]}>{item.product_name}</Text>
          <Text style={[styles.productCode, isReturnItem && styles.returnItemText]}>{item.product_code}</Text>
          {item.category_name && (
            <Text style={[styles.productCategory, isReturnItem && styles.returnItemText]}>Category: {item.category_name}</Text>
          )}
          {item.hsn_code && (
            <Text style={[styles.productHsn, isReturnItem && styles.returnItemText]}>HSN: {item.hsn_code}</Text>
          )}
          {(item.tax1_rate || item.tax2_rate) && (
            <View style={styles.taxContainer}>
              <Text style={[styles.taxText, isReturnItem && styles.returnItemText]}>
                {item.tax_type === 'INCLUSIVE' ? 'Incl.' : 'Excl.'} Tax: 
              </Text>
              {item.tax1_name && (
                <Text style={[styles.taxText, isReturnItem && styles.returnItemText]}>{item.tax1_name}</Text>
              )}
              {item.tax2_name && (
                <Text style={[styles.taxText, isReturnItem && styles.returnItemText]}>{item.tax2_name}</Text>
              )}
            </View>
          )}
        </DataTable.Cell>
        <DataTable.Cell numeric style={styles.tableCell}>
          <Text style={[styles.amountText, isReturnItem && styles.returnItemText]}>{item.quantity}</Text>
        </DataTable.Cell>
        <DataTable.Cell numeric style={styles.tableCell}>
          <Text style={[styles.amountText, isReturnItem && styles.returnItemText]}>{formatCurrency(item.rate)}</Text>
        </DataTable.Cell>
        <DataTable.Cell numeric style={styles.tableCell}>
          <Text style={[styles.amountText, isReturnItem && styles.returnItemText]}>{formatCurrency(item.total_amount)}</Text>
        </DataTable.Cell>
        {!isReturnItem && (
          <DataTable.Cell style={styles.tableCell}>
            <TouchableOpacity onPress={() => handleRemoveItem(index)}>
              <MaterialIcons name="delete-outline" size={20} color="#FF5252" />
            </TouchableOpacity>
          </DataTable.Cell>
        )}
      </DataTable.Row>
    );
  };

  const renderSaleCard = (sale: Sale, index: number) => {
    const isReturn = sale.is_return;
    const hasOriginalSale = !!sale.original_sale;
    
    return (
      <Animatable.View 
        key={sale.id}
        animation="fadeInUp"
        delay={index * 50}
      >
        <Card style={[styles.saleCard, isReturn && styles.returnSaleCard]}>
          <Card.Content>
            <View style={styles.saleHeader}>
              <View>
                <Text style={[styles.invoiceText, isReturn && styles.returnItemText]}>{sale.invoice_no}</Text>
                {isReturn && hasOriginalSale && (
                  <Text style={styles.originalSaleText}>Original: {sale.original_sale}</Text>
                )}
                <Text style={[styles.saleDate, isReturn && styles.returnItemText]}>
                  {new Date(sale.date).toLocaleDateString()}
                </Text>
                {sale.customer && (
                  <Text style={[styles.customerText, isReturn && styles.returnItemText]}>
                    {sale.customer.name}
                    {sale.customer.privilege_card && (
                      <Text> ({sale.customer.privilege_card.discount_percentage}% off)</Text>
                    )}
                  </Text>
                )}
              </View>
              <View style={styles.saleAmountContainer}>
                <Text style={[styles.saleAmount, isReturn && styles.returnItemText]}>
                  {formatCurrency(sale.final_amount)}
                </Text>
                <Text style={[styles.saleItems, isReturn && styles.returnItemText]}>
                  {sale.items.length} {sale.items.length === 1 ? 'item' : 'items'}
                </Text>
                <Text style={[styles.paymentMode, isReturn && styles.returnItemText]}>
                  {PAYMENT_MODES.find(m => m.value === sale.payment_method)?.label}
                </Text>
              </View>
            </View>
          </Card.Content>
          <Card.Actions style={styles.cardActions}>
            {!isReturn && (
              <>
                <Button 
                  mode="text" 
                  onPress={() => handleEditSale(sale)}
                  textColor="#6C63FF"
                  icon="pencil"
                >
                  Edit
                </Button>
                <Button 
                  mode="text" 
                  onPress={() => returnSale(sale.id)}
                  textColor="#FF9800"
                  icon="undo"
                >
                  Return
                </Button>
              </>
            )}
            <Button 
              mode="text" 
              onPress={() => downloadInvoice(sale.id)}
              textColor="#2196F3"
              icon="download"
              loading={pdfLoading === sale.id}
              disabled={pdfLoading === sale.id}
            >
              Invoice
            </Button>
            <Button 
              mode="text" 
              onPress={() => confirmDeleteSale(sale.id)}
              textColor="#FF5252"
              icon="delete"
            >
              Delete
            </Button>
          </Card.Actions>
        </Card>
      </Animatable.View>
    );
  };

  if (loading && !showForm) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6C63FF', '#4A43EC']}
        style={styles.headerContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.dateText}>{formatFullDate(currentTime)}</Text>
          </View>
          <View style={styles.storeBadge}>
            <FontAwesome5 name="store" size={16} color="#FFF" />
            <Text style={styles.storeName}>{storeDetails?.name || 'Store'}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={fetchSales}
            colors={['#6C63FF']}
            tintColor="#6C63FF"
          />
        }
      >
        <Portal>
          <Dialog 
            visible={deleteModalVisible} 
            onDismiss={() => setDeleteModalVisible(false)}
            style={styles.dialog}
          >
            <Dialog.Title style={styles.dialogTitle}>Confirm Delete</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogText}>Are you sure you want to delete this sale? This action cannot be undone.</Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}>
              <Button 
                onPress={() => setDeleteModalVisible(false)}
                style={styles.dialogCancelButton}
                labelStyle={styles.dialogButtonLabel}
              >
                Cancel
              </Button>
              <Button 
                onPress={handleDeleteSale} 
                style={styles.dialogDeleteButton}
                labelStyle={styles.dialogButtonLabel}
              >
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {!showForm ? (
          <>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Sales History</Text>
              <Animatable.View animation="pulse" iterationCount="infinite">
                <TouchableOpacity 
                  style={styles.newButton}
                  onPress={() => setShowForm(true)}
                >
                  <MaterialIcons name="add" size={24} color="#FFF" />
                  <Text style={styles.newButtonText}>New Sale</Text>
                </TouchableOpacity>
              </Animatable.View>
            </View>

            {sales.length > 0 ? (
              <List.Section style={styles.salesList}>
                {sales.map((sale, index) => renderSaleCard(sale, index))}
              </List.Section>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="receipt" size={48} color="#E0E0E0" />
                <Text style={styles.emptyText}>No sales found</Text>
                <Text style={styles.emptySubtext}>Start by creating a new sale</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={resetForm} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#6C63FF" />
              </TouchableOpacity>
              <Text style={styles.formTitle}>
                {editingSale ? 'Edit Sale' : 'New Sale'}
              </Text>
            </View>

            <View style={styles.progressSteps}>
              <View style={styles.stepIndicatorContainer}>
                <View style={[styles.stepIndicator, step >= 1 && styles.activeStepIndicator]}>
                  <Text style={[styles.stepNumber, step >= 1 && styles.activeStepNumber]}>1</Text>
                </View>
                <Text style={[styles.stepLabel, step >= 1 && styles.activeStepLabel]}>Basic Info</Text>
              </View>
              
              <View style={styles.stepConnector} />
              
              <View style={styles.stepIndicatorContainer}>
                <View style={[styles.stepIndicator, step >= 2 && styles.activeStepIndicator]}>
                  <Text style={[styles.stepNumber, step >= 2 && styles.activeStepNumber]}>2</Text>
                </View>
                <Text style={[styles.stepLabel, step >= 2 && styles.activeStepLabel]}>Add Products</Text>
              </View>
              
              <View style={styles.stepConnector} />
              
              <View style={styles.stepIndicatorContainer}>
                <View style={[styles.stepIndicator, step >= 3 && styles.activeStepIndicator]}>
                  <Text style={[styles.stepNumber, step >= 3 && styles.activeStepNumber]}>3</Text>
                </View>
                <Text style={[styles.stepLabel, step >= 3 && styles.activeStepLabel]}>Review</Text>
              </View>
            </View>

            {step === 1 && (
              <Animatable.View animation="fadeIn" duration={300}>
                <Card style={styles.formCard} elevation={3}>
                  <Card.Content>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Invoice Number</Text>
                      <TextInput
                        value={invoiceNo}
                        style={styles.input}
                        mode="outlined"
                        disabled={!!editingSale}
                        outlineColor="#E0E0E0"
                        activeOutlineColor="#6C63FF"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Date</Text>
                      <TextInput
                        value={date.toISOString().split('T')[0]}
                        onChangeText={(text) => {
                          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                            const newDate = new Date(text);
                            if (!isNaN(newDate.getTime())) {
                              setDate(newDate);
                            }
                          }
                        }}
                        style={styles.input}
                        mode="outlined"
                        placeholder="YYYY-MM-DD"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Customer</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          key={customerPickerKey}
                          selectedValue={selectedCustomer?.id?.toString() || ""}
                          onValueChange={(value) => {
                            if (value) {
                              const customer = customers.find(c => c.id.toString() === value);
                              setSelectedCustomer(customer || null);
                            } else {
                              setSelectedCustomer(null);
                            }
                          }}
                          style={styles.picker}
                          dropdownIconColor="#6C63FF"
                        >
                          <Picker.Item label="Select Customer" value="" />
                          {customers.map(customer => (
                            <Picker.Item 
                              key={customer.id} 
                              label={`${customer.name} ${customer.privilege_card ? `(${customer.privilege_card.card_type} - ${customer.privilege_card.discount_percentage}%)` : ''}`} 
                              value={customer.id.toString()}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    {selectedCustomer && renderCustomerDetails()}

                    {formErrors.general && (
                      <Text style={styles.errorText}>{formErrors.general}</Text>
                    )}

                    <Button 
                      mode="contained" 
                      onPress={() => setStep(2)}
                      style={styles.nextButton}
                      labelStyle={styles.buttonText}
                      contentStyle={styles.buttonContent}
                    >
                      Continue
                    </Button>
                  </Card.Content>
                </Card>
              </Animatable.View>
            )}

            {step === 2 && (
              <Animatable.View animation="fadeIn" duration={300}>
                <Card style={styles.formCard} elevation={3}>
                  <Card.Content>
                    <Searchbar
                      placeholder="Search products..."
                      onChangeText={setSearchQuery}
                      value={searchQuery}
                      style={styles.searchBar}
                      iconColor="#6C63FF"
                      inputStyle={styles.searchInput}
                      placeholderTextColor="#9E9E9E"
                    />
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Product</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          key={productPickerKey}
                          selectedValue={currentProduct?.id?.toString() || ""}
                          onValueChange={(value) => {
                            const product = products.find(p => p.id.toString() === value);
                            setCurrentProduct(product || null);
                            if (product) {
                              setRate(product.sale_rate.toString());
                              setQuantity('1');
                            }
                          }}
                          style={styles.picker}
                          dropdownIconColor="#6C63FF"
                        >
                          <Picker.Item label="Select Product" value="" />
                          {filteredProducts.map(product => (
                            <Picker.Item 
                              key={product.id} 
                              label={`${product.name} (${product.product_code}) - ₹${Number(product.sale_rate).toFixed(2)} 
                                ${product.category?.name ? ` | ${product.category.name}` : ''}
                                ${product.tax1_name ? ` | ${product.tax1_name}` : ''}
                                ${product.tax2_name ? ` + ${product.tax2_name}` : ''}`} 
                              value={product.id.toString()}
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    {currentProduct && renderProductDetails()}

                    <View style={styles.rowInputs}>
                      <View style={[styles.inputGroup, styles.quantityInput]}>
                        <Text style={styles.inputLabel}>Quantity</Text>
                        <TextInput
                          value={quantity}
                          onChangeText={text => {
                            if (/^\d*\.?\d*$/.test(text)) {
                              setQuantity(text);
                              setFormErrors({...formErrors, quantity: ''});
                            }
                          }}
                          keyboardType="numeric"
                          mode="outlined"
                          placeholder="1"
                          outlineColor="#E0E0E0"
                          activeOutlineColor="#6C63FF"
                          error={!!formErrors.quantity}
                        />
                        {formErrors.quantity && (
                          <Text style={styles.errorText}>{formErrors.quantity}</Text>
                        )}
                      </View>
                      <View style={[styles.inputGroup, styles.rateInput]}>
                        <Text style={styles.inputLabel}>Rate</Text>
                        <TextInput
                          value={rate}
                          onChangeText={text => {
                            const formatted = text.replace(/[^0-9.]/g, '');
                            const parts = formatted.split('.');
                            if (parts.length > 1) {
                              const decimalPart = parts[1].slice(0, 2);
                              setRate(`${parts[0]}.${decimalPart}`);
                            } else {
                              setRate(formatted);
                            }
                            setFormErrors({...formErrors, rate: ''});
                          }}
                          keyboardType="numeric"
                          mode="outlined"
                          placeholder={currentProduct?.sale_rate.toString() || "0"}
                          outlineColor="#E0E0E0"
                          activeOutlineColor="#6C63FF"
                          error={!!formErrors.rate}
                        />
                        {formErrors.rate && (
                          <Text style={styles.errorText}>{formErrors.rate}</Text>
                        )}
                      </View>
                    </View>

                    {formErrors.items && (
                      <Text style={styles.errorText}>{formErrors.items}</Text>
                    )}

                    <Button 
                      mode="contained" 
                      onPress={handleAddItem}
                      style={styles.addButton}
                      disabled={!currentProduct || !quantity || !rate}
                      labelStyle={styles.buttonText}
                      contentStyle={styles.buttonContent}
                    >
                      Add Product
                    </Button>

                    {items.length > 0 && (
                      <>
                        <DataTable style={styles.itemsTable}>
                          <DataTable.Header style={styles.tableHeader}>
                            <DataTable.Title><Text style={styles.tableHeaderText}>Product</Text></DataTable.Title>
                            <DataTable.Title numeric><Text style={styles.tableHeaderText}>Qty</Text></DataTable.Title>
                            <DataTable.Title numeric><Text style={styles.tableHeaderText}>Rate</Text></DataTable.Title>
                            <DataTable.Title numeric><Text style={styles.tableHeaderText}>Amount</Text></DataTable.Title>
                            <DataTable.Title><Text style={styles.tableHeaderText}></Text></DataTable.Title>
                          </DataTable.Header>
                          
                          {items.map((item, index) => renderSaleItem(item, index))}
                        </DataTable>

                        {renderPriceSummary()}
                      </>
                    )}

                    <View style={styles.formNavigation}>
                      <Button 
                        mode="outlined" 
                        onPress={() => setStep(1)}
                        style={styles.backButtonForm}
                        labelStyle={styles.backButtonText}
                        contentStyle={styles.buttonContent}
                      >
                        Back
                      </Button>
                      <Button 
                        mode="contained" 
                        onPress={() => setStep(3)}
                        style={styles.nextButton}
                        disabled={items.length === 0}
                        labelStyle={styles.buttonText}
                        contentStyle={styles.buttonContent}
                      >
                        Review
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              </Animatable.View>
            )}

            {step === 3 && (
              <Animatable.View animation="fadeIn" duration={300}>
                <Card style={styles.formCard} elevation={3}>
                  <Card.Content>
                    <View style={styles.reviewSection}>
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Invoice No:</Text>
                        <Text style={styles.reviewValue}>{invoiceNo}</Text>
                      </View>
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Date:</Text>
                        <Text style={styles.reviewValue}>{date.toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Store:</Text>
                        <Text style={styles.reviewValue}>
                          {storeDetails?.name || 'Not available'}
                        </Text>
                      </View>
                      {selectedCustomer && (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewLabel}>Customer:</Text>
                          <Text style={styles.reviewValue}>
                            {selectedCustomer.name}
                            {selectedCustomer.privilege_card && (
                              <Text> ({selectedCustomer.privilege_card.card_type} - {selectedCustomer.privilege_card.discount_percentage}% off)</Text>
                            )}
                          </Text>
                        </View>
                      )}
                    </View>

                    <DataTable style={styles.itemsTable}>
                      <DataTable.Header style={styles.tableHeader}>
                        <DataTable.Title><Text style={styles.tableHeaderText}>Product</Text></DataTable.Title>
                        <DataTable.Title numeric><Text style={styles.tableHeaderText}>Qty</Text></DataTable.Title>
                        <DataTable.Title numeric><Text style={styles.tableHeaderText}>Rate</Text></DataTable.Title>
                        <DataTable.Title numeric><Text style={styles.tableHeaderText}>Amount</Text></DataTable.Title>
                      </DataTable.Header>
                      
                      {items.map((item, index) => (
                        <DataTable.Row key={index} style={styles.tableRow}>
                          <DataTable.Cell style={styles.tableCell}>
                            <Text style={styles.productName}>{item.product_name}</Text>
                            <Text style={styles.productCode}>{item.product_code}</Text>
                            {item.category_name && (
                              <Text style={styles.productCategory}>Category: {item.category_name}</Text>
                            )}
                            {item.hsn_code && (
                              <Text style={styles.productHsn}>HSN: {item.hsn_code}</Text>
                            )}
                            {(item.tax1_rate || item.tax2_rate) && (
                              <View style={styles.taxContainer}>
                                <Text style={styles.taxText}>
                                  {item.tax_type === 'INCLUSIVE' ? 'Incl.' : 'Excl.'} Tax: 
                                </Text>
                                {item.tax1_name && (
                                  <Text style={styles.taxText}>{item.tax1_name}</Text>
                                )}
                                {item.tax2_name && (
                                  <Text style={styles.taxText}>{item.tax2_name}</Text>
                                )}
                              </View>
                            )}
                          </DataTable.Cell>
                          <DataTable.Cell numeric style={styles.tableCell}>{item.quantity}</DataTable.Cell>
                          <DataTable.Cell numeric style={styles.tableCell}>{formatCurrency(item.rate)}</DataTable.Cell>
                          <DataTable.Cell numeric style={styles.tableCell}>
                            <Text style={styles.amountText}>{formatCurrency(item.total_amount)}</Text>
                          </DataTable.Cell>
                        </DataTable.Row>
                      ))}
                    </DataTable>

                    {renderPriceSummary()}
                    {renderPaymentOptions()}

                    {formErrors.general && (
                      <Text style={styles.errorText}>{formErrors.general}</Text>
                    )}

                    <View style={styles.formNavigation}>
                      <Button 
                        mode="outlined" 
                        onPress={() => setStep(2)}
                        style={styles.backButtonForm}
                        labelStyle={styles.backButtonText}
                        contentStyle={styles.buttonContent}
                      >
                        Back
                      </Button>
                      <Button 
                        mode="contained" 
                        onPress={handleSubmit}
                        style={styles.submitButton}
                        loading={loading}
                        disabled={loading}
                        labelStyle={styles.buttonText}
                        contentStyle={styles.buttonContent}
                      >
                        {loading ? 'Processing...' : editingSale ? 'Update Sale' : 'Submit Sale'}
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              </Animatable.View>
            )}
          </>
        )}
      </ScrollView>

      {Platform.OS !== 'web' && pdfUri && (
        <Portal>
          <Modal 
            visible={!!pdfUri} 
            onDismiss={() => setPdfUri(null)}
            contentContainerStyle={styles.pdfModal}
          >
            {pdfLoading ? (
              <View style={styles.pdfLoading}>
                <ActivityIndicator animating={true} size="large" />
                <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
              </View>
            ) : (
              <>
                <WebView 
                  source={{ uri: pdfUri }}
                  style={styles.pdfViewer}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.pdfLoading}>
                      <ActivityIndicator animating={true} size="large" />
                    </View>
                  )}
                />
                <View style={styles.pdfButtons}>
                  <Button 
                    mode="contained" 
                    onPress={sharePdf}
                    style={styles.shareButton}
                    loading={pdfDownloading}
                    disabled={pdfDownloading}
                  >
                    Share
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={downloadPdfToDevice}
                    style={styles.downloadButton}
                    loading={pdfDownloading}
                    disabled={pdfDownloading}
                  >
                    Download
                  </Button>
                  <Button 
                    mode="outlined" 
                    onPress={() => setPdfUri(null)}
                    style={styles.closeButton}
                  >
                    Close
                  </Button>
                </View>
              </>
            )}
          </Modal>
        </Portal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F8',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6C63FF',
  },
  headerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeContainer: {
    marginBottom: 8,
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: 'Roboto',
  },
  dateText: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
    fontFamily: 'Roboto',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  storeName: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Roboto',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  salesList: {
    marginBottom: 24,
  },
  saleCard: {
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
  returnSaleCard: {
    backgroundColor: '#FFF0F0',
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  originalSaleText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  saleDate: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  customerText: {
    fontSize: 14,
    color: '#6C63FF',
    marginTop: 4,
  },
  saleAmountContainer: {
    alignItems: 'flex-end',
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
  },
  saleItems: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  paymentMode: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingTop: 0,
    paddingBottom: 8,
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
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Roboto',
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeStepIndicator: {
    backgroundColor: '#6C63FF',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9E9E9E',
  },
  activeStepNumber: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  activeStepLabel: {
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  formCard: {
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#616161',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFF',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  picker: {
    height: 56,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  quantityInput: {
    flex: 1,
  },
  rateInput: {
    flex: 1,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    color: '#333',
  },
  buttonContent: {
    height: 48,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  nextButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
  },
  backButtonForm: {
    borderColor: '#6C63FF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 16,
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
  customerDetailsCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  discountChip: {
    backgroundColor: 'transparent',
    borderColor: '#4CAF50',
  },
  discountChipText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  customerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  customerInfoLabel: {
    fontSize: 14,
    color: '#616161',
  },
  customerInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemsTable: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 0,
  },
  tableHeader: {
    backgroundColor: '#F5F5F8',
  },
  tableHeaderText: {
    color: '#616161',
    fontWeight: 'bold',
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F8',
  },
  returnItemRow: {
    backgroundColor: '#FFF0F0',
  },
  returnItemText: {
    color: '#FF5252',
  },
  returnBadge: {
    backgroundColor: '#FF5252',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  returnBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCell: {
    paddingVertical: 12,
  },
  amountText: {
    fontWeight: 'bold',
    color: '#333',
  },
  taxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  taxText: {
    fontSize: 10,
    color: '#757575',
    marginTop: 2,
    marginRight: 4,
  },
  priceSummaryCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceSummaryLabel: {
    fontSize: 14,
    color: '#616161',
  },
  priceSummaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  finalAmountRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
    marginTop: 8,
  },
  finalAmountLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  finalAmountValue: {
    fontWeight: 'bold',
    color: '#6C63FF',
    fontSize: 16,
  },
  paymentOptionsCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentOptionLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  notesInput: {
    marginTop: 12,
    backgroundColor: '#FFF',
  },
  reviewSection: {
    backgroundColor: '#F5F5F8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  formNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  dialogText: {
    fontSize: 16,
    color: '#616161',
    marginBottom: 24,
    lineHeight: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  dialogCancelButton: {
    marginRight: 8,
  },
  dialogDeleteButton: {
    backgroundColor: '#FF5252',
  },
  dialogButtonLabel: {
    color: 'white',
    fontWeight: 'bold',
  },
  pdfModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    padding: 16,
    height: '80%',
  },
  pdfViewer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pdfLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfLoadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  pdfButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  shareButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#4CAF50',
  },
  downloadButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#2196F3',
  },
  closeButton: {
    flex: 1,
  },
  productCategory: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  productHsn: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
});

export default SalesEntry;