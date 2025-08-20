// server.js 수정 부분 (PvP 게임 클래스만 표시)

// PvP 게임 클래스 (수정된 버전)
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
    this.bullets = [];
    this.processedHits = new Set(); // 처리된 충돌을 추적
    this.gameStarted = false;
    this.gameEnded = false;
    
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
    
    const bullet = {
      id: `bullet_${Date.now()}_${Math.random()}`,
      playerId: playerId,
      position: { x: position.x + 15, y: position.y + 15 },
      direction: direction,
      speed: 7,
      createdAt: Date.now()
    };
    
    this.bullets.push(bullet);
    
    // 총알 이동 시뮬레이션 (서버에서 충돌 검사)
    this.moveBullet(bullet);
  }

  // 총알 이동 및 충돌 검사
  moveBullet(bullet) {
    const moveInterval = setInterval(() => {
      // 게임이 끝났으면 중지
      if (this.gameEnded) {
        clearInterval(moveInterval);
        return;
      }
      
      // 총알이 이미 처리되었는지 확인
      if (this.processedHits.has(bullet.id)) {
        clearInterval(moveInterval);
        return;
      }
      
      // 총알이 배열에서 제거되었는지 확인
      const bulletExists = this.bullets.find(b => b.id === bullet.id);
      if (!bulletExists) {
        clearInterval(moveInterval);
        return;
      }
      
      // 총알 이동
      const speed = bullet.speed;
      
      switch (bullet.direction) {
        case 'up': bullet.position.y -= speed; break;
        case 'down': bullet.position.y += speed; break;
        case 'left': bullet.position.x -= speed; break;
        case 'right': bullet.position.x += speed; break;
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
        this.removeBullet(bullet.id);
        clearInterval(moveInterval);
        return;
      }
      
      // 충돌 검사
      this.checkBulletCollision(bullet);
      
    }, 50); // 20fps
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (!this.processedHits.has(bullet.id)) {
        this.removeBullet(bullet.id);
        clearInterval(moveInterval);
      }
    }, 3000);
  }

  // 총알과 플레이어 충돌 검사 (개선된 버전)
  checkBulletCollision(bullet) {
    // 이미 처리된 총알이면 무시
    if (this.processedHits.has(bullet.id)) {
      return;
    }
    
    // 게임이 끝났으면 무시
    if (this.gameEnded) {
      return;
    }
    
    const hitRadius = 20;
    const targetPlayer = bullet.playerId === this.player1.id ? this.player2 : this.player1;
    const shooterPlayer = bullet.playerId === this.player1.id ? this.player1 : this.player2;
    
    const distance = Math.sqrt(
      Math.pow(bullet.position.x - (targetPlayer.position.x + 15), 2) +
      Math.pow(bullet.position.y - (targetPlayer.position.y + 15), 2)
    );
    
    if (distance < hitRadius) {
      // 즉시 처리된 것으로 표시
      this.processedHits.add(bullet.id);
      
      console.log(`🎯 충돌! ${bullet.id} → ${targetPlayer.username}`);
      
      // 총알을 즉시 제거
      this.removeBullet(bullet.id);
      
      // 체력 감소
      targetPlayer.health = Math.max(0, targetPlayer.health - 1);
      console.log(`💔 ${targetPlayer.username} 체력: ${targetPlayer.health}`);
      
      // 승자 결정
      let winner = null;
      if (targetPlayer.health <= 0 && !this.gameEnded) {
        winner = shooterPlayer.username;
        this.gameEnded = true;
        console.log(`🏆 승자: ${winner}`);
      }
      
      // 클라이언트에 전송 (한 번만)
      const hitData = {
        isPlayer1: targetPlayer.id === this.player1.id,
        health: targetPlayer.health,
        winner: winner,
        bulletId: bullet.id
      };
      
      io.to(this.player1.id).emit('pvpPlayerHit', hitData);
      io.to(this.player2.id).emit('pvpPlayerHit', hitData);
      
      // 게임 종료 처리
      if (winner) {
        setTimeout(() => this.endGame(winner), 500);
      }
    }
  }

  // 총알 제거
  removeBullet(bulletId) {
    this.bullets = this.bullets.filter(b => b.id !== bulletId);
    console.log(`총알 제거: ${bulletId}, 남은 총알: ${this.bullets.length}`);
  }

  // 게임 종료
  endGame(winner) {
    if (!this.gameEnded) {
      this.gameEnded = true;
      
      // 모든 총알 제거
      this.bullets = [];
      this.processedHits.clear();
      
      // 게임 종료 이벤트 전송
      io.to(this.player1.id).emit('pvpGameEnded', { winner });
      io.to(this.player2.id).emit('pvpGameEnded', { winner });
      
      // 게임 정리
      delete pvpGames[this.id];
      
      console.log(`🎮 PvP 게임 ${this.id} 완전 종료. 승자: ${winner}`);
    }
  }
}
