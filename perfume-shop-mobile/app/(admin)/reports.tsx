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
  Platform,
  TextInput,
  Dimensions
} from 'react-native';
import { 
  Button, 
  Card, 
  Title, 
  Portal,
  Modal,
  DataTable,
  List
} from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Feather, FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

type Report = {
  id: string;
  report_type: 'PURCHASE' | 'PURCHASE_RETURN' | 'SALE' | 'SALE_RETURN';
  format: 'PDF' | 'DOCX' | 'XLSX';
  start_date: string;
  end_date: string;
  store?: string;
  store_name?: string;
  created_by: string;
  created_by_username: string;
  created_at: string;
  file?: string;
};

type Store = {
  id: string;
  name: string;
};

type SummaryData = {
  start_date: string;
  end_date: string;
  gross_purchase: number;
  purchase_return: number;
  net_purchase: number;
  gross_sale: number;
  sale_return: number;
  net_sale: number;
  purchase_total_amount: number;
  sales_total_amount: number;
  purchase_count: number;
  purchase_return_count: number;
  sale_count: number;
  sale_return_count: number;
  net_total: number;
  store_id?: string;
};

type ErrorResponse = {
  detail?: string;
  message?: string;
  [key: string]: any;
};

const ReportsScreen = () => {
  const { user, fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [reportType, setReportType] = useState<'PURCHASE' | 'PURCHASE_RETURN' | 'SALE' | 'SALE_RETURN'>('PURCHASE');
  const [format, setFormat] = useState<'PDF' | 'DOCX' | 'XLSX'>('PDF');
  const [selectedStore, setSelectedStore] = useState<string>('');
  
  // Date states
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(lastDayOfMonth);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Manual date input states
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingEndDate, setEditingEndDate] = useState(false);

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
    fetchStores();
    fetchSummary();
    // Initialize date text
    setStartDateText(formatDateForInput(startDate));
    setEndDateText(formatDateForInput(endDate));
  }, []);

  // Update text when date changes via picker
  useEffect(() => {
    if (!editingStartDate) {
      setStartDateText(formatDateForInput(startDate));
    }
  }, [startDate]);

  useEffect(() => {
    if (!editingEndDate) {
      setEndDateText(formatDateForInput(endDate));
    }
  }, [endDate]);

  const parseDateInput = (text: string): Date | null => {
    const formats = [
      /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/,
      /^(\d{4})[\/-](\d{2})[\/-](\d{2})$/
    ];
    
    for (const format of formats) {
      const match = text.match(format);
      if (match) {
        let month, day, year;
        
        if (match[1].length === 4) {
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1;
          day = parseInt(match[3], 10);
        } else {
          month = parseInt(match[1], 10) - 1;
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        }
        
        if (month >= 0 && month <= 11 && day > 0 && day <= 31 && year >= 2000) {
          const date = new Date(year, month, day);
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
          }
        }
      }
    }
    return null;
  };

  const formatDateForInput = (date: Date): string => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleStartDateTextChange = (text: string) => {
    let formattedText = text.replace(/[^0-9]/g, '');
    if (formattedText.length > 2) {
      formattedText = formattedText.slice(0, 2) + '/' + formattedText.slice(2);
    }
    if (formattedText.length > 5) {
      formattedText = formattedText.slice(0, 5) + '/' + formattedText.slice(5, 9);
    }
    setStartDateText(formattedText);
    
    if (formattedText.length === 10) {
      const parsedDate = parseDateInput(formattedText);
      if (parsedDate) {
        setStartDate(parsedDate);
        if (parsedDate > endDate) {
          setEndDate(new Date(parsedDate));
          setEndDateText(formatDateForInput(parsedDate));
        }
        fetchSummary();
      }
    }
  };

  const handleEndDateTextChange = (text: string) => {
    let formattedText = text.replace(/[^0-9]/g, '');
    if (formattedText.length > 2) {
      formattedText = formattedText.slice(0, 2) + '/' + formattedText.slice(2);
    }
    if (formattedText.length > 5) {
      formattedText = formattedText.slice(0, 5) + '/' + formattedText.slice(5, 9);
    }
    setEndDateText(formattedText);
    
    if (formattedText.length === 10) {
      const parsedDate = parseDateInput(formattedText);
      if (parsedDate) {
        if (parsedDate >= startDate) {
          setEndDate(parsedDate);
          fetchSummary();
        } else {
          Alert.alert('Invalid Date', 'End date must be on or after start date');
        }
      }
    }
  };

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      const newStartDate = new Date(selectedDate);
      setStartDate(newStartDate);
      setStartDateText(formatDateForInput(newStartDate));
      
      if (newStartDate > endDate) {
        setEndDate(new Date(newStartDate));
        setEndDateText(formatDateForInput(newStartDate));
      }
      
      fetchSummary();
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      const newEndDate = new Date(selectedDate);
      
      if (newEndDate >= startDate) {
        setEndDate(newEndDate);
        setEndDateText(formatDateForInput(newEndDate));
        fetchSummary();
      } else {
        Alert.alert('Invalid Date', 'End date must be on or after start date');
      }
    }
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value: number | string): string => {
    return `₹${parseFloat(value as string || '0').toFixed(2)}`;
  };

  const fetchReports = async (): Promise<void> => {
    try {
      setLoading(true);
      let url = '/api/reports/';
      
      if (user?.role === 'STAFF') {
        url += `?created_by=${user.id}`;
      }
      
      const response = await fetchWithAuth(url);
      
      if (response.ok) {
        const data: Report[] = await response.json();
        setReports(data);
      } else {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Could not load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStores = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/stores/');
      
      if (response.ok) {
        const data: Store[] = await response.json();
        setStores(data);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchSummary = async (): Promise<void> => {
    try {
      let url = '/api/reports/summary/';
      const params = new URLSearchParams();
      
      if (selectedStore) {
        params.append('store', selectedStore);
      }
      
      params.append('start_date', startDate.toISOString().split('T')[0]);
      params.append('end_date', endDate.toISOString().split('T')[0]);
      
      const response = await fetchWithAuth(`${url}?${params.toString()}`);
      
      if (response.ok) {
        const data: SummaryData = await response.json();
        setSummaryData(data);
      } else {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch summary data');
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummaryData(null);
    }
  };

  const downloadReport = async (reportId: string): Promise<void> => {
    try {
      setLoading(true);
      
      const reportResponse = await fetchWithAuth(`/api/reports/${reportId}/`);
      const reportData: Report = await reportResponse.json();
      
      if (!reportResponse.ok) {
        const errorData: ErrorResponse = await reportResponse.json();
        throw new Error(errorData.detail || 'Failed to fetch report details');
      }

      const extension = reportData.format.toLowerCase();
      const filename = `report_${reportId}.${extension}`;

      if (Platform.OS === 'web') {
        const response = await fetchWithAuth(`/api/reports/${reportId}/download/`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const downloadUrl = `${process.env.API_BASE_URL || 'https://app-backend-code.onrender.com'}/api/reports/${reportId}/download/`;
        const { uri } = await FileSystem.downloadAsync(
          downloadUrl,
          FileSystem.documentDirectory + filename,
          {
            headers: {
              Authorization: `Bearer ${await getAuthToken()}`,
            },
          }
        );
        await Sharing.shareAsync(uri);
      }
      
      Alert.alert('Success', 'Report downloaded successfully');
    } catch (error: unknown) {
      console.error('Download error:', error);
      const message = error instanceof Error ? error.message : 'Failed to download report';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const reportData = {
        report_type: reportType,
        format: format,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        store: selectedStore || null
      };
      
      const response = await fetchWithAuth('/api/reports/generate/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.detail || 'Failed to generate report');
      }
      
      Alert.alert('Success', 'Report generated successfully');
      fetchReports();
      setShowForm(false);
    } catch (error: unknown) {
      console.error('Error generating report:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate report';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (reportId: string): void => {
    setReportToDelete(reportId);
    setDeleteModalVisible(true);
  };

  const deleteReport = async (): Promise<void> => {
    if (!reportToDelete) return;
    
    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/reports/${reportToDelete}/`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Report deleted successfully');
        fetchReports();
      } else {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.detail || 'Failed to delete report');
      }
    } catch (error: unknown) {
      console.error('Error deleting report:', error);
      Alert.alert('Error', 'Failed to delete report');
    } finally {
      setLoading(false);
      setDeleteModalVisible(false);
      setReportToDelete(null);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    const token = await AsyncStorage.getItem('authToken');
    return token || '';
  };

  const onRefresh = (): void => {
    setRefreshing(true);
    fetchReports();
    fetchSummary();
  };

  const renderDateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      <View style={styles.dateInputContainer}>
        <TextInput
          style={styles.dateInput}
          value={startDateText}
          onChangeText={handleStartDateTextChange}
          placeholder="MM/DD/YYYY"
          keyboardType="numeric"
          maxLength={10}
          onFocus={() => {
            setEditingStartDate(true);
            setShowStartPicker(false);
          }}
          onBlur={() => setEditingStartDate(false)}
        />
        <TouchableOpacity 
          onPress={() => {
            setShowStartPicker(true);
            setEditingStartDate(false);
          }}
          style={styles.calendarButton}
        >
          <Feather name="calendar" size={20} color="#5E72E4" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.dateSeparator}>to</Text>
      
      <View style={styles.dateInputContainer}>
        <TextInput
          style={styles.dateInput}
          value={endDateText}
          onChangeText={handleEndDateTextChange}
          placeholder="MM/DD/YYYY"
          keyboardType="numeric"
          maxLength={10}
          onFocus={() => {
            setEditingEndDate(true);
            setShowEndPicker(false);
          }}
          onBlur={() => setEditingEndDate(false)}
        />
        <TouchableOpacity 
          onPress={() => {
            setShowEndPicker(true);
            setEditingEndDate(false);
          }}
          style={styles.calendarButton}
        >
          <Feather name="calendar" size={20} color="#5E72E4" />
        </TouchableOpacity>
      </View>
      
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleStartDateChange}
          maximumDate={new Date()}
        />
      )}
      
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={startDate}
          maximumDate={new Date()}
        />
      )}
    </View>
  );

  const getReportTypeIcon = (type: string) => {
    switch(type) {
      case 'PURCHASE':
        return { icon: 'shopping-cart' as const, color: '#4C51BF' };
      case 'PURCHASE_RETURN':
        return { icon: 'assignment-return' as const, color: '#9F7AEA' };
      case 'SALE':
        return { icon: 'point-of-sale' as const, color: '#38B2AC' };
      case 'SALE_RETURN':
        return { icon: 'assignment-returned' as const, color: '#F687B3' };
      default:
        return { icon: 'description' as const, color: '#718096' };
    }
  };

  if (loading && !showForm && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E72E4" />
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Reports Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        
        {!showForm && user?.role === 'ADMIN' && (
          <TouchableOpacity 
            style={styles.newReportButton}
            onPress={() => setShowForm(true)}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.newReportButtonText}>New Report</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#5E72E4"
          />
        }
      >
        <Portal>
          <Modal 
            visible={deleteModalVisible} 
            onDismiss={() => setDeleteModalVisible(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <Text style={styles.modalTitle}>Confirm Delete</Text>
            <Text style={styles.modalText}>Are you sure you want to delete this report?</Text>
            <View style={styles.modalButtons}>
              <Button 
                mode="outlined" 
                onPress={() => setDeleteModalVisible(false)}
                style={styles.modalCancelButton}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={deleteReport}
                style={styles.modalDeleteButton}
                labelStyle={styles.buttonText}
              >
                Delete
              </Button>
            </View>
          </Modal>
        </Portal>

        {!showForm ? (
          <View style={styles.contentContainer}>
            {/* Summary Card */}
            <Card style={styles.summaryCard}>
              <Card.Content>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Period Summary</Text>
                  {renderDateRangeSelector()}
                </View>
                
                {!summaryData ? (
                  <View style={styles.emptySummary}>
                    <Feather name="bar-chart-2" size={40} color="#CBD5E0" />
                    <Text style={styles.emptySummaryText}>
                      No data available for this period
                    </Text>
                  </View>
                ) : (
                  <View style={styles.summaryGrid}>
                    {/* Gross Purchases */}
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Gross Purchases</Text>
                      <Text style={styles.summaryValue}>{summaryData.purchase_count}</Text>
                      <Text style={styles.summaryAmount}>{formatCurrency(summaryData.gross_purchase)}</Text>
                    </View>

                     {/* Gross Sales */}
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Gross Sales</Text>
                      <Text style={styles.summaryValue}></Text>
                      <Text style={styles.summaryAmount}>
                        {formatCurrency(summaryData.net_sale)}
                      </Text>
                    </View>
                    
                    {/* Purchase Returns */}
                    <View style={[styles.summaryItem, styles.returnItem]}>
                      <Text style={styles.summaryLabel}>Purchase Returns</Text>
                      <Text style={styles.summaryValue}>{summaryData.purchase_return_count}</Text>
                      <Text style={[styles.summaryAmount, styles.returnAmount]}>
                        {formatCurrency(summaryData.purchase_return)}
                      </Text>
                    </View>

                    {/* Sale Returns */}
                    <View style={[styles.summaryItem, styles.returnItem]}>
                      <Text style={styles.summaryLabel}>Sale Returns</Text>
                      <Text style={styles.summaryValue}>{summaryData.sale_return_count}</Text>
                      <Text style={[styles.summaryAmount, styles.returnAmount]}>
                        {formatCurrency(summaryData.sale_return)}
                      </Text>
                    </View>
                    
                   
                    
                    
                  
                    
                    {/* Purchase Total Amount */}
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Purchase Total Amount</Text>
                      <Text style={styles.summaryValue}></Text>
                      <Text style={styles.summaryAmount}>
                        {formatCurrency(summaryData.purchase_total_amount)}
                      </Text>
                    </View>
                    
                    {/* Sales Total Amount */}
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Sales Total Amount</Text>
                      <Text style={styles.summaryValue}></Text>
                      <Text style={styles.summaryAmount}>
                        {formatCurrency(summaryData.sales_total_amount)}
                      </Text>
                    </View>
                    
                    {/* Net Total */}
                    <View style={[styles.summaryItem, styles.netItem]}>
                      <Text style={styles.summaryLabel}>Net Total</Text>
                      <Text style={styles.summaryValue}>-</Text>
                      <Text style={[styles.summaryAmount, styles.netAmount]}>
                        {formatCurrency(summaryData.net_total)}
                      </Text>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Reports List */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Generated Reports</Text>
              <Text style={styles.sectionCount}>{reports.length} reports</Text>
            </View>

            {reports.length > 0 ? (
              <View style={styles.reportsList}>
                {reports.map(report => {
                  const { icon, color } = getReportTypeIcon(report.report_type);
                  return (
                    <Card key={report.id} style={styles.reportCard}>
                      <Card.Content>
                        <View style={styles.reportHeader}>
                          <View style={[styles.reportTypeBadge, { backgroundColor: color }]}>
                            <MaterialIcons 
                              name={icon} 
                              size={16} 
                              color="#fff" 
                            />
                            <Text style={styles.reportTypeText}>
                              {report.report_type === 'PURCHASE' ? 'Purchase' : 
                               report.report_type === 'PURCHASE_RETURN' ? 'Purchase Return' : 
                               report.report_type === 'SALE' ? 'Sale' : 'Sale Return'}
                            </Text>
                          </View>
                          <Text style={styles.reportFormatBadge}>
                            {report.format}
                          </Text>
                        </View>
                        
                        <Text style={styles.reportDate}>
                          {formatDisplayDate(new Date(report.start_date))} - {formatDisplayDate(new Date(report.end_date))}
                        </Text>
                        
                        {report.store_name && (
                          <View style={styles.reportStore}>
                            <Feather name="shopping-bag" size={14} color="#718096" />
                            <Text style={styles.reportStoreText}>{report.store_name}</Text>
                          </View>
                        )}
                        
                        <View style={styles.reportFooter}>
                          <View style={styles.reportCreator}>
                            <FontAwesome name="user-circle-o" size={14} color="#718096" />
                            <Text style={styles.reportCreatorText}>{report.created_by_username}</Text>
                            <Text style={styles.reportTimeText}>
                              {new Date(report.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Text>
                          </View>
                          
                          <View style={styles.reportActions}>
                            <TouchableOpacity 
                              style={styles.downloadButton}
                              onPress={() => downloadReport(report.id)}
                              disabled={loading}
                            >
                              <Feather name="download" size={18} color="#5E72E4" />
                            </TouchableOpacity>
                            
                            {user?.role === 'ADMIN' && (
                              <TouchableOpacity 
                                style={styles.deleteButton}
                                onPress={() => confirmDelete(report.id)}
                                disabled={loading}
                              >
                                <Feather name="trash-2" size={18} color="#F56565" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyReports}>
                <Feather name="file-text" size={48} color="#CBD5E0" />
                <Text style={styles.emptyReportsText}>No reports generated yet</Text>
                <Text style={styles.emptyReportsSubtext}>
                  Create your first report by clicking the "New Report" button
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            {/* Form Header */}
            <View style={styles.formHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setShowForm(false)}
              >
                <Feather name="arrow-left" size={24} color="#4A5568" />
              </TouchableOpacity>
              <Text style={styles.formTitle}>Generate New Report</Text>
            </View>
            
            {/* Form Content */}
            <Card style={styles.formCard}>
              <Card.Content>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Report Type</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={reportType}
                      onValueChange={(itemValue) => {
                        setReportType(itemValue);
                        fetchSummary();
                      }}
                      style={styles.picker}
                      dropdownIconColor="#5E72E4"
                    >
                      <Picker.Item label="Purchase Report" value="PURCHASE" />
                      <Picker.Item label="Purchase Return Report" value="PURCHASE_RETURN" />
                      <Picker.Item label="Sale Report" value="SALE" />
                      <Picker.Item label="Sale Return Report" value="SALE_RETURN" />
                    </Picker>
                  </View>
                </View>

                {user?.role === 'ADMIN' && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Store (Optional)</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedStore}
                        onValueChange={(itemValue) => {
                          setSelectedStore(itemValue);
                          fetchSummary();
                        }}
                        style={styles.picker}
                        dropdownIconColor="#5E72E4"
                      >
                        <Picker.Item label="All Stores" value="" />
                        {stores.map(store => (
                          <Picker.Item key={store.id} label={store.name} value={store.id.toString()} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Date Range</Text>
                  {renderDateRangeSelector()}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Format</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={format}
                      onValueChange={(itemValue) => setFormat(itemValue)}
                      style={styles.picker}
                      dropdownIconColor="#5E72E4"
                    >
                      <Picker.Item label="PDF Document" value="PDF" />
                      <Picker.Item label="Word (DOCX)" value="DOCX" />
                      <Picker.Item label="Excel (XLSX)" value="XLSX" />
                    </Picker>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.generateButton}
                  onPress={generateReport}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="file-plus" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>Generate Report</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Card.Content>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 24,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#5E72E4',
  },
  headerContent: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  newReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  newReportButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
  },
  summaryCard: {
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  dateInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#4A5568',
    paddingVertical: 12,
  },
  calendarButton: {
    padding: 8,
  },
  dateSeparator: {
    marginHorizontal: 8,
    fontSize: 14,
    color: '#718096',
  },
  emptySummary: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySummaryText: {
    marginTop: 8,
    color: '#A0AEC0',
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  returnItem: {
    backgroundColor: '#FFF5F5',
  },
  netItem: {
    width: '100%',
    backgroundColor: '#F0F5FF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#48BB78',
  },
  returnAmount: {
    color: '#F56565',
  },
  netAmount: {
    color: '#5E72E4',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  sectionCount: {
    fontSize: 14,
    color: '#718096',
  },
  reportsList: {
    marginBottom: 24,
  },
  reportCard: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  reportTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  reportFormatBadge: {
    fontSize: 12,
    color: '#718096',
    backgroundColor: '#EDF2F7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  reportDate: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 8,
  },
  reportStore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportStoreText: {
    fontSize: 13,
    color: '#718096',
    marginLeft: 6,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    paddingTop: 12,
  },
  reportCreator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportCreatorText: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 6,
    marginRight: 8,
  },
  reportTimeText: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  reportActions: {
    flexDirection: 'row',
  },
  downloadButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyReports: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyReportsText: {
    fontSize: 16,
    color: '#4A5568',
    marginTop: 12,
  },
  emptyReportsSubtext: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  formContainer: {
    padding: 16,
    paddingTop: 24,
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
    fontSize: 22,
    fontWeight: '600',
    color: '#2D3748',
  },
  formCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    backgroundColor: '#fff',
    color: '#2D3748',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5E72E4',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 24,
    margin: 24,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2D3748',
  },
  modalText: {
    fontSize: 15,
    marginBottom: 24,
    color: '#4A5568',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    marginRight: 12,
    borderColor: '#E2E8F0',
  },
  modalDeleteButton: {
    backgroundColor: '#F56565',
  },
  buttonText: {
    color: 'white',
  },
});

export default ReportsScreen;