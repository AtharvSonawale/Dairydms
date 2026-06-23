import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

// Attach token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token'); // ← whatever key you store it under
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;