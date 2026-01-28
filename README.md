# Realtime Voice Chat System

> A full-stack real-time chat and voice communication platform with text chat, voice messages, and live voice streaming.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

A production-ready real-time voice chat system built with Socket.IO, Redis, React, and Node.js. Create or join chat rooms, send text and voice messages, and participate in live voice conversations with microphone controls.

**Key Features:**
- Multiple chat rooms with live user counts
- Real-time text messaging with chat history
- Voice messages with playback amplification
- Live voice streaming with mute/unmute controls
- Direct (1-on-1) messaging
- Emoji reactions
- Redis-backed scalability

## Quick Start

### Prerequisites
- Node.js 20+, npm 9+, Docker

### Installation

```bash
# 1. Clone repository
git clone https://github.com/NainaKothari-14/Realtime-Voice-Chat-System.git
cd Realtime-Voice-Chat-System

# 2. Start Redis
docker run -d --name redis-voice -p 6379:6379 redis:7

# 3. Server setup
cd server
npm install
npm run dev  # Runs at http://localhost:5000

# 4. Client setup (new terminal)
cd client
npm install
npm run dev  # Runs at http://localhost:5173
```

### Test the App
1. Open `http://localhost:5173`
2. Enter username → Join/Create room
3. Allow microphone access
4. Start chatting!

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="screenshots/UserEntryPAge.png" alt="User Entry"/>
      <p align="center"><em>User Entry Page</em></p>
    </td>
    <td width="50%">
      <img src="screenshots/SelectRoom.png" alt="Select Room"/>
      <p align="center"><em>Select/Create Room</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshots/DifferentRooms.png" alt="Rooms"/>
      <p align="center"><em>Multiple Active Rooms</em></p>
    </td>
    <td width="50%">
      <img src="screenshots/ChatRoom.png" alt="Chat Room"/>
      <p align="center"><em>Chat Room Interface</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshots/DirectChat.png" alt="Direct Chat"/>
      <p align="center"><em>Direct Messaging</em></p>
    </td>
    <td width="50%">
      <img src="screenshots/VoiceChatMessage.png" alt="Voice Message"/>
      <p align="center"><em>Voice Messages</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshots/MicAndExitButton.png" alt="Controls"/>
      <p align="center"><em>Mic Controls & Exit</em></p>
    </td>
    <td width="50%">
      <img src="screenshots/Reaction.png" alt="Reactions"/>
      <p align="center"><em>Emoji Reactions</em></p>
    </td>
  </tr>
</table>

## Tech Stack

**Frontend:** React 18, Vite, Socket.IO Client, Web Audio API, MediaRecorder API  
**Backend:** Node.js, Express, Socket.IO, Redis, Multer  
**DevOps:** Docker, Git

## System Architecture

```
Client (React) ←→ Socket.IO Server ←→ Redis
```

**Data Flow:**  
User Action → Socket Event → Controller → Service → Store/Redis → Broadcast to Clients

**Core Components:**
- **Room Management:** Join/create rooms, live user counts, presence tracking
- **Text Messaging:** Real-time chat, history persistence, system notifications
- **Voice Messages:** Record → Base64 encode → Broadcast → Playback with amplification
- **Live Voice:** Microphone streaming via Socket.IO with mute/unmute controls

## Key Features Explained

### Voice Messages
- Record audio using browser MediaRecorder API
- Send as Base64-encoded audio (production should use cloud storage)
- Playback with 2x-4x volume amplification using Web Audio API

### Live Voice Chat
- Real-time microphone streaming to all room members
- Client-side mute/unmute controls
- Automatic cleanup on disconnect

### Room System
- Pre-configured rooms (General, Music, Gaming)
- Create custom rooms with names and emoji icons
- Real-time user count updates across all clients

## API Reference

### REST Endpoints

**Get Active Rooms**
```http
GET http://localhost:5000/api/rooms
```

### Socket.IO Events

**Client → Server:**
- `room:join` - Join a room
- `room:leave` - Leave current room
- `chat:message` - Send text message
- `chat:send:voice` - Send voice message
- `chat:direct` - Send direct message
- `chat:reaction` - React to message

**Server → Client:**
- `room:users` - Updated user list
- `rooms:list` - Updated rooms list
- `chat:history` - Chat history on join
- `chat:message` - New message received
- `chat:direct:received` - Direct message received
- `chat:reaction:update` - Reaction update

## Configuration

**Server `.env`:**
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

**Client `.env`:**
```env
VITE_SERVER_URL=http://localhost:5000
```

## Troubleshooting

**Microphone not working:**
- Check browser permissions (allow microphone access)
- Use Chrome/Firefox/Edge (Safari has limited support)
- HTTPS required (except localhost)

**Redis connection errors:**
```bash
# Verify Redis is running
docker ps | grep redis-voice

# Test connection
redis-cli ping  # Should return "PONG"
```

**Socket disconnections:**
- Check network connection
- Verify CORS settings
- Check server logs for errors

## Production Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  client:
    build: ./client
    ports:
      - "80:80"

volumes:
  redis-data:
```

### Security Best Practices
- Add rate limiting (express-rate-limit)
- Use Helmet for security headers
- Validate user inputs
- Configure CORS properly
- Implement message size limits

## Future Improvements

- [ ] Store voice messages in cloud storage (S3/Cloudinary)
- [ ] User authentication (JWT/OAuth)
- [ ] Typing indicators
- [ ] Message edit/delete
- [ ] Private rooms with passwords
- [ ] User profiles with avatars
- [ ] Mobile responsiveness
- [ ] PWA support

## Contributing

Contributions welcome! Fork the repo, create a feature branch, and submit a PR.

## License

MIT License - see [LICENSE](LICENSE) file

## Author

**Naina Kothari**  
GitHub: [@NainaKothari-14](https://github.com/NainaKothari-14)

---

Built with Socket.IO, Redis, React, and Node.js

*If this project helps you, consider giving it a star!*
