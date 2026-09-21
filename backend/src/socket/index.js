const { Server } = require('socket.io');
let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: true }
  });

  // videoRooms: { roomId: { socketId: { socketId, userId, userName } } }
  // Using object (not array) so each socketId is unique by definition
  const videoRooms = {};

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── Notification room ──────────────────────────────────────────────────
    socket.on('join_room', (userId) => {
      socket.join(userId);
    });

    // ── Event chat ─────────────────────────────────────────────────────────
    socket.on('join_event', (eventId) => socket.join(`event_${eventId}`));
    socket.on('leave_event', (eventId) => socket.leave(`event_${eventId}`));
    socket.on('send_message', (data) => {
      io.to(`event_${data.eventId}`).emit('new_message', data);
    });

    // ── Video: join room ───────────────────────────────────────────────────
    socket.on('video_join', async ({ roomId, userId, userName }) => {
      console.log(`[VIDEO] ${userName} (${socket.id}) joining room: ${roomId}`);

      // Server-side gate: a client with a stale page (or someone pasting a
      // room URL directly) must not be able to enter a meeting whose window
      // has closed. The UI check is cosmetic; this is the enforcement.
      try {
        const Meeting = require('../models/Meeting');
        const meeting = await Meeting.findOne({ roomId });

        if (!meeting) {
          socket.emit('video_join_denied', { reason: 'Meeting not found.' });
          return;
        }

        if (meeting.shouldExpire()) {
          meeting.status = 'expired';
          await meeting.save();
        }

        if (!meeting.isJoinable()) {
          console.log(`[VIDEO] Denied join to ${roomId} (status: ${meeting.status})`);
          socket.emit('video_join_denied', {
            reason: meeting.status === 'expired'
              ? 'This meeting has ended and can no longer be joined.'
              : 'This meeting is not available to join.',
            status: meeting.status,
          });
          return;
        }
      } catch (err) {
        console.error('[VIDEO] Join check failed:', err.message);
        socket.emit('video_join_denied', { reason: 'Could not verify this meeting.' });
        return;
      }

      // Initialize room if needed
      if (!videoRooms[roomId]) videoRooms[roomId] = {};

      // If this userId is ALREADY in the room from a different socket
      // (e.g. reconnect, page refresh), remove the old entry
      Object.entries(videoRooms[roomId]).forEach(([sid, info]) => {
        if (info.userId === userId && sid !== socket.id) {
          console.log(`[VIDEO] Removing stale connection for user ${userName}: ${sid}`);
          delete videoRooms[roomId][sid];
          // Tell others the old socket left
          socket.to(`video_${roomId}`).emit('video_user_left', {
            socketId: sid,
            userName
          });
        }
      });

      // Register this socket in the room
      videoRooms[roomId][socket.id] = { socketId: socket.id, userId, userName };
      socket.data.roomId = roomId;
      socket.data.userName = userName;
      socket.data.userId = userId;

      // Join the socket.io room
      socket.join(`video_${roomId}`);

      // Tell all OTHER people in the room that this person joined
      socket.to(`video_${roomId}`).emit('video_user_joined', {
        socketId: socket.id,
        userId,
        userName
      });

      const roomUsers = Object.values(videoRooms[roomId]).map(u => u.userName);
      console.log(`[VIDEO] Room ${roomId} users: [${roomUsers.join(', ')}]`);
    });

    // ── Video: relay offer A → B ───────────────────────────────────────────
    socket.on('video_offer', ({ to, offer, userName }) => {
      console.log(`[VIDEO] Offer: ${socket.id} → ${to}`);
      io.to(to).emit('video_offer', {
        from: socket.id,
        offer,
        userName: userName || socket.data.userName
      });
    });

    // ── Video: relay answer B → A ──────────────────────────────────────────
    socket.on('video_answer', ({ to, answer, userName }) => {
      console.log(`[VIDEO] Answer: ${socket.id} → ${to}`);
      io.to(to).emit('video_answer', {
        from: socket.id,
        answer,
        userName: userName || socket.data.userName
      });
    });

    // ── Video: relay ICE candidates ────────────────────────────────────────
    socket.on('video_ice_candidate', ({ to, candidate }) => {
      io.to(to).emit('video_ice_candidate', {
        from: socket.id,
        candidate
      });
    });

    // ── Video: user leaves explicitly ──────────────────────────────────────
    socket.on('video_leave', ({ roomId, userName }) => {
      const room = roomId || socket.data.roomId;
      const name = userName || socket.data.userName;
      console.log(`[VIDEO] ${name} leaving room: ${room}`);

      if (room && videoRooms[room]) {
        delete videoRooms[room][socket.id];
        if (Object.keys(videoRooms[room]).length === 0) delete videoRooms[room];
      }

      socket.to(`video_${room}`).emit('video_user_left', {
        socketId: socket.id,
        userName: name
      });
      socket.leave(`video_${room}`);
    });

    // ── Video: media state (mic/cam/screen-share) ──────────────────────────
    socket.on('video_media_state', ({ roomId, camOn, micOn, screenSharing }) => {
      const room = roomId || socket.data.roomId;
      socket.to(`video_${room}`).emit('video_media_state', {
        socketId: socket.id,
        camOn,
        micOn,
        screenSharing
      });
    });

    // ── Video: in-call chat ────────────────────────────────────────────────
    socket.on('video_chat_message', ({ roomId, from, text, time }) => {
      socket.to(`video_${roomId}`).emit('video_chat_message', { from, text, time });
    });

    // ── Disconnect (browser closed / network drop) ─────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);

      const roomId = socket.data.roomId;
      const userName = socket.data.userName;

      if (roomId && videoRooms[roomId]) {
        delete videoRooms[roomId][socket.id];
        if (Object.keys(videoRooms[roomId]).length === 0) delete videoRooms[roomId];

        socket.to(`video_${roomId}`).emit('video_user_left', {
          socketId: socket.id,
          userName
        });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

module.exports = { initSocket, getIO };