import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const waitingQueue = [];
const activeRooms = new Map();
const userSocketMap = new Map();

function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function tryMatchUsers() {
  while (waitingQueue.length >= 2) {
    const user1 = waitingQueue.shift();
    const user2 = waitingQueue.shift();

    const roomId = generateRoomId();

    activeRooms.set(roomId, {
      users: [user1.userId, user2.userId],
      sockets: [user1.socketId, user2.socketId],
      displayNames: {
        [user1.userId]: user1.displayName,
        [user2.userId]: user2.displayName
      }
    });

    const socket1 = io.sockets.sockets.get(user1.socketId);
    const socket2 = io.sockets.sockets.get(user2.socketId);

    if (socket1 && socket2) {
      socket1.join(roomId);
      socket2.join(roomId);

      socket1.emit('matched', {
        roomId,
        partnerName: user2.displayName
      });

      socket2.emit('matched', {
        roomId,
        partnerName: user1.displayName
      });

      console.log(`Matched users: ${user1.displayName} and ${user2.displayName} in room ${roomId}`);
    }
  }
}

function cleanupRoom(roomId, userId) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  const otherUserId = room.users.find(id => id !== userId);
  const otherSocketId = room.sockets.find(sid => {
    const socket = io.sockets.sockets.get(sid);
    return socket && userSocketMap.get(sid) === otherUserId;
  });

  if (otherSocketId) {
    const otherSocket = io.sockets.sockets.get(otherSocketId);
    if (otherSocket) {
      otherSocket.emit('partner_left');
      otherSocket.leave(roomId);
    }
  }

  activeRooms.delete(roomId);
  console.log(`Cleaned up room ${roomId}`);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async ({ userId, displayName }) => {
    userSocketMap.set(socket.id, userId);
    socket.userId = userId;
    socket.displayName = displayName || 'Stranger';
    
    console.log(`User authenticated: ${socket.displayName} (${userId})`);
  });

  socket.on('find_match', () => {
    const userId = socket.userId;
    const displayName = socket.displayName || 'Stranger';

    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const alreadyInQueue = waitingQueue.some(u => u.userId === userId);
    if (alreadyInQueue) {
      return;
    }

    const currentRoom = Array.from(activeRooms.entries()).find(([_, room]) => 
      room.users.includes(userId)
    );

    if (currentRoom) {
      const [roomId] = currentRoom;
      cleanupRoom(roomId, userId);
    }

    waitingQueue.push({
      userId,
      socketId: socket.id,
      displayName
    });

    socket.emit('searching');
    console.log(`User ${displayName} joined queue. Queue size: ${waitingQueue.length}`);

    tryMatchUsers();
  });

  socket.on('send_message', ({ roomId, message }) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.users.includes(socket.userId)) {
      return;
    }

    socket.to(roomId).emit('receive_message', {
      message,
      senderName: socket.displayName,
      timestamp: Date.now()
    });
  });

  socket.on('next', ({ roomId }) => {
    const userId = socket.userId;
    if (!userId) return;

    cleanupRoom(roomId, userId);

    waitingQueue.push({
      userId,
      socketId: socket.id,
      displayName: socket.displayName || 'Stranger'
    });

    socket.emit('searching');
    console.log(`User ${socket.displayName} clicked next. Queue size: ${waitingQueue.length}`);

    tryMatchUsers();
  });

  socket.on('disconnect', () => {
    const userId = socket.userId;
    
    const queueIndex = waitingQueue.findIndex(u => u.socketId === socket.id);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      console.log(`User removed from queue. Queue size: ${waitingQueue.length}`);
    }

    const currentRoom = Array.from(activeRooms.entries()).find(([_, room]) => 
      room.sockets.includes(socket.id)
    );

    if (currentRoom) {
      const [roomId] = currentRoom;
      cleanupRoom(roomId, userId);
    }

    userSocketMap.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    queueSize: waitingQueue.length,
    activeRooms: activeRooms.size
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
