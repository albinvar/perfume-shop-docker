import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/config';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/token/', { username, password });
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/register/', userData);
    return response.data;
  },
  refreshToken: async (refreshToken) => {
    const response = await api.post('/token/refresh/', { refresh: refreshToken });
    return response.data;
  },
};

// Product API calls
export const productAPI = {
  getProducts: async () => {
    const response = await api.get('/products/');
    return response.data;
  },
  createProduct: async (productData) => {
    const response = await api.post('/products/', productData);
    return response.data;
  },
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}/`, productData);
    return response.data;
  },
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}/`);
    return response.data;
  },
};

// Purchase API calls
export const purchaseAPI = {
  getPurchases: async () => {
    const response = await api.get('/purchases/');
    return response.data;
  },
  createPurchase: async (purchaseData) => {
    const response = await api.post('/purchases/', purchaseData);
    return response.data;
  },
  updatePurchase: async (id, purchaseData) => {
    const response = await api.put(`/purchases/${id}/`, purchaseData);
    return response.data;
  },
  deletePurchase: async (id) => {
    const response = await api.delete(`/purchases/${id}/`);
    return response.data;
  },
};

// Sales API calls
export const salesAPI = {
  getSales: async () => {
    const response = await api.get('/sales/');
    return response.data;
  },
  createSale: async (saleData) => {
    const response = await api.post('/sales/', saleData);
    return response.data;
  },
  updateSale: async (id, saleData) => {
    const response = await api.put(`/sales/${id}/`, saleData);
    return response.data;
  },
  deleteSale: async (id) => {
    const response = await api.delete(`/sales/${id}/`);
    return response.data;
  },
};

// Staff API calls
export const staffAPI = {
  getStaff: async () => {
    const response = await api.get('/accounts/');
    return response.data;
  },
  createStaff: async (staffData) => {
    const response = await api.post('/accounts/', staffData);
    return response.data;
  },
  updateStaff: async (id, staffData) => {
    const response = await api.put(`/accounts/${id}/`, staffData);
    return response.data;
  },
  deleteStaff: async (id) => {
    const response = await api.delete(`/accounts/${id}/`);
    return response.data;
  },
};

// Reports API calls
export const reportsAPI = {
  getSalesReport: async (startDate, endDate) => {
    const response = await api.get('/reports/sales/', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
  getPurchaseReport: async (startDate, endDate) => {
    const response = await api.get('/reports/purchases/', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
  getInventoryReport: async () => {
    const response = await api.get('/reports/inventory/');
    return response.data;
  },
  getProfitLossReport: async (startDate, endDate) => {
    const response = await api.get('/reports/profit-loss/', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
};

export default api; 