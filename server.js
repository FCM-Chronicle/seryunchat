const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Express 앱 생성
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 정적 파일 제공 (public 폴더)
app.use('/style.css', (req, res, next) => {
  console.log('CSS file requested');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 루트 경로에서 index.html 제공
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log('Looking for index.html at:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('파일을 찾을 수 없습니다.');
    }
  });
});

// JavaScript 파일 직접 서빙 (백업용)
app.get('/script.js', (req, res) => {
  const jsPath = path.join(__dirname, 'public', 'script.js');
  console.log('Looking for script.js at:', jsPath);
  res.sendFile(jsPath, (err) => {
    if (err) {
      console.error('Error serving script.js:', err);
      res.status(404).send('JavaScript 파일을 찾을 수 없습니다.');
    }
  });
});

// 디버깅을 위한 파일 시스템 확인
const fs = require('fs');
console.log('Current directory:', __dirname);
console.log('Files in root:', fs.readdirSync(__dirname));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  console.log('Files in public:', fs.readdirSync(path.join(__dirname, 'public')));
} else {
  console.log('Public directory does not exist!');
}

// 활성 사용자 저장 객체
const activeUsers = {};
const userMessages = {}; // 사용자별 메시지 저장

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('사용자가 연결되었습니다:', socket.id);
  
  // 사용자 입장 처리
  socket.on('join', (userData) => {
    console.log('사용자 입장 시도:', userData.username);
    
    // 닉네임 검증: 공백 확인
    if (userData.username.includes(' ')) {
      socket.emit('joinError', {
        error: 'username_space',
        message: '닉네임에 공백을 포함할 수 없습니다.'
      });
      return;
    }
    
    // 닉네임 검증: 중복 확인
    let isDuplicate = false;
    for (const id in activeUsers) {
      if (activeUsers[id].username === userData.username) {
        isDuplicate = true;
        break;
      }
    }
    
    if (isDuplicate) {
      socket.emit('joinError', {
        error: 'username_taken',
        message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해주세요.'
      });
      return;
    }
    
    console.log('사용자 입장:', userData.username);
    
    // 사용자 정보 저장
    activeUsers[socket.id] = {
      username: userData.username,
      color: userData.color,
      isAdmin: userData.isAdmin || false,
      isSuspended: false
    };
    
    // 사용자별 메시지 저장소 초기화
    userMessages[socket.id] = [];
      
    // 입장 메시지 브로드캐스트
    io.emit('userJoined', {
      id: socket.id,
      username: userData.username,
      color: userData.color,
      isAdmin: userData.isAdmin || false,
      userCount: Object.keys(activeUsers).length
    });
    
    // 현재 활성 사용자 수 전송
    io.emit('updateUserCount', {
      userCount: Object.keys(activeUsers).length
    });
  });
  
  // 활성 사용자 목록 요청 처리
  socket.on('getActiveUsers', () => {
    socket.emit('activeUsers', activeUsers);
  });
  
  // 메시지 수신 및 브로드캐스트
  socket.on('sendMessage', (messageData) => {
    const user = activeUsers[socket.id];
    
    if (user && !user.isSuspended) {
      // 멘션 처리
      const broadcastData = {
        sender: user.username,
        color: user.color,
        text: messageData.text,
        timestamp: Date.now(),
        messageId: messageData.messageId,
        isEdited: false
      };
      
      // 멘션이 포함된 경우 추가 정보 설정
      if (messageData.mentions && messageData.mentions.length > 0) {
        broadcastData.mentions = messageData.mentions;
      }
      
      // 메시지 저장
      if (!userMessages[socket.id]) {
        userMessages[socket.id] = [];
      }
      userMessages[socket.id].push({
        messageId: messageData.messageId,
        text: messageData.text,
        timestamp: Date.now()
      });
      
      // 모든 클라이언트에게 메시지 브로드캐스트
      io.emit('newMessage', broadcastData);
    }
  });
  
  // 이미지 수신 및 브로드캐스트
  socket.on('sendImage', (imageData) => {
    const user = activeUsers[socket.id];
    
    if (user && !user.isSuspended) {
      // 이미지 브로드캐스트 데이터
      const broadcastData = {
        sender: user.username,
        color: user.color,
        imageData: imageData.imageData,
        fileName: imageData.fileName,
        timestamp: Date.now()
      };
      
      console.log(`${user.username}님이 이미지를 전송했습니다: ${imageData.fileName}`);
      
      // 모든 클라이언트에게 이미지 브로드캐스트
      io.emit('newImage', broadcastData);
    }
  });
    const user = activeUsers[socket.id];
    
    if (user && userMessages[socket.id]) {
      // 사용자의 메시지인지 확인
      const messageIndex = userMessages[socket.id].findIndex(msg => msg.messageId === data.messageId);
      
      if (messageIndex !== -1) {
        // 메시지 삭제 표시
        userMessages[socket.id][messageIndex].deleted = true;
        
        // 모든 클라이언트에게 삭제 알림
        io.emit('messageDeleted', {
          messageId: data.messageId,
          deletedBy: user.username
        });
        
        console.log(`${user.username}님이 메시지를 삭제했습니다: ${data.messageId}`);
      }
    }
  });
  
  // 메시지 수정 처리
  socket.on('editMessage', (data) => {
    const user = activeUsers[socket.id];
    
    if (user && userMessages[socket.id]) {
      // 사용자의 메시지인지 확인
      const messageIndex = userMessages[socket.id].findIndex(msg => msg.messageId === data.messageId);
      
      if (messageIndex !== -1) {
        // 메시지 수정
        userMessages[socket.id][messageIndex].text = data.newText;
        userMessages[socket.id][messageIndex].edited = true;
        userMessages[socket.id][messageIndex].editedAt = Date.now();
        
        // 모든 클라이언트에게 수정 알림
        io.emit('messageEdited', {
          messageId: data.messageId,
          newText: data.newText,
          editedBy: user.username
        });
        
        console.log(`${user.username}님이 메시지를 수정했습니다: ${data.messageId}`);
      }
    }
  });
  
  // 이미지 수신 및 브로드캐스트
  socket.on('sendImage', (imageData) => {
    const user = activeUsers[socket.id];
    
    if (user && !user.isSuspended) {
      // 이미지 브로드캐스트 데이터
      const broadcastData = {
        sender: user.username,
        color: user.color,
        imageData: imageData.imageData,
        fileName: imageData.fileName,
        timestamp: Date.now()
      };
      
      console.log(`${user.username}님이 이미지를 전송했습니다: ${imageData.fileName}`);
      
      // 모든 클라이언트에게 이미지 브로드캐스트
      io.emit('newImage', broadcastData);
    }
  });
  
  // 연결 해제 처리
  socket.on('disconnect', () => {
    const user = activeUsers[socket.id];
    
    if (user) {
      console.log('사용자 퇴장:', user.username);
      
      // 퇴장 메시지 브로드캐스트
      io.emit('userLeft', {
        username: user.username,
        userCount: Object.keys(activeUsers).length - 1
      });
      
      // 사용자 정보 및 메시지 삭제
      delete activeUsers[socket.id];
      delete userMessages[socket.id];
      
      // 사용자 수 업데이트
      io.emit('updateUserCount', {
        userCount: Object.keys(activeUsers).length
      });
    }
  });
  
  // 사용자 타이핑 중 상태 알림
  socket.on('typing', () => {
    const user = activeUsers[socket.id];
    
    if (user && !user.isSuspended) {
      // 타이핑 중인 사용자 정보 브로드캐스트 (현재 사용자 제외)
      socket.broadcast.emit('userTyping', {
        username: user.username
      });
    }
  });
  
  // 타이핑 중지 상태 알림
  socket.on('stopTyping', () => {
    const user = activeUsers[socket.id];
    
    if (user) {
      socket.broadcast.emit('userStoppedTyping', {
        username: user.username
      });
    }
  });
  
  // 사용자 정지 기능
  socket.on('suspendUser', (data) => {
    const adminUser = activeUsers[socket.id];
    
    // 요청한 사용자가 관리자인지 확인
    if (adminUser && adminUser.isAdmin) {
      // 정지할 사용자 찾기
      let targetSocketId = null;
      
      for (const id in activeUsers) {
        if (activeUsers[id].username === data.targetUsername) {
          targetSocketId = id;
          break;
        }
      }
      
      // 정지할 사용자가 존재하면 정지 처리
      if (targetSocketId) {
        // 사용자 정지 상태 설정
        activeUsers[targetSocketId].isSuspended = true;
        
        // 일정 시간 후 정지 해제를 위한 타이머 설정
        setTimeout(() => {
          // 사용자가 아직 연결되어 있는지 확인
          if (activeUsers[targetSocketId]) {
            activeUsers[targetSocketId].isSuspended = false;
          }
        }, data.duration * 1000);
        
        // 모든 클라이언트에게 사용자 정지 알림
        io.emit('userSuspended', {
          username: data.targetUsername,
          adminUsername: adminUser.username,
          duration: data.duration
        });
        
        console.log(`${adminUser.username}님이 ${data.targetUsername}님을 ${data.duration}초 동안 정지했습니다.`);
      }
    }
  });

  // 사용자 강퇴 기능 추가
  socket.on('kickUser', (data) => {
    const adminUser = activeUsers[socket.id];
    
    // 요청한 사용자가 관리자인지 확인
    if (adminUser && adminUser.isAdmin) {
      // 강퇴할 사용자 찾기
      let targetSocketId = null;
      
      for (const id in activeUsers) {
        if (activeUsers[id].username === data.targetUsername) {
          targetSocketId = id;
          break;
        }
      }
      
      // 강퇴할 사용자가 존재하면 강퇴 처리
      if (targetSocketId) {
        const targetUser = activeUsers[targetSocketId];
        
        // 강퇴 메시지 브로드캐스트
        io.emit('userKicked', {
          username: data.targetUsername,
          adminUsername: adminUser.username
        });
        
        // 강퇴당한 사용자에게 강퇴 알림 전송
        io.to(targetSocketId).emit('kicked', {
          adminUsername: adminUser.username,
          message: '관리자에 의해 강퇴되었습니다.'
        });
        
        // 잠시 후 해당 사용자의 연결 강제 종료
        setTimeout(() => {
          const socketInstance = io.sockets.sockets.get(targetSocketId);
          if (socketInstance) {
            socketInstance.disconnect(true);
          }
        }, 1000);
        
        console.log(`${adminUser.username}님이 ${data.targetUsername}님을 강퇴했습니다.`);
      }
    }
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
});
