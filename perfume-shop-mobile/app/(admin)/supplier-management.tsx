import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
  Dialog,
  Menu
} from 'react-native-paper';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { debounce } from 'lodash';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width, height } = Dimensions.get('window');

interface Supplier {
  id: number;
  name: string;
  address: string;
  city: string;
  contact_no: string;
  contact_email?: string;
  gstin?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  opening_balance: number;
  current_balance: number;
}

interface SupplierTransaction {
  id: number;
  transaction_no: string;
  transaction_date: string;
  invoice_no?: string;
  particulars: string;
  description?: string;
  debit: number;
  credit: number;
  payment_mode: string;
  remarks?: string;
  supplier: number;
}

type SupplierTab = 'suppliers' | 'transactions';

const paymentModes = [
  { label: 'Cash', value: 'cash' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Online Transfer', value: 'online' },
  { label: 'UPI', value: 'upi' },
  { label: 'Other', value: 'other' },
];

const SupplierManagement = () => {
  const { fetchWithAuth } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [currentTab, setCurrentTab] = useState<SupplierTab>('suppliers');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Modal states
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteTransactionDialogVisible, setDeleteTransactionDialogVisible] = useState(false);
  
  // Form state management using refs
  const supplierFormRef = useRef({
    name: '',
    address: '',
    city: '',
    contact_no: '',
    contact_email: '',
    gstin: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    opening_balance: '0',
  });

  const transactionFormRef = useRef({
    transaction_date: new Date().toISOString().split('T')[0],
    particulars: '',
    description: '',
    debit: '0',
    credit: '0',
    payment_mode: '',
    remarks: '',
    invoice_no: '',
  });

  const reportFormRef = useRef({
    supplier_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  const [currentItemId, setCurrentItemId] = useState<number | null>(null);
  const isEditMode = useMemo(() => currentItemId !== null, [currentItemId]);

  // ScrollView refs
  const supplierModalScrollRef = useRef<ScrollView>(null);
  const transactionModalScrollRef = useRef<ScrollView>(null);
  const reportModalScrollRef = useRef<ScrollView>(null);

  // Debounced input handlers
  const debouncedHandleSupplierFormChange = useCallback(
    debounce((field: keyof typeof supplierFormRef.current, value: string) => {
      supplierFormRef.current = {
        ...supplierFormRef.current,
        [field]: value
      };
    }, 150),
    []
  );

  const debouncedHandleTransactionFormChange = useCallback(
    debounce((field: keyof typeof transactionFormRef.current, value: string) => {
      transactionFormRef.current = {
        ...transactionFormRef.current,
        [field]: value
      };
    }, 150),
    []
  );

  const debouncedHandleReportFormChange = useCallback(
    debounce((field: keyof typeof reportFormRef.current, value: string) => {
      reportFormRef.current = {
        ...reportFormRef.current,
        [field]: value
      };
    }, 150),
    []
  );

  // Fetch data
  const fetchSuppliers = useCallback(async () => {
    let isMounted = true;
    
    try {
      setSuppliersLoading(true);
      setError(null);
      
      const response = await fetchWithAuth('/api/supplier/suppliers/');
      const data = await response.json();
      
      if (isMounted) {
        setSuppliers(data);
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error fetching suppliers:', error);
        setError('Failed to fetch suppliers');
        setSuppliers([]);
      }
    } finally {
      if (isMounted) {
        setSuppliersLoading(false);
        setRefreshing(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [fetchWithAuth]);

  const fetchTransactions = useCallback(async (supplierId?: number) => {
    let isMounted = true;
    
    try {
      setTransactionsLoading(true);
      setError(null);
      
      let url = '/api/supplier/supplier-transactions/';
      if (supplierId) {
        url += `?supplier=${supplierId}`;
      }
      
      const response = await fetchWithAuth(url);
      const data = await response.json();
      
      if (isMounted) {
        setTransactions(data);
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error fetching transactions:', error);
        setError('Failed to fetch transactions');
        setTransactions([]);
      }
    } finally {
      if (isMounted) {
        setTransactionsLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [fetchWithAuth]);

  useEffect(() => {
    if (currentTab === 'suppliers') {
      fetchSuppliers();
    }
  }, [currentTab, fetchSuppliers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (currentTab === 'suppliers') {
      fetchSuppliers();
    } else if (selectedSupplier) {
      fetchTransactions(selectedSupplier.id);
    }
  }, [currentTab, selectedSupplier, fetchSuppliers, fetchTransactions]);

  // Reset forms
  const resetSupplierForm = useCallback(() => {
    supplierFormRef.current = {
      name: '',
      address: '',
      city: '',
      contact_no: '',
      contact_email: '',
      gstin: '',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      opening_balance: '0',
    };
    setCurrentItemId(null);
  }, []);

  const resetTransactionForm = useCallback(() => {
    transactionFormRef.current = {
      transaction_date: new Date().toISOString().split('T')[0],
      particulars: '',
      description: '',
      debit: '0',
      credit: '0',
      payment_mode: '',
      remarks: '',
      invoice_no: '',
    };
    setCurrentItemId(null);
  }, []);

  const resetReportForm = useCallback(() => {
    reportFormRef.current = {
      supplier_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    };
  }, []);

  // Form submission handlers
  const handleSupplierSubmit = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!supplierFormRef.current.name.trim()) {
        throw new Error('Supplier name is required');
      }

      const url = isEditMode && currentItemId
        ? `/api/supplier/suppliers/${currentItemId}/`
        : '/api/supplier/suppliers/';
      
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...supplierFormRef.current,
          opening_balance: parseFloat(supplierFormRef.current.opening_balance),
        }),
      });

      if (!response.ok) {
        throw new Error(isEditMode ? 'Failed to update supplier' : 'Failed to create supplier');
      }

      setSupplierModalVisible(false);
      await fetchSuppliers();
      resetSupplierForm();
      Alert.alert('Success', `Supplier ${isEditMode ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      setError(error.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  }, [isEditMode, currentItemId, fetchWithAuth, fetchSuppliers, resetSupplierForm]);

  const handleTransactionSubmit = useCallback(async () => {
    if (!selectedSupplier) return;
    
    try {
      setLoading(true);
      
      const url = isEditMode && currentItemId
        ? `/api/supplier/supplier-transactions/${currentItemId}/`
        : '/api/supplier/supplier-transactions/';
      
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier: selectedSupplier.id,
          ...transactionFormRef.current,
          debit: parseFloat(transactionFormRef.current.debit),
          credit: parseFloat(transactionFormRef.current.credit),
        }),
      });

      if (!response.ok) {
        throw new Error(isEditMode ? 'Failed to update transaction' : 'Failed to create transaction');
      }

      setTransactionModalVisible(false);
      await fetchSuppliers();
      await fetchTransactions(selectedSupplier.id);
      resetTransactionForm();
      Alert.alert('Success', `Transaction ${isEditMode ? 'updated' : 'created'} successfully!`);
    } catch (error: any) {
      console.error('Error submitting transaction:', error);
      setError(error.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  }, [isEditMode, currentItemId, selectedSupplier, fetchWithAuth, fetchSuppliers, fetchTransactions, resetTransactionForm]);

  const handleGenerateReport = useCallback(async () => {
    try {
      setLoading(true);
      setPdfLoading(true);
      
      const params = new URLSearchParams();
      if (reportFormRef.current.supplier_id) {
        params.append('supplier_id', reportFormRef.current.supplier_id);
      }
      params.append('start_date', reportFormRef.current.start_date);
      params.append('end_date', reportFormRef.current.end_date);
      
      const response = await fetchWithAuth(`/api/supplier/report/?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `supplier_report_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const pdfData = await response.blob();
        const reader = new FileReader();
        
        reader.onload = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (!base64data) throw new Error('Failed to read PDF data');
          
          const fileName = `supplier_report_${Date.now()}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download Supplier Report',
            UTI: 'com.adobe.pdf',
          });
        };
        
        reader.onerror = () => {
          throw new Error('Failed to read file');
        };
        
        reader.readAsDataURL(pdfData);
      }
      
      setReportModalVisible(false);
    } catch (error: any) {
      console.error('Error generating report:', error);
      setError(error.message || 'Failed to generate report');
    } finally {
      setLoading(false);
      setPdfLoading(false);
    }
  }, [fetchWithAuth]);

  // Open forms with data for editing
  const openEditSupplier = useCallback((supplier: Supplier) => {
    setCurrentItemId(supplier.id);
    supplierFormRef.current = {
      name: supplier.name,
      address: supplier.address,
      city: supplier.city,
      contact_no: supplier.contact_no,
      contact_email: supplier.contact_email || '',
      gstin: supplier.gstin || '',
      bank_name: supplier.bank_name || '',
      account_number: supplier.account_number || '',
      ifsc_code: supplier.ifsc_code || '',
      opening_balance: supplier.opening_balance.toString(),
    };
    setSupplierModalVisible(true);
  }, []);

  const openEditTransaction = useCallback((transaction: SupplierTransaction) => {
    setCurrentItemId(transaction.id);
    transactionFormRef.current = {
      transaction_date: transaction.transaction_date,
      particulars: transaction.particulars,
      description: transaction.description || '',
      debit: transaction.debit.toString(),
      credit: transaction.credit.toString(),
      payment_mode: transaction.payment_mode,
      remarks: transaction.remarks || '',
      invoice_no: transaction.invoice_no || '',
    };
    setTransactionModalVisible(true);
  }, []);

  const openAddTransaction = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
    resetTransactionForm();
    setTransactionModalVisible(true);
  }, [resetTransactionForm]);

  const handleViewTransactions = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setCurrentTab('transactions');
    fetchTransactions(supplier.id);
  }, [fetchTransactions]);

  // Delete operations
  const handleDeleteClick = useCallback((itemId: number, isTransaction: boolean = false) => {
    setCurrentItemId(itemId);
    if (isTransaction) {
      setDeleteTransactionDialogVisible(true);
    } else {
      setDeleteDialogVisible(true);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async (isTransaction: boolean = false) => {
    if (!currentItemId) return;
    
    try {
      setLoading(true);
      
      if (isTransaction) {
        await fetchWithAuth(`/api/supplier/supplier-transactions/${currentItemId}/`, {
          method: 'DELETE',
        });
        if (selectedSupplier) {
          await fetchTransactions(selectedSupplier.id);
        }
        Alert.alert('Success', 'Transaction deleted successfully');
      } else {
        await fetchWithAuth(`/api/supplier/suppliers/${currentItemId}/`, {
          method: 'DELETE',
        });
        await fetchSuppliers();
        Alert.alert('Success', 'Supplier deleted successfully');
      }
    } catch (error: any) {
      console.error('Error deleting:', error);
      setError(error.message || `Failed to delete ${isTransaction ? 'transaction' : 'supplier'}`);
    } finally {
      setLoading(false);
      setDeleteDialogVisible(false);
      setDeleteTransactionDialogVisible(false);
      setCurrentItemId(null);
    }
  }, [currentItemId, selectedSupplier, fetchWithAuth, fetchSuppliers, fetchTransactions]);

  // Utility functions
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  }, []);

  // Filter data based on search query
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.contact_email && supplier.contact_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (supplier.gstin && supplier.gstin.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [suppliers, searchQuery]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => 
      transaction.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.invoice_no && transaction.invoice_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      transaction.transaction_date.includes(searchQuery)
    );
  }, [transactions, searchQuery]);

  // Render functions for UI components
  const renderSupplierCard = useCallback((supplier: Supplier) => {
    return (
      <View key={supplier.id} style={styles.supplierCard}>
        <View style={styles.supplierCardContent}>
          <View style={styles.supplierInfo}>
            <Text style={styles.supplierName}>{supplier.name}</Text>
            
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceText}>
                Balance: {formatCurrency(supplier.current_balance)}
              </Text>
            </View>
            
            <View style={styles.contactInfo}>
              <MaterialIcons name="phone" size={16} color="#666" />
              <Text style={styles.contactText}>{supplier.contact_no}</Text>
            </View>
            
            {supplier.contact_email && (
              <View style={styles.contactInfo}>
                <MaterialIcons name="email" size={16} color="#666" />
                <Text style={styles.contactText}>{supplier.contact_email}</Text>
              </View>
            )}
            
            <View style={styles.contactInfo}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.addressText} numberOfLines={2}>
                {supplier.address}, {supplier.city}
              </Text>
            </View>
            
            {supplier.gstin && (
              <View style={styles.contactInfo}>
                <MaterialIcons name="assignment" size={16} color="#666" />
                <Text style={styles.contactText}>GSTIN: {supplier.gstin}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.supplierActions}>
          <TouchableOpacity 
            onPress={() => openEditSupplier(supplier)}
            style={styles.actionButton}
          >
            <MaterialIcons name="edit" size={20} color="#6200ee" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => openAddTransaction(supplier)}
            style={styles.actionButton}
          >
            <MaterialIcons name="payment" size={20} color="#4caf50" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleViewTransactions(supplier)}
            style={styles.actionButton}
          >
            <MaterialIcons name="receipt" size={20} color="#ff9800" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleDeleteClick(supplier.id)}
            style={styles.actionButton}
          >
            <MaterialIcons name="delete" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [formatCurrency, openEditSupplier, openAddTransaction, handleViewTransactions, handleDeleteClick]);

  const renderTransactionRow = useCallback((transaction: SupplierTransaction) => {
    return (
      <DataTable.Row key={transaction.id}>
        <DataTable.Cell>{formatDate(transaction.transaction_date)}</DataTable.Cell>
        <DataTable.Cell>{transaction.particulars}</DataTable.Cell>
        <DataTable.Cell numeric>
          {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
        </DataTable.Cell>
        <DataTable.Cell numeric>
          {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
        </DataTable.Cell>
        <DataTable.Cell>
          <View style={styles.transactionActions}>
            <TouchableOpacity 
              onPress={() => openEditTransaction(transaction)}
              style={styles.actionButton}
            >
              <MaterialIcons name="edit" size={20} color="#6200ee" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleDeleteClick(transaction.id, true)}
              style={styles.actionButton}
            >
              <MaterialIcons name="delete" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        </DataTable.Cell>
      </DataTable.Row>
    );
  }, [formatCurrency, formatDate, openEditTransaction, handleDeleteClick]);

  const renderTab = useCallback((tab: SupplierTab, icon: string, label: string) => {
    const isActive = currentTab === tab;
    return (
      <TouchableOpacity 
        style={[styles.tab, isActive && styles.activeTab]}
        onPress={() => setCurrentTab(tab)}
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
  }, [currentTab]);

  const renderContent = useCallback(() => {
    if (currentTab === 'suppliers' && suppliersLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6a11cb" />
          <Text style={styles.loaderText}>Loading suppliers...</Text>
        </View>
      );
    }

    if (currentTab === 'transactions' && transactionsLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6a11cb" />
          <Text style={styles.loaderText}>Loading transactions...</Text>
        </View>
      );
    }

    if (currentTab === 'suppliers') {
      if (filteredSuppliers.length === 0) {
        return (
          <View style={styles.noSuppliersContainer}>
            <MaterialIcons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.noSuppliersText}>
              {searchQuery ? 'No matching suppliers found' : 'No suppliers available'}
            </Text>
            <Button 
              mode="contained" 
              onPress={() => {
                resetSupplierForm();
                setSupplierModalVisible(true);
              }}
              style={styles.addFirstButton}
              labelStyle={styles.addFirstButtonLabel}
              icon="plus"
            >
              Add Your First Supplier
            </Button>
          </View>
        );
      }

      return (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#6a11cb']}
              tintColor="#6a11cb"
            />
          }
        >
          <View style={styles.suppliersList}>
            {filteredSuppliers.map(renderSupplierCard)}
          </View>
        </ScrollView>
      );
    }

    if (currentTab === 'transactions') {
      if (filteredTransactions.length === 0) {
        return (
          <View style={styles.noTransactionsContainer}>
            <MaterialIcons name="receipt" size={48} color="#ccc" />
            <Text style={styles.noTransactionsText}>
              No transactions available
            </Text>
            {selectedSupplier && (
              <Button 
                mode="contained" 
                onPress={() => openAddTransaction(selectedSupplier)}
                style={styles.addFirstButton}
                labelStyle={styles.addFirstButtonLabel}
                icon="plus"
              >
                Add New Transaction
              </Button>
            )}
          </View>
        );
      }

      return (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#6a11cb']}
              tintColor="#6a11cb"
            />
          }
        >
          {selectedSupplier && (
            <View style={styles.selectedSupplierHeader}>
              <Text style={styles.selectedSupplierName}>
                {selectedSupplier.name}
              </Text>
              <Text style={styles.selectedSupplierBalance}>
                Current Balance: {formatCurrency(selectedSupplier.current_balance)}
              </Text>
              <Button 
                mode="contained" 
                onPress={() => openAddTransaction(selectedSupplier)}
                style={styles.addFirstButton}
                labelStyle={styles.addFirstButtonLabel}
                icon="plus"
              >
                Add New Transaction
              </Button>
            </View>
          )}
          
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Date</DataTable.Title>
              <DataTable.Title>Particulars</DataTable.Title>
              <DataTable.Title numeric>Debit</DataTable.Title>
              <DataTable.Title numeric>Credit</DataTable.Title>
              <DataTable.Title>Actions</DataTable.Title>
            </DataTable.Header>
            
            {filteredTransactions.map(renderTransactionRow)}
          </DataTable>
        </ScrollView>
      );
    }

    return null;
  }, [
    currentTab, 
    suppliersLoading, 
    transactionsLoading, 
    filteredSuppliers, 
    filteredTransactions, 
    searchQuery, 
    selectedSupplier, 
    refreshing, 
    onRefresh,
    renderSupplierCard,
    renderTransactionRow,
    openAddTransaction,
    resetSupplierForm,
    formatCurrency
  ]);

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
            <Text style={styles.headerTitle}>Supplier Management</Text>
            <Text style={styles.headerSubtitle}>
              {currentTab === 'suppliers' 
                ? `${suppliers.length} suppliers available`
                : `${transactions.length} transactions available`}
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <TouchableOpacity onPress={() => setMenuVisible(true)}>
                  <Ionicons name="ellipsis-vertical" size={24} color="white" />
                </TouchableOpacity>
              }
              contentStyle={styles.menuContent}
            >
              <Menu.Item 
                onPress={() => {
                  setMenuVisible(false);
                  setReportModalVisible(true);
                }} 
                title="Generate Report"
                leadingIcon={() => <MaterialIcons name="description" size={24} color="#666" />}
              />
              {currentTab === 'transactions' && (
                <Menu.Item 
                  onPress={() => {
                    setMenuVisible(false);
                    setCurrentTab('suppliers');
                  }} 
                  title="Back to Suppliers"
                  leadingIcon={() => <MaterialIcons name="arrow-back" size={24} color="#666" />}
                />
              )}
            </Menu>
            
            {currentTab === 'suppliers' && (
              <TouchableOpacity 
                onPress={() => {
                  resetSupplierForm();
                  setSupplierModalVisible(true);
                }}
                style={styles.addButton}
                disabled={loading}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Tab navigation */}
      <View style={styles.tabsContainer}>
        {renderTab('suppliers', 'people-outline', 'Suppliers')}
        {renderTab('transactions', 'receipt', 'Transactions')}
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder={`Search ${currentTab === 'suppliers' ? 'suppliers' : 'transactions'}...`}
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
      {renderContent()}

      {/* Supplier Form Modal */}
      <RNModal
        visible={supplierModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSupplierModalVisible(false);
          resetSupplierForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <Card style={styles.modalCard}>
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.modalHeader}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.modalTitle}>
                    {isEditMode ? 'Edit Supplier' : 'Add New Supplier'}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setSupplierModalVisible(false);
                      resetSupplierForm();
                    }}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </LinearGradient>

                <ScrollView 
                  ref={supplierModalScrollRef}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.formSection}>
                    <Text style={styles.sectionLabel}>Basic Information</Text>
                    
                    <TextInput
                      label="Name *"
                      defaultValue={supplierFormRef.current.name}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('name', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Address *"
                      defaultValue={supplierFormRef.current.address}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('address', text)}
                      style={[styles.modalInput, styles.addressInput]}
                      mode="outlined"
                      multiline
                      numberOfLines={3}
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="City *"
                      defaultValue={supplierFormRef.current.city}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('city', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Contact No *"
                      defaultValue={supplierFormRef.current.contact_no}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('contact_no', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      keyboardType="phone-pad"
                      disabled={loading}
                      left={<TextInput.Icon icon="phone" />}
                    />
                    
                    <TextInput
                      label="Email"
                      defaultValue={supplierFormRef.current.contact_email}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('contact_email', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      keyboardType="email-address"
                      disabled={loading}
                      left={<TextInput.Icon icon="email" />}
                    />
                    
                    <TextInput
                      label="Opening Balance"
                      defaultValue={supplierFormRef.current.opening_balance}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('opening_balance', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      keyboardType="numeric"
                      disabled={loading}
                      left={<TextInput.Icon icon="currency-inr" />}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.sectionLabel}>Tax & Bank Details</Text>
                    
                    <TextInput
                      label="GSTIN"
                      defaultValue={supplierFormRef.current.gstin}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('gstin', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Bank Name"
                      defaultValue={supplierFormRef.current.bank_name}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('bank_name', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Account Number"
                      defaultValue={supplierFormRef.current.account_number}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('account_number', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      keyboardType="numeric"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="IFSC Code"
                      defaultValue={supplierFormRef.current.ifsc_code}
                      onChangeText={(text) => debouncedHandleSupplierFormChange('ifsc_code', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                  </View>

                  <View style={styles.formActions}>
                    <Button 
                      mode="contained" 
                      onPress={handleSupplierSubmit}
                      style={styles.submitButton}
                      icon="content-save"
                      loading={loading}
                      disabled={loading}
                      labelStyle={styles.submitButtonLabel}
                    >
                      {isEditMode ? 'Update Supplier' : 'Save Supplier'}
                    </Button>
                    <Button 
                      mode="outlined" 
                      onPress={() => {
                        setSupplierModalVisible(false);
                        resetSupplierForm();
                      }}
                      style={styles.cancelButton}
                      icon="cancel"
                      disabled={loading}
                      labelStyle={styles.cancelButtonLabel}
                    >
                      Cancel
                    </Button>
                  </View>
                </ScrollView>
              </Card>
            </View>
          </KeyboardAvoidingView>
        </View>
      </RNModal>

      {/* Transaction Form Modal */}
      <RNModal
        visible={transactionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setTransactionModalVisible(false);
          resetTransactionForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <Card style={styles.modalCard}>
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.modalHeader}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.modalTitle}>
                    {isEditMode 
                      ? `Edit Transaction - ${selectedSupplier?.name}`
                      : `New Transaction - ${selectedSupplier?.name}`}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setTransactionModalVisible(false);
                      resetTransactionForm();
                    }}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </LinearGradient>

                <ScrollView 
                  ref={transactionModalScrollRef}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedSupplier && (
                    <View style={styles.supplierInfoSection}>
                      <Text style={styles.infoLabel}>Supplier:</Text>
                      <Text style={styles.infoText}>{selectedSupplier.name}</Text>
                      
                      <Text style={styles.infoLabel}>Current Balance:</Text>
                      <Text style={styles.infoText}>
                        {formatCurrency(selectedSupplier.current_balance)}
                      </Text>
                      
                      <Text style={styles.infoLabel}>Contact:</Text>
                      <Text style={styles.infoText}>{selectedSupplier.contact_no}</Text>
                    </View>
                  )}
                  
                  <View style={styles.formSection}>
                    <Text style={styles.sectionLabel}>Transaction Details</Text>
                    
                    <TextInput
                      label="Transaction Date (YYYY-MM-DD) *"
                      defaultValue={transactionFormRef.current.transaction_date}
                      onChangeText={(text) => debouncedHandleTransactionFormChange('transaction_date', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                      placeholder="2023-01-01"
                    />
                    
                    <TextInput
                      label="Particulars *"
                      defaultValue={transactionFormRef.current.particulars}
                      onChangeText={(text) => debouncedHandleTransactionFormChange('particulars', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Invoice No"
                      defaultValue={transactionFormRef.current.invoice_no}
                      onChangeText={(text) => debouncedHandleTransactionFormChange('invoice_no', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                    />
                    
                    <TextInput
                      label="Description"
                      defaultValue={transactionFormRef.current.description}
                      onChangeText={(text) => debouncedHandleTransactionFormChange('description', text)}
                      style={[styles.modalInput, styles.addressInput]}
                      mode="outlined"
                      multiline
                      numberOfLines={3}
                      disabled={loading}
                    />
                    
                    <View style={styles.amountRow}>
                      <TextInput
                        label="Debit Amount"
                        defaultValue={transactionFormRef.current.debit}
                        onChangeText={(text) => debouncedHandleTransactionFormChange('debit', text)}
                        style={[styles.modalInput, styles.amountInput]}
                        mode="outlined"
                        keyboardType="numeric"
                        disabled={loading}
                        left={<TextInput.Icon icon="currency-inr" />}
                      />
                      
                      <TextInput
                        label="Credit Amount"
                        defaultValue={transactionFormRef.current.credit}
                        onChangeText={(text) => debouncedHandleTransactionFormChange('credit', text)}
                        style={[styles.modalInput, styles.amountInput]}
                        mode="outlined"
                        keyboardType="numeric"
                        disabled={loading}
                        left={<TextInput.Icon icon="currency-inr" />}
                      />
                    </View>
                    
                    <Picker
                      selectedValue={transactionFormRef.current.payment_mode}
                      onValueChange={(value) => debouncedHandleTransactionFormChange('payment_mode', value)}
                      mode="dropdown"
                      style={styles.picker}
                    >
                      <Picker.Item label="Select payment mode..." value="" />
                      {paymentModes.map(mode => (
                        <Picker.Item key={mode.value} label={mode.label} value={mode.value} />
                      ))}
                    </Picker>
                    
                    <TextInput
                      label="Remarks"
                      defaultValue={transactionFormRef.current.remarks}
                      onChangeText={(text) => debouncedHandleTransactionFormChange('remarks', text)}
                      style={[styles.modalInput, styles.addressInput]}
                      mode="outlined"
                      multiline
                      numberOfLines={2}
                      disabled={loading}
                    />
                  </View>

                  <View style={styles.formActions}>
                    <Button 
                      mode="contained" 
                      onPress={handleTransactionSubmit}
                      style={styles.submitButton}
                      icon="content-save"
                      loading={loading}
                      disabled={loading}
                      labelStyle={styles.submitButtonLabel}
                    >
                      {isEditMode ? 'Update Transaction' : 'Save Transaction'}
                    </Button>
                    <Button 
                      mode="outlined" 
                      onPress={() => {
                        setTransactionModalVisible(false);
                        resetTransactionForm();
                      }}
                      style={styles.cancelButton}
                      icon="cancel"
                      disabled={loading}
                      labelStyle={styles.cancelButtonLabel}
                    >
                      Cancel
                    </Button>
                  </View>
                </ScrollView>
              </Card>
            </View>
          </KeyboardAvoidingView>
        </View>
      </RNModal>

      {/* Report Form Modal */}
      <RNModal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setReportModalVisible(false);
          resetReportForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <Card style={styles.modalCard}>
                <LinearGradient
                  colors={['#6a11cb', '#2575fc']}
                  style={styles.modalHeader}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.modalTitle}>Generate Supplier Report</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setReportModalVisible(false);
                      resetReportForm();
                    }}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </LinearGradient>

                <ScrollView 
                  ref={reportModalScrollRef}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.formSection}>
                    <Text style={styles.sectionLabel}>Report Criteria</Text>
                    
                    <Picker
                      selectedValue={reportFormRef.current.supplier_id}
                      onValueChange={(value) => debouncedHandleReportFormChange('supplier_id', value)}
                      mode="dropdown"
                      style={styles.picker}
                    >
                      <Picker.Item label="Select a supplier..." value="" />
                      {suppliers.map(supplier => (
                        <Picker.Item key={supplier.id} label={supplier.name} value={String(supplier.id)} />
                      ))}
                    </Picker>
                    
                    <TextInput
                      label="Start Date (YYYY-MM-DD) *"
                      defaultValue={reportFormRef.current.start_date}
                      onChangeText={(text) => debouncedHandleReportFormChange('start_date', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                      placeholder="2023-01-01"
                    />
                    
                    <TextInput
                      label="End Date (YYYY-MM-DD) *"
                      defaultValue={reportFormRef.current.end_date}
                      onChangeText={(text) => debouncedHandleReportFormChange('end_date', text)}
                      style={styles.modalInput}
                      mode="outlined"
                      disabled={loading}
                      placeholder="2023-12-31"
                    />
                  </View>

                  <View style={styles.formActions}>
                    <Button 
                      mode="contained" 
                      onPress={handleGenerateReport}
                      style={styles.submitButton}
                      icon="file-pdf"
                      loading={loading || pdfLoading}
                      disabled={loading || pdfLoading}
                      labelStyle={styles.submitButtonLabel}
                    >
                      Generate PDF
                    </Button>
                    <Button 
                      mode="outlined" 
                      onPress={() => {
                        setReportModalVisible(false);
                        resetReportForm();
                      }}
                      style={styles.cancelButton}
                      icon="cancel"
                      disabled={loading}
                      labelStyle={styles.cancelButtonLabel}
                    >
                      Cancel
                    </Button>
                  </View>
                </ScrollView>
              </Card>
            </View>
          </KeyboardAvoidingView>
        </View>
      </RNModal>

      {/* Delete Confirmation Dialogs */}
      <Portal>
        <Dialog 
          visible={deleteDialogVisible} 
          onDismiss={() => setDeleteDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>Are you sure you want to delete this supplier? This action cannot be undone.</Text>
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
              onPress={() => handleDeleteConfirm(false)} 
              style={styles.dialogDeleteButton}
              labelStyle={styles.dialogButtonLabel}
              loading={loading}
              disabled={loading}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog 
          visible={deleteTransactionDialogVisible} 
          onDismiss={() => setDeleteTransactionDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>Are you sure you want to delete this transaction? This action cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => setDeleteTransactionDialogVisible(false)}
              style={styles.dialogCancelButton}
              labelStyle={styles.dialogButtonLabel}
            >
              Cancel
            </Button>
            <Button 
              onPress={() => handleDeleteConfirm(true)} 
              style={styles.dialogDeleteButton}
              labelStyle={styles.dialogButtonLabel}
              loading={loading}
              disabled={loading}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#6a11cb',
    borderRadius: 25,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
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
  suppliersList: {
    paddingBottom: 20,
  },
  supplierCard: {
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
  supplierCardContent: {
    padding: 16,
  },
  supplierInfo: {
    paddingHorizontal: 5,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  balanceContainer: {
    marginBottom: 12,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6a11cb',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  supplierActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  noSuppliersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSuppliersText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  noTransactionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noTransactionsText: {
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
  selectedSupplierHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedSupplierName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectedSupplierBalance: {
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    width: '100%',
    maxHeight: '90%',
  },
  modalContainer: {
    width: '90%',
    margin: 20,
    maxHeight: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    
  },
  modalCard: {
    width: '100%',
    maxHeight: '100%',
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
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 30,
  },
  formSection: {
    marginBottom: 20,
  },
  supplierInfoSection: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 5,
  },
  modalInput: {
    backgroundColor: 'white',
    marginBottom: 12,
  },
  addressInput: {
    minHeight: 80,
  },
  dateInput: {
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountInput: {
    width: '48%',
  },
  picker: {
    backgroundColor: 'white',
    marginBottom: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'gray',
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
  menuContent: {
    backgroundColor: 'white',
    borderRadius: 8,
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
});

export default SupplierManagement;