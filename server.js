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

// JavaScript 파일 직접 서빙
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

// PvP 게임 관련 저장소
const pvpGames = {}; // 진행 중인 PvP 게임들
const pvpRequests = {}; // 대전 신청들
let gameIdCounter = 1;
let requestIdCounter = 1;

// PvP 게임 클래스 (완전 수정 버전)
class PvPGame {
  constructor(player1, player2) {
    this.id = `pvp_${gameIdCounter++}`;
    this.player1 = {
      id: player1.id,
      username: player1.username,
      position: { x: 100, y: 100 },
      direction: 'up',
      health: 3
    };
    this.player2 = {
      id: player2.id,
      username: player2.username,
      position: { x: 600, y: 400 },
      direction: 'up',
      health: 3
    };
    this.bullets = new Map(); // Map으로 변경하여 관리 개선
    this.bulletIntervals = new Map(); // 각 총알의 interval 저장
    this.processedHits = new Set(); // 처리된 충돌을 추적
    this.gameStarted = false;
    this.gameEnded = false;
    this.endMessageSent = false; // 종료 메시지 전송 여부
    
    console.log(`새 게임 생성: ${this.id}`, {
      player1: { username: this.player1.username, health: this.player1.health },
      player2: { username: this.player2.username, health: this.player2.health }
    });
  }

  // 플레이어 이동
  movePlayer(playerId, position, direction) {
    if (this.gameEnded) return;
    
    if (this.player1.id === playerId) {
      this.player1.position = position;
      this.player1.direction = direction;
    } else if (this.player2.id === playerId) {
      this.player2.position = position;
      this.player2.direction = direction;
    }
  }

  // 총알 발사
  shootBullet(playerId, position, direction) {
    if (this.gameEnded) return;
    
    const bulletId = `bullet_${Date.now()}_${Math.random()}`;
    const bullet = {
      id: bulletId,
      playerId: playerId,
      position: { x: position.x + 15, y: position.y + 15 },
      direction: direction,
      speed: 7,
      createdAt: Date.now(),
      hasHit: false // 충돌 여부 플래그 추가
    };
    
    this.bullets.set(bulletId, bullet);
    console.log(`총알 생성: ${bulletId}, 발사자: ${playerId}`);
    
    // 총알 이동 시뮬레이션
    this.moveBullet(bullet);
  }

  // 총알 이동 및 충돌 검사
  moveBullet(bullet) {
    const moveInterval = setInterval(() => {
      // 게임이 끝났거나 총알이 이미 충돌했으면 중지
      if (this.gameEnded || bullet.hasHit) {
        clearInterval(moveInterval);
        this.bulletIntervals.delete(bullet.id);
        return;
      }
      
      // 총알이 이미 처리되었거나 제거되었는지 확인
      if (this.processedHits.has(bullet.id) || !this.bullets.has(bullet.id)) {
        clearInterval(moveInterval);
        this.bulletIntervals.delete(bullet.id);
        return;
      }
      
      // 총알 이동
      const speed = bullet.speed;
      
      switch (bullet.direction) {
        case 'up': 
          bullet.position.y -= speed; 
          break;
        case 'down': 
          bullet.position.y += speed; 
          break;
        case 'left': 
          bullet.position.x -= speed; 
          break;
        case 'right': 
          bullet.position.x += speed; 
          break;
        case 'up-left':
          bullet.position.y -= speed * 0.7;
          bullet.position.x -= speed * 0.7;
          break;
        case 'up-right':
          bullet.position.y -= speed * 0.7;
          bullet.position.x += speed * 0.7;
          break;
        case 'down-left':
          bullet.position.y += speed * 0.7;
          bullet.position.x -= speed * 0.7;
          break;
        case 'down-right':
          bullet.position.y += speed * 0.7;
          bullet.position.x += speed * 0.7;
          break;
      }
      
      // 경계 벗어남 체크
      if (bullet.position.x < -10 || bullet.position.x > 770 || 
          bullet.position.y < -10 || bullet.position.y > 530) {
        console.log(`총알 경계 벗어남: ${bullet.id}`);
        this.removeBullet(bullet.id);
        clearInterval(moveInterval);
        this.bulletIntervals.delete(bullet.id);
        return;
      }
      
      // 충돌 검사 (중복 방지)
      if (!bullet.hasHit && !this.processedHits.has(bullet.id)) {
        this.checkBulletCollision(bullet);
      }
      
    }, 50); // 20fps
    
    // interval 저장
    this.bulletIntervals.set(bullet.id, moveInterval);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (!bullet.hasHit && !this.processedHits.has(bullet.id)) {
        console.log(`총알 시간 만료: ${bullet.id}`);
        this.removeBullet(bullet.id);
        const interval = this.bulletIntervals.get(bullet.id);
        if (interval) {
          clearInterval(interval);
          this.bulletIntervals.delete(bullet.id);
        }
      }
    }, 3000);
  }

  // 총알과 플레이어 충돌 검사 (완전 개선 버전)
  checkBulletCollision(bullet) {
    // 다중 체크로 중복 방지
    if (bullet.hasHit || this.processedHits.has(bullet.id) || this.gameEnded) {
      return;
    }
    
    const hitRadius = 20;
    const targetPlayer = bullet.playerId === this.player1.id ? this.player2 : this.player1;
    const shooterPlayer = bullet.playerId === this.player1.id ? this.player1 : this.player2;
    
    // 타겟이 이미 죽었으면 무시
    if (targetPlayer.health <= 0) {
      return;
    }
    
    const distance = Math.sqrt(
      Math.pow(bullet.position.x - (targetPlayer.position.x + 15), 2) +
      Math.pow(bullet.position.y - (targetPlayer.position.y + 15), 2)
    );
    
    if (distance < hitRadius) {
      // 즉시 모든 플래그 설정 (원자적 처리)
      bullet.hasHit = true;
      this.processedHits.add(bullet.id);
      
      console.log(`🎯 충돌! ${bullet.id} → ${targetPlayer.username}`);
      
      // interval 즉시 정리
      const interval = this.bulletIntervals.get(bullet.id);
      if (interval) {
        clearInterval(interval);
        this.bulletIntervals.delete(bullet.id);
      }
      
      // 총알 제거
      this.bullets.delete(bullet.id);
      
      // 체력 감소 (한 번만)
      const oldHealth = targetPlayer.health;
      targetPlayer.health = Math.max(0, targetPlayer.health - 1);
      console.log(`💔 ${targetPlayer.username} 체력: ${oldHealth} → ${targetPlayer.health}`);
      
      // 클라이언트에 피격 전송 (한 번만)
      const hitData = {
        isPlayer1: targetPlayer.id === this.player1.id,
        health: targetPlayer.health,
        winner: null,
        bulletId: bullet.id
      };
      
      // 승자 결정
      if (targetPlayer.health <= 0 && !this.gameEnded) {
        this.gameEnded = true;
        hitData.winner = shooterPlayer.username;
        console.log(`🏆 승자 결정: ${hitData.winner}`);
      }
      
      console.log(`📤 피격 이벤트 전송:`, hitData);
      
      io.to(this.player1.id).emit('pvpPlayerHit', hitData);
      io.to(this.player2.id).emit('pvpPlayerHit', hitData);
      
      // 게임 종료 처리 (winner가 있을 때만)
      if (hitData.winner) {
        setTimeout(() => this.endGame(hitData.winner), 500);
      }
    }
  }

  // 총알 제거
  removeBullet(bulletId) {
    if (this.bullets.has(bulletId)) {
      const bullet = this.bullets.get(bulletId);
      bullet.hasHit = true; // 제거 시에도 플래그 설정
      this.bullets.delete(bulletId);
      
      // interval 정리
      const interval = this.bulletIntervals.get(bulletId);
      if (interval) {
        clearInterval(interval);
        this.bulletIntervals.delete(bulletId);
      }
      
      console.log(`총알 제거: ${bulletId}, 남은 총알: ${this.bullets.size}`);
    }
  }

  // 게임 종료
  endGame(winner) {
    // 이미 종료 메시지를 보냈으면 무시
    if (this.endMessageSent) {
      return;
    }
    
    this.gameEnded = true;
    this.endMessageSent = true;
    
    // 모든 interval 정리
    this.bulletIntervals.forEach(interval => clearInterval(interval));
    this.bulletIntervals.clear();
    
    // 모든 총알 제거
    this.bullets.clear();
    this.processedHits.clear();
    
    // 게임 종료 이벤트 전송 (한 번만)
    io.to(this.player1.id).emit('pvpGameEnded', { winner });
    io.to(this.player2.id).emit('pvpGameEnded', { winner });
    
    // 게임 정리
    delete pvpGames[this.id];
    
    console.log(`🎮 PvP 게임 ${this.id} 완전 종료. 승자: ${winner}`);
  }
}

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
    console.log('sendMessage 이벤트 수신:', messageData, '발신자 소켓 ID:', socket.id);
    
    const user = activeUsers[socket.id];
    console.log('발신자 정보:', user);
    
    if (user && !user.isSuspended) {
      console.log('메시지 처리 중...');
      
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
        console.log('멘션 포함:', messageData.mentions);
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
      
      console.log('브로드캐스트할 데이터:', broadcastData);
      console.log('현재 연결된 클라이언트 수:', Object.keys(activeUsers).length);
      
      // 모든 클라이언트에게 메시지 브로드캐스트
      io.emit('newMessage', broadcastData);
      console.log('newMessage 이벤트 브로드캐스트 완료');
    } else {
      if (!user) {
        console.log('사용자 정보를 찾을 수 없음. 소켓 ID:', socket.id);
        console.log('현재 활성 사용자들:', Object.keys(activeUsers));
      } else if (user.isSuspended) {
        console.log('정지된 사용자가 메시지를 보내려고 함:', user.username);
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
  
  // 메시지 삭제 처리
  socket.on('deleteMessage', (data) => {
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

  // PvP 대전 신청 보내기
  socket.on('sendPvPRequest', (data) => {
    const challenger = activeUsers[socket.id];
    
    if (!challenger) return;
    
    // 대상 사용자 찾기
    let targetSocketId = null;
    for (const id in activeUsers) {
      if (activeUsers[id].username === data.targetUsername) {
        targetSocketId = id;
        break;
      }
    }
    
    if (!targetSocketId) {
      socket.emit('pvpGameError', { message: '대상 사용자를 찾을 수 없습니다.' });
      return;
    }
    
    // 이미 게임 중인지 확인
    for (const gameId in pvpGames) {
      const game = pvpGames[gameId];
      if (game.player1.id === socket.id || game.player2.id === socket.id ||
          game.player1.id === targetSocketId || game.player2.id === targetSocketId) {
        socket.emit('pvpGameError', { message: '이미 게임에 참여 중입니다.' });
        return;
      }
    }
    
    // 대전 신청 생성
    const requestId = `req_${requestIdCounter++}`;
    pvpRequests[requestId] = {
      challengerId: socket.id,
      challengerName: challenger.username,
      targetId: targetSocketId,
      targetName: activeUsers[targetSocketId].username,
      timestamp: Date.now()
    };
    
    // 대상에게 대전 신청 전송
    io.to(targetSocketId).emit('pvpRequestReceived', {
      requestId: requestId,
      challengerName: challenger.username
    });
    
    console.log(`${challenger.username}님이 ${activeUsers[targetSocketId].username}님에게 PvP 대전 신청`);
    
    // 30초 후 자동 만료
    setTimeout(() => {
      if (pvpRequests[requestId]) {
        delete pvpRequests[requestId];
        io.to(socket.id).emit('pvpRequestExpired', { targetName: activeUsers[targetSocketId]?.username });
      }
    }, 30000);
  });

  // PvP 대전 신청 수락
  socket.on('acceptPvPRequest', () => {
    console.log('PvP 대전 신청 수락 요청 받음:', socket.id);
    
    // 현재 사용자에게 온 대전 신청 찾기
    let request = null;
    let requestId = null;
    
    for (const id in pvpRequests) {
      if (pvpRequests[id].targetId === socket.id) {
        request = pvpRequests[id];
        requestId = id;
        break;
      }
    }
    
    console.log('찾은 대전 신청:', request);
    
    if (!request) {
      console.log('대전 신청을 찾을 수 없음');
      socket.emit('pvpGameError', { message: '대전 신청을 찾을 수 없습니다.' });
      return;
    }
    
    // 대전 신청 삭제
    delete pvpRequests[requestId];
    
    // 게임 생성
    const challengerUser = activeUsers[request.challengerId];
    const targetUser = activeUsers[request.targetId];
    
    console.log('게임 생성 중:', {
      challenger: challengerUser?.username,
      target: targetUser?.username
    });
    
    if (!challengerUser || !targetUser) {
      console.log('사용자 정보 없음');
      socket.emit('pvpGameError', { message: '상대방과의 연결이 끊어졌습니다.' });
      return;
    }
    
    const game = new PvPGame(
      { id: request.challengerId, username: challengerUser.username },
      { id: request.targetId, username: targetUser.username }
    );
    pvpGames[game.id] = game;
    
    console.log(`PvP 게임 생성: ${game.id}, 플레이어: ${challengerUser.username} vs ${targetUser.username}`);
    
    // 양쪽 플레이어에게 게임 시작 알림
    const gameDataForChallenger = {
      gameId: game.id,
      isPlayer1: true,
      player1: { username: challengerUser.username },
      player2: { username: targetUser.username }
    };
    
    const gameDataForTarget = {
      gameId: game.id,
      isPlayer1: false,
      player1: { username: challengerUser.username },
      player2: { username: targetUser.username }
    };
    
    console.log('신청자에게 게임 생성 알림 전송:', gameDataForChallenger);
    io.to(request.challengerId).emit('pvpGameCreated', gameDataForChallenger);
    
    console.log('수락자에게 게임 수락 알림 전송:', gameDataForTarget);
    io.to(request.targetId).emit('pvpGameAccepted', gameDataForTarget);
  });

  // PvP 대전 신청 거절
  socket.on('declinePvPRequest', () => {
    // 현재 사용자에게 온 대전 신청 찾기
    let request = null;
    let requestId = null;
    
    for (const id in pvpRequests) {
      if (pvpRequests[id].targetId === socket.id) {
        request = pvpRequests[id];
        requestId = id;
        break;
      }
    }
    
    if (!request) return;
    
    // 신청자에게 거절 알림
    io.to(request.challengerId).emit('pvpRequestDeclined', {
      targetName: activeUsers[request.targetId].username
    });
    
    // 대전 신청 삭제
    delete pvpRequests[requestId];
    
    console.log(`${activeUsers[request.targetId].username}님이 ${request.challengerName}님의 PvP 대전 신청 거절`);
  });

  // PvP 게임 나가기
  socket.on('leavePvPGame', (data) => {
    const game = pvpGames[data.gameId];
    
    if (game) {
      // 상대방에게 게임 종료 알림
      const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
      io.to(opponentId).emit('pvpGameEnded', { 
        winner: null, 
        reason: '상대방이 게임을 나갔습니다.' 
      });
      
      // 게임 삭제
      delete pvpGames[data.gameId];
      console.log(`PvP 게임 ${data.gameId} 강제 종료`);
    }
  });

  // PvP 플레이어 이동
  socket.on('pvpMove', (data) => {
    const game = pvpGames[data.gameId];
    
    if (game && !game.gameEnded) {
      game.movePlayer(socket.id, data.position, data.direction);
      
      // 상대방에게 이동 정보 전송
      const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
      io.to(opponentId).emit('pvpPlayerMove', {
        playerId: socket.id,
        position: data.position,
        direction: data.direction
      });
    }
  });

  // PvP 총알 발사
  socket.on('pvpShoot', (data) => {
    const game = pvpGames[data.gameId];
    
    if (game && !game.gameEnded) {
      console.log(`플레이어 ${socket.id}가 총알 발사`);
      
      // 양쪽 플레이어에게 총알 발사 알림
      io.to(game.player1.id).emit('pvpPlayerShoot', {
        playerId: socket.id,
        position: data.position,
        direction: data.direction
      });
      
      io.to(game.player2.id).emit('pvpPlayerShoot', {
        playerId: socket.id,
        position: data.position,
        direction: data.direction
      });
      
      // 서버에서 총알 처리
      game.shootBullet(socket.id, data.position, data.direction);
    }
  });
  
  // 연결 해제 처리
  socket.on('disconnect', () => {
    const user = activeUsers[socket.id];
    
    if (user) {
      console.log('사용자 퇴장:', user.username);
      
      // PvP 대전 신청들 정리
      for (const requestId in pvpRequests) {
        const request = pvpRequests[requestId];
        if (request.challengerId === socket.id || request.targetId === socket.id) {
          // 상대방에게 알림
          const otherUserId = request.challengerId === socket.id ? request.targetId : request.challengerId;
          io.to(otherUserId).emit('pvpRequestCancelled', { reason: '상대방이 연결을 끊었습니다.' });
          delete pvpRequests[requestId];
        }
      }
      
      // 진행 중인 PvP 게임 체크
      for (const gameId in pvpGames) {
        const game = pvpGames[gameId];
        if (game.player1.id === socket.id || game.player2.id === socket.id) {
          // 상대방에게 게임 종료 알림
          const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
          io.to(opponentId).emit('pvpGameEnded', { 
            winner: null, 
            reason: '상대방과의 연결이 끊어졌습니다.' 
          });
          
          // 게임 삭제
          delete pvpGames[gameId];
          console.log(`PvP 게임 ${gameId} 연결 끊김으로 종료`);
          break;
        }
      }
      
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

  // 사용자 강퇴 기능
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
