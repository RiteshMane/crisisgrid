// -----------------------------------------------------------------------------
// SocketContext.jsx — one Socket.IO client shared across the app so every
// dashboard/page can subscribe to real-time events (incident:new,
// incident:update, facility:update, ...) without opening duplicate sockets.
// -----------------------------------------------------------------------------

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/axiosClient';

const SocketContext = createContext(null);

// Socket.IO connects to the server root, not the /api prefix.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
  // Kept in state (not a ref) so consumers re-render once the socket exists
  // and once the connection status flips — a ref alone wouldn't trigger that.
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, { withCredentials: true, autoConnect: true });
    setSocket(socketInstance);

    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
}
