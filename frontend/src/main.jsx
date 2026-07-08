import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { registerMapServiceWorker } from './utils/offlineMap.js';
import './styles/index.css';

// Registers the service worker that caches map tiles for offline use during
// connectivity loss (see utils/offlineMap.js and public/sw.js). Safe to call
// even in browsers without service worker support — it just no-ops there.
registerMapServiceWorker();

// A single shared React Query client for the whole app — handles caching,
// deduping, and background refetching of every GET request we make.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
