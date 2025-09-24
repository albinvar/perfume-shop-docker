import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { DataTable, Button, TextInput, Modal, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';

// Define types for privilege card
type PrivilegeCard = {
  id: number;
  card_type: string;
  discount_percentage: number;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
};

type CardTypeOption = {
  label: string;
  value: string;
};

const PrivilegeCardManagement = () => {
  const { user, fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [privilegeCards, setPrivilegeCards] = useState<PrivilegeCard[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<PrivilegeCard | null>(null);
  const [cardType, setCardType] = useState('BASIC');
  const [discountPercentage, setDiscountPercentage] = useState('');

  const cardTypes: CardTypeOption[] = [
    { label: 'Premium', value: 'PREMIUM' },
    { label: 'Standard', value: 'STANDARD' },
    { label: 'Basic', value: 'BASIC' },
  ];

  const fetchPrivilegeCards = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/customers-privilege/privilege-cards/');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: PrivilegeCard[] = await response.json();
      setPrivilegeCards(data);
    } catch (error: unknown) {
      console.error('Error fetching privilege cards:', error);
      Alert.alert('Error', 'Failed to fetch privilege cards. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivilegeCards();
  }, []);

  const resetForm = () => {
    setCardType('BASIC');
    setDiscountPercentage('');
    setEditingCard(null);
  };

  const handleSubmit = async () => {
    const discountValue = parseInt(discountPercentage);
    if (!discountPercentage || isNaN(discountValue) || 
        discountValue <= 0 || discountValue > 100) {
      Alert.alert('Error', 'Please enter a valid discount percentage (1-100)');
      return;
    }

    try {
      setLoading(true);
      
      const cardData = {
        card_type: cardType,
        discount_percentage: discountValue
      };

      let response;
      if (editingCard) {
        response = await fetchWithAuth(`/api/customers-privilege/privilege-cards/${editingCard.id}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cardData)
        });
      } else {
        const exists = privilegeCards.some(card => card.card_type === cardType);
        if (exists) {
          throw new Error('This card type already exists');
        }

        response = await fetchWithAuth('/api/customers-privilege/privilege-cards/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cardData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save privilege card');
      }

      const savedCard: PrivilegeCard = await response.json();
      
      if (editingCard) {
        setPrivilegeCards(privilegeCards.map(c => 
          c.id === savedCard.id ? savedCard : c
        ));
      } else {
        setPrivilegeCards([savedCard, ...privilegeCards]);
      }

      Alert.alert('Success', `Privilege card ${editingCard ? 'updated' : 'added'} successfully`);
      resetForm();
    } catch (error: unknown) {
      console.error('Error saving privilege card:', error);
      let errorMessage = 'Failed to save privilege card';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (card: PrivilegeCard) => {
    setEditingCard(card);
    setCardType(card.card_type);
    setDiscountPercentage(card.discount_percentage.toString());
  };

  const handleDelete = (cardId: number) => {
    setCardToDelete(cardId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!cardToDelete) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth(`/api/customers-privilege/privilege-cards/${cardToDelete}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPrivilegeCards(privilegeCards.filter(c => c.id !== cardToDelete));
        Alert.alert('Success', 'Privilege card deleted successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete privilege card');
      }
    } catch (error: unknown) {
      console.error('Error deleting privilege card:', error);
      let errorMessage = 'Failed to delete privilege card';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
      setCardToDelete(null);
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
          <Text style={styles.headerTitle}>Privilege Card Management</Text>
          <Text style={styles.headerSubtitle}>
            {editingCard ? `Editing: ${editingCard.card_type}` : 'Add New Card'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Information</Text>
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={cardType}
              onValueChange={(itemValue) => setCardType(itemValue)}
              style={styles.picker}
              enabled={!editingCard}
            >
              {cardTypes.map(type => (
                <Picker.Item 
                  key={type.value} 
                  label={type.label} 
                  value={type.value} 
                />
              ))}
            </Picker>
          </View>
          
          <TextInput
            label="Discount Percentage (1-100)"
            value={discountPercentage}
            onChangeText={setDiscountPercentage}
            style={styles.input}
            mode="outlined"
            keyboardType="numeric"
          />
          
          <View style={styles.buttonGroup}>
            <Button 
              mode="contained" 
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={loading}
              disabled={loading}
            >
              {editingCard ? 'Update Card' : 'Add Card'}
            </Button>
            
            {editingCard && (
              <Button 
                mode="outlined" 
                onPress={resetForm}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privilege Cards</Text>
          
          {privilegeCards.length > 0 ? (
            <DataTable style={styles.table}>
              <DataTable.Header>
                <DataTable.Title>Card Type</DataTable.Title>
                <DataTable.Title numeric>Discount</DataTable.Title>
                <DataTable.Title>Actions</DataTable.Title>
              </DataTable.Header>
              
              {privilegeCards.map((card) => (
                <DataTable.Row key={card.id}>
                  <DataTable.Cell>{card.card_type}</DataTable.Cell>
                  <DataTable.Cell numeric>{card.discount_percentage}%</DataTable.Cell>
                  <DataTable.Cell style={styles.actionsCell}>
                    <TouchableOpacity onPress={() => handleEdit(card)}>
                      <MaterialIcons name="edit" size={20} color="#2196F3" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(card.id)}>
                      <MaterialIcons name="delete" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          ) : (
            <Text style={styles.noItemsText}>No privilege cards found</Text>
          )}
        </View>
      </ScrollView>
      
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this privilege card?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={confirmDelete} style={styles.deleteButton}>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
  },
  picker: {
    width: '100%',
    height: 56,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
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
    justifyContent: 'space-around',
    width: 80,
  },
  noItemsText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
});

export default PrivilegeCardManagement;