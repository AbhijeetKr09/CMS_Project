import axios from 'axios';

// Base URL points to server root so both /api/* and /cms/* routes work.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: SERVER_URL,
});

// Keep a second instance with /api prefix for backward-compat if needed elsewhere
export const apiV1 = axios.create({
    baseURL: `${SERVER_URL}/api`,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('cms_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('cms_token');
            localStorage.removeItem('cms_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
