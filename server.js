import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React build directory if it exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Also serve the public directory for assets
app.use(express.static(path.join(__dirname, 'public')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow connections from any origin (local network IPs)
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // Increase buffer size for camera frames (10MB)
});

// Single active session state for simple PoC
let activeSession = {
  laptopConnected: false,
  phoneConnected: false,
  copiedItem: null, // Stores the active copied diagram
};

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Register device type
  socket.on('register-device', (type) => {
    socket.deviceType = type;
    if (type === 'laptop') {
      activeSession.laptopConnected = true;
      console.log('Laptop editor registered.');
      io.emit('session-status', activeSession);
    } else if (type === 'phone') {
      activeSession.phoneConnected = true;
      console.log('Phone AR registered.');
      io.emit('session-status', activeSession);
    }
  });

  // Stream camera frames from Phone -> Laptop Editor
  socket.on('camera-stream', (frameData) => {
    // Broadcast to laptop editor client
    socket.broadcast.emit('camera-stream-receive', frameData);
  });

  // Phone notifies that an item has been copied
  socket.on('copy-item', (itemData) => {
    console.log('Item copied by phone:', itemData);
    activeSession.copiedItem = itemData;
    // Broadcast to update state on both ends
    io.emit('item-copied', itemData);
  });

  // Phone triggers paste on Laptop Editor
  socket.on('paste-item', (pasteData) => {
    console.log('Paste command received from phone:', pasteData);
    // Broadcast paste command directly to Laptop Editor
    socket.broadcast.emit('paste-item-trigger', pasteData);
  });

  // Clear copied item state
  socket.on('clear-copied', () => {
    activeSession.copiedItem = null;
    io.emit('item-copied', null);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (socket.deviceType === 'laptop') {
      activeSession.laptopConnected = false;
    } else if (socket.deviceType === 'phone') {
      activeSession.phoneConnected = false;
    }
    io.emit('session-status', activeSession);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Accessible on local network. Check your laptop's IP.`);
  console.log(`====================================================`);
});
