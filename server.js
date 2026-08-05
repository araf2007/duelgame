import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const rooms = {};

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createMatch', () => {
        let code = generateCode();
        while (rooms[code]) {
            code = generateCode();
        }
        
        rooms[code] = {
            host: socket.id,
            guest: null
        };
        
        socket.join(code);
        socket.emit('matchCreated', code);
    });

    socket.on('joinMatch', (code) => {
        code = code.toUpperCase();
        const room = rooms[code];
        
        if (room) {
            if (!room.guest) {
                room.guest = socket.id;
                socket.join(code);
                socket.emit('joinSuccess', code);
                
                io.to(code).emit('startGame', {
                    hostId: room.host,
                    guestId: room.guest
                });
            } else {
                socket.emit('joinError', 'Room is full.');
            }
        } else {
            socket.emit('joinError', 'Invalid match code.');
        }
    });

    socket.on('syncState', (data) => {
        // Host broadcasts the authoritative game state to the room
        socket.to(data.roomCode).emit('syncState', data);
    });
    
    socket.on('sendInput', (data) => {
        // Guest sends their input state to the Host
        socket.to(data.roomCode).emit('guestInput', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const code in rooms) {
            const room = rooms[code];
            if (room.host === socket.id || room.guest === socket.id) {
                io.to(code).emit('opponentDisconnected');
                delete rooms[code];
            }
        }
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO Server running on port ${PORT}`);
});
