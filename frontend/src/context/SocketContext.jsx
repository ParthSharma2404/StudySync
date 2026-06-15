import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children, user }) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    // Determine the backend URL based on environment.
    // Assuming backend runs on port 5000 in development
    const backendUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:5000';

    const newSocket = io(backendUrl, {
      withCredentials: true
    });

    socketRef.current = newSocket;
    
    // We only set the socket state once it connects, so children know it's ready
    newSocket.on('connect', () => {
      newSocket.emit('identify', { userId: user.id, username: user.username });
      setSocket(newSocket);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
