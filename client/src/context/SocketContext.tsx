// ============================================================
// Socket.io Client Context — Real-time communication
// ============================================================
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BASE } from '../utils/api';

const SOCKET_URL = BASE.replace('/api', '');

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // No token — disconnect if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Already connected with same token
    if (socketRef.current?.connected) return;

    const s = io('SOCKET_URL', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    socketRef.current = s;

    return () => {
      s.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  // Re-connect when token changes (login/logout)
  const reconnect = () => {
    const token = localStorage.getItem('token');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (!token) { setConnected(false); return; }
    const s = io('SOCKET_URL', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    socketRef.current = s;
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      <ReconnectBridge reconnect={reconnect} />
      {children}
    </SocketContext.Provider>
  );
}

// Expose reconnect globally so AppContext can trigger it on login/logout
let _reconnect: (() => void) | null = null;
export function socketReconnect() { _reconnect?.(); }
function ReconnectBridge({ reconnect }: { reconnect: () => void }) {
  useEffect(() => { _reconnect = reconnect; return () => { _reconnect = null; }; }, [reconnect]);
  return null;
}

export function useSocket() {
  return useContext(SocketContext);
}
