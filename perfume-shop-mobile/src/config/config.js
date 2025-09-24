// Configuration for API endpoints
const DEV_API_URL = 'http://localhost:8000/api';
const DOCKER_API_URL = 'http://backend:8000/api';
const PROD_API_URL = 'https://your-production-url.com/api';

// Use environment variables or default to development URL
export const API_URL = process.env.REACT_APP_API_URL ||
                       process.env.EXPO_PUBLIC_API_URL ||
                       (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                        ? DEV_API_URL
                        : PROD_API_URL);

export const config = {
  API_URL,
  // Add other configuration options here
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
};