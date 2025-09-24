import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { DataTable, Button, TextInput, Modal, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';

type PrivilegeCard = {
  id: number;
  card_type: string;
  discount_percentage: number;
};

type Customer = {
  id: number;
  customer_id: string;
  name: string;
  address: string;
  place: string;
  pin_code: string;
  email: string;
  phone: string;
  privilege_card: number | null;
  privilege_card_details?: PrivilegeCard;
};

const CustomerEntry = () => {
  const { user, fetchWithAuth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [privilegeCards, setPrivilegeCards] = useState<PrivilegeCard[]>([]);
  const [showPrivilegeModal, setShowPrivilegeModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<number | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [place, setPlace] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPrivilegeCard, setSelectedPrivilegeCard] = useState<PrivilegeCard | null>(null);

  // Fetch privilege cards
  useEffect(() => {
    const fetchPrivilegeCards = async () => {
      try {
        const response = await fetchWithAuth('/api/customers-privilege/privilege-cards/');
        const data = await response.json();
        setPrivilegeCards(data);
      } catch (error) {
        console.error('Error fetching privilege cards:', error);
        Alert.alert('Error', 'Failed to fetch privilege cards');
      }
    };
    fetchPrivilegeCards();
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetchWithAuth('/api/customers-privilege/customers/');
        const data: Customer[] = await response.json();
        setCustomers(data);
      } catch (error) {
        console.error('Error fetching customers:', error);
        Alert.alert('Error', 'Failed to fetch customers');
      }
    };
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setName('');
    setAddress('');
    setPlace('');
    setPinCode('');
    setEmail('');
    setPhone('');
    setSelectedPrivilegeCard(null);
    setEditingCustomer(null);
    setShowAddForm(false);
  };

  const handleSubmit = async () => {
    if (!name || !address || !place || !pinCode || !email || !phone) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const customerData = {
        name,
        address,
        place,
        pin_code: pinCode,
        email,
        phone,
        privilege_card: selectedPrivilegeCard?.id || null
      };

      let response;
      if (editingCustomer) {
        response = await fetchWithAuth(`/api/customers-privilege/customers/${editingCustomer.id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData)
        });
      } else {
        response = await fetchWithAuth('/api/customers-privilege/customers/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(customerData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save customer');
      }

      const updatedCustomer: Customer = await response.json();
      
      if (editingCustomer) {
        setCustomers(customers.map(c => 
          c.id === updatedCustomer.id ? updatedCustomer : c
        ));
      } else {
        setCustomers([updatedCustomer, ...customers]);
      }

      Alert.alert('Success', `Customer ${editingCustomer ? 'updated' : 'added'} successfully`);
      resetForm();
    } catch (error: unknown) {
      let errorMessage = 'Failed to save customer';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      console.error('Error saving customer:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setAddress(customer.address);
    setPlace(customer.place);
    setPinCode(customer.pin_code);
    setEmail(customer.email);
    setPhone(customer.phone);
    setSelectedPrivilegeCard(
      customer.privilege_card 
        ? privilegeCards.find(c => c.id === customer.privilege_card) || null
        : null
    );
    setShowAddForm(true);
  };

  const handleDelete = (customerId: number) => {
    setCustomerToDelete(customerId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/customers-privilege/customers/${customerToDelete}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCustomers(customers.filter(c => c.id !== customerToDelete));
        Alert.alert('Success', 'Customer deleted successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete customer');
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to delete customer';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      console.error('Error deleting customer:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
    }
  };

  const downloadCard = async (customerId: number) => {
    try {
      setPdfLoading(true);
      
      const response = await fetchWithAuth(`/api/customers-privilege/customers/${customerId}/download_card/`);
      
      if (!response.ok) {
        throw new Error('Failed to download card');
      }

      // For web
      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `privilege_card_${customerId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } 
      // For Android/iOS
      else {
        // Get the base64 string of the PDF
        const pdfData = await response.blob();
        const reader = new FileReader();
        
        reader.onload = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (!base64data) throw new Error('Failed to read PDF data');
          
          const fileName = `privilege_card_${customerId}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          // Write the file
          await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Share the file (this will allow user to save or open)
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download Privilege Card',
            UTI: 'com.adobe.pdf',
          });
        };
        
        reader.onerror = () => {
          throw new Error('Failed to read file');
        };
        
        reader.readAsDataURL(pdfData);
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to download customer card';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      console.error('Error downloading card:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadPdfToDevice = async () => {
    if (!pdfUri) return;
    
    try {
      setPdfDownloading(true);
      
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = pdfUri;
        link.download = `privilege_card_${editingCustomer?.customer_id || 'new'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const downloadResumable = FileSystem.createDownloadResumable(
          pdfUri,
          FileSystem.documentDirectory + `privilege_card_${editingCustomer?.customer_id || 'new'}.pdf`,
          {}
        );

        const result = await downloadResumable.downloadAsync();
        
        if (!result) {
          throw new Error('Download failed');
        }

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
            dialogTitle: 'Privilege Card',
            UTI: 'com.adobe.pdf',
          });
        }
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to download PDF';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', errorMessage);
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
          dialogTitle: 'Share Privilege Card',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error: unknown) {
      let errorMessage = 'Failed to share PDF';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6a11cb', '#2575fc']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Customer Management</Text>
          <Text style={styles.headerSubtitle}>
            {editingCustomer ? `Editing: ${editingCustomer.customer_id}` : 
             showAddForm ? 'Add New Customer' : 'Customer List'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!showAddForm ? (
          <View style={styles.section}>
            <View style={styles.addButtonContainer}>
              <Button 
                mode="contained" 
                onPress={handleAddNew}
                style={styles.addButton}
                icon="plus"
              >
                Add Customer
              </Button>
            </View>
            
            <Text style={styles.sectionTitle}>Customer List</Text>
            
            {customers.length > 0 ? (
              <DataTable style={styles.table}>
                <DataTable.Header>
                  <DataTable.Title>ID</DataTable.Title>
                  <DataTable.Title>Name</DataTable.Title>
                  <DataTable.Title>Card</DataTable.Title>
                  <DataTable.Title>Actions</DataTable.Title>
                </DataTable.Header>
                
                {customers.map((customer) => (
                  <DataTable.Row key={customer.id}>
                    <DataTable.Cell>{customer.customer_id}</DataTable.Cell>
                    <DataTable.Cell>{customer.name}</DataTable.Cell>
                    <DataTable.Cell>
                      {customer.privilege_card_details 
                        ? `${customer.privilege_card_details.card_type} (${customer.privilege_card_details.discount_percentage}%)`
                        : 'None'}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.actionsCell}>
                      <TouchableOpacity onPress={() => handleEdit(customer)}>
                        <MaterialIcons name="edit" size={20} color="#2196F3" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => downloadCard(customer.id)}>
                        <MaterialIcons name="picture-as-pdf" size={20} color="#4CAF50" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(customer.id)}>
                        <MaterialIcons name="delete" size={20} color="#F44336" />
                      </TouchableOpacity>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            ) : (
              <Text style={styles.noItemsText}>No customers found</Text>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </Text>
            
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label="Address"
              value={address}
              onChangeText={setAddress}
              style={styles.input}
              mode="outlined"
              multiline
            />
            
            <View style={styles.row}>
              <TextInput
                label="Place"
                value={place}
                onChangeText={setPlace}
                style={styles.halfInput}
                mode="outlined"
              />
              <TextInput
                label="Pin Code"
                value={pinCode}
                onChangeText={setPinCode}
                style={styles.halfInput}
                mode="outlined"
                keyboardType="numeric"
              />
            </View>
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
            />
            
            <TextInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              mode="outlined"
              keyboardType="phone-pad"
            />
            
            <TouchableOpacity 
              onPress={() => setShowPrivilegeModal(true)}
              style={styles.privilegeCardButton}
            >
              <Text style={styles.privilegeCardButtonText}>
                {selectedPrivilegeCard 
                  ? `${selectedPrivilegeCard.card_type} (${selectedPrivilegeCard.discount_percentage}%)`
                  : 'Select Privilege Card'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.buttonGroup}>
              <Button 
                mode="contained" 
                onPress={handleSubmit}
                style={styles.submitButton}
                loading={loading}
                disabled={loading}
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </Button>
              
              <Button 
                mode="outlined" 
                onPress={() => setShowAddForm(false)}
                style={styles.cancelButton}
                disabled={loading}
              >
                Back to List
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Privilege Card Selection Modal */}
      <Portal>
        <Modal 
          visible={showPrivilegeModal} 
          onDismiss={() => setShowPrivilegeModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Privilege Card</Text>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            {privilegeCards.map(card => (
              <TouchableOpacity
                key={card.id}
                onPress={() => {
                  setSelectedPrivilegeCard(card);
                  setShowPrivilegeModal(false);
                }}
                style={styles.cardItem}
              >
                <Text style={styles.cardItemName}>{card.card_type}</Text>
                <Text style={styles.cardItemDetail}>Discount: {card.discount_percentage}%</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Button 
            mode="outlined" 
            onPress={() => setShowPrivilegeModal(false)}
            style={styles.modalCloseButton}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this customer?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={confirmDelete} style={styles.deleteButton}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* PDF Viewer Modal */}
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
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'column',
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  addButtonContainer: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#6a11cb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  halfInput: {
    flex: 1,
    backgroundColor: 'white',
    marginRight: 8,
  },
  privilegeCardButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 15,
    marginBottom: 12,
  },
  privilegeCardButtonText: {
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  submitButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#6a11cb',
  },
  cancelButton: {
    flex: 1,
  },
  table: {
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
  },
  actionsCell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 100,
  },
  noItemsText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
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
    maxHeight: 400,
    paddingHorizontal: 16,
  },
  cardItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cardItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardItemDetail: {
    fontSize: 14,
    color: '#666',
  },
  modalCloseButton: {
    margin: 16,
  },
  deleteButton: {
    backgroundColor: '#f44336',
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
});

export default CustomerEntry;