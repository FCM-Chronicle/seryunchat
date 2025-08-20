// script.js 수정 부분 (PvP 관련 함수들만)

// 연속 이동 관련 변수 추가
let continuousMoveInterval = null;
const MOVE_INTERVAL = 50; // 50ms마다 이동 (20fps)

// 연속 이동 시작
function startContinuousMovement() {
    if (continuousMoveInterval) return;
    
    continuousMoveInterval = setInterval(() => {
        if (!pvpGameActive || !gameStarted || countdownActive) {
            stopContinuousMovement();
            return;
        }
        
        handlePvPMovement();
    }, MOVE_INTERVAL);
}

// 연속 이동 중지
function stopContinuousMovement() {
    if (continuousMoveInterval) {
        clearInterval(continuousMoveInterval);
        continuousMoveInterval = null;
    }
}

// PvP 이동 처리
function handlePvPMovement() {
    if (!gameStarted || !pvpGameActive) return;
    
    let moved = false;
    let newX = myPosition.x;
    let newY = myPosition.y;
    let newDirection = myDirection;
    
    const moveSpeed = 5;
    
    // 8방향 이동 처리
    if ((pvpKeys['KeyW'] || pvpKeys['ArrowUp']) && (pvpKeys['KeyA'] || pvpKeys['ArrowLeft'])) {
        newY -= moveSpeed * 0.7;
        newX -= moveSpeed * 0.7;
        newDirection = 'up-left';
        moved = true;
    } else if ((pvpKeys['KeyW'] || pvpKeys['ArrowUp']) && (pvpKeys['KeyD'] || pvpKeys['ArrowRight'])) {
        newY -= moveSpeed * 0.7;
        newX += moveSpeed * 0.7;
        newDirection = 'up-right';
        moved = true;
    } else if ((pvpKeys['KeyS'] || pvpKeys['ArrowDown']) && (pvpKeys['KeyA'] || pvpKeys['ArrowLeft'])) {
        newY += moveSpeed * 0.7;
        newX -= moveSpeed * 0.7;
        newDirection = 'down-left';
        moved = true;
    } else if ((pvpKeys['KeyS'] || pvpKeys['ArrowDown']) && (pvpKeys['KeyD'] || pvpKeys['ArrowRight'])) {
        newY += moveSpeed * 0.7;
        newX += moveSpeed * 0.7;
        newDirection = 'down-right';
        moved = true;
    } else if (pvpKeys['KeyW'] || pvpKeys['ArrowUp']) {
        newY -= moveSpeed;
        newDirection = 'up';
        moved = true;
    } else if (pvpKeys['KeyS'] || pvpKeys['ArrowDown']) {
        newY += moveSpeed;
        newDirection = 'down';
        moved = true;
    } else if (pvpKeys['KeyA'] || pvpKeys['ArrowLeft']) {
        newX -= moveSpeed;
        newDirection = 'left';
        moved = true;
    } else if (pvpKeys['KeyD'] || pvpKeys['ArrowRight']) {
        newX += moveSpeed;
        newDirection = 'right';
        moved = true;
    }
    
    // 경계 체크
    newX = Math.max(0, Math.min(730, newX));
    newY = Math.max(0, Math.min(490, newY));
    
    if (moved) {
        myPosition.x = newX;
        myPosition.y = newY;
        myDirection = newDirection;
        
        updatePvPPlayerPositions();
        
        // 서버에 위치 전송
        socket.emit('pvpMove', {
            gameId: pvpGameId,
            position: myPosition,
            direction: myDirection
        });
    }
}

// 총알 발사 제한 시스템
let lastShotTime = 0;
const SHOT_COOLDOWN = 300; // 300ms 쿨다운

// 총알 발사 (서버에만 요청)
function shootBullet() {
    if (!gameStarted || !pvpGameActive) return;
    
    const currentTime = Date.now();
    if (currentTime - lastShotTime < SHOT_COOLDOWN) {
        console.log(`🚫 총알 발사 쿨다운: ${SHOT_COOLDOWN - (currentTime - lastShotTime)}ms 남음`);
        return;
    }
    
    lastShotTime = currentTime;
    
    console.log(`🔫 총알 발사 요청: ${myDirection} 방향`);
    
    // 서버에만 발사 요청 (클라이언트에서는 생성하지 않음)
    socket.emit('pvpShoot', {
        gameId: pvpGameId,
        position: myPosition,
        direction: myDirection
    });
}

// 총알 생성 (시각적 표시만)
function createBullet(position, direction, isMyBullet = false) {
    const bullet = document.createElement('div');
    bullet.classList.add('bullet');
    bullet.style.left = position.x + 15 + 'px';
    bullet.style.top = position.y + 15 + 'px';
    
    if (isMyBullet) {
        bullet.style.background = '#00ff00'; // 내 총알은 초록색
    } else {
        bullet.style.background = '#ff4444'; // 상대 총알은 빨간색
    }
    
    pvpBattlefield.appendChild(bullet);
    
    // 총알 이동 애니메이션 (시각적 효과만)
    const speed = 5;
    let dx = 0, dy = 0;
    
    switch (direction) {
        case 'up': dy = -speed; break;
        case 'down': dy = speed; break;
        case 'left': dx = -speed; break;
        case 'right': dx = speed; break;
        case 'up-left':
            dx = -speed * 0.7;
            dy = -speed * 0.7;
            break;
        case 'up-right':
            dx = speed * 0.7;
            dy = -speed * 0.7;
            break;
        case 'down-left':
            dx = -speed * 0.7;
            dy = speed * 0.7;
            break;
        case 'down-right':
            dx = speed * 0.7;
            dy = speed * 0.7;
            break;
    }
    
    const moveBullet = () => {
        const currentX = parseInt(bullet.style.left);
        const currentY = parseInt(bullet.style.top);
        
        bullet.style.left = (currentX + dx) + 'px';
        bullet.style.top = (currentY + dy) + 'px';
        
        // 경계 체크
        if (currentX < -10 || currentX > 770 || currentY < -10 || currentY > 530) {
            bullet.remove();
            return;
        }
        
        if (bullet.parentNode) {
            requestAnimationFrame(moveBullet);
        }
    };
    
    moveBullet();
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (bullet.parentNode) {
            bullet.remove();
        }
    }, 3000);
}

// 체력바 업데이트 (피격 효과 개선)
function updateHealthBars() {
    const player1HealthBar = document.getElementById('player1-health');
    const player2HealthBar = document.getElementById('player2-health');
    
    const player1Percentage = Math.max(0, (player1Health / 3 * 100));
    const player2Percentage = Math.max(0, (player2Health / 3 * 100));
    
    console.log(`체력바 업데이트: Player1=${player1Percentage}%, Player2=${player2Percentage}%`);
    
    // 애니메이션 효과를 위한 transition 추가
    player1HealthBar.style.transition = 'width 0.3s ease-out';
    player2HealthBar.style.transition = 'width 0.3s ease-out';
    
    player1HealthBar.style.width = player1Percentage + '%';
    player2HealthBar.style.width = player2Percentage + '%';
    
    // 체력에 따른 색상 변경
    if (player1Health <= 1) {
        player1HealthBar.style.background = 'linear-gradient(90deg, #ff4444, #cc0000)';
    } else if (player1Health <= 2) {
        player2HealthBar.style.background = 'linear-gradient(90deg, #ffaa44, #ff8800)';
    } else {
        player1HealthBar.style.background = 'linear-gradient(90deg, #44ff44, #00cc00)';
    }
    
    if (player2Health <= 1) {
        player2HealthBar.style.background = 'linear-gradient(90deg, #ff4444, #cc0000)';
    } else if (player2Health <= 2) {
        player2HealthBar.style.background = 'linear-gradient(90deg, #ffaa44, #ff8800)';
    } else {
        player2HealthBar.style.background = 'linear-gradient(90deg, #44ff44, #00cc00)';
    }
}

// PvP 게임 종료 (개선된 버전)
function endPvPGame(winner = null) {
    pvpGameActive = false;
    gameStarted = false;
    countdownActive = false;
    
    // 연속 이동 중지
    stopContinuousMovement();
    
    // 키 상태 초기화
    pvpKeys = {};
    
    // 모든 총알 제거
    const bullets = document.querySelectorAll('.bullet');
    bullets.forEach(bullet => bullet.remove());
    
    if (winner) {
        const gameOverScreen = document.getElementById('game-over-screen');
        const gameOverText = document.getElementById('game-over-text');
        
        if (winner === username) {
            gameOverText.textContent = '🎉 승리! 🎉';
            gameOverText.className = 'game-over-text game-over-winner';
            gameOverScreen.style.background = 'rgba(0, 255, 0, 0.1)';
        } else {
            gameOverText.textContent = '💀 패배 💀';
            gameOverText.className = 'game-over-text game-over-loser';
            gameOverScreen.style.background = 'rgba(255, 0, 0, 0.1)';
        }
        
        gameOverScreen.style.display = 'flex';
        
        // 3초 후 게임 종료
        setTimeout(() => {
            document.getElementById('pvp-game-container').style.display = 'none';
            gameOverScreen.style.display = 'none';
            gameOverScreen.style.background = 'rgba(0, 0, 0, 0.8)';
        }, 3000);
        
        // 결과 채팅에 전송
        socket.emit('sendMessage', {
            text: `⚔️ PvP 게임 결과: ${winner}님이 승리했습니다!`,
            messageId: `pvp_${Date.now()}`
        });
    } else {
        document.getElementById('pvp-game-container').style.display = 'none';
    }
    
    // 변수 초기화
    pvpGameId = null;
    isPlayer1 = false;
    player1Health = 3;
    player2Health = 3;
}

// 소켓 이벤트 - pvpPlayerShoot 수정
socket.on('pvpPlayerShoot', (data) => {
    console.log('총알 발사 이벤트 수신:', data);
    // 시각적 효과만 생성 (충돌은 서버에서 처리)
    createBullet(data.position, data.direction, data.playerId === socket.id);
});

// 소켓 이벤트 - pvpPlayerHit 수정 (중복 처리 방지)
socket.on('pvpPlayerHit', (data) => {
    console.log('🎯 피격 이벤트 수신:', {
        bulletId: data.bulletId,
        health: data.health,
        winner: data.winner
    });
    
    // 체력 업데이트 (한 번만)
    if (data.isPlayer1) {
        if (player1Health !== data.health) {
            player1Health = data.health;
            console.log(`💔 Player1 체력 업데이트: ${player1Health}`);
        }
    } else {
        if (player2Health !== data.health) {
            player2Health = data.health;
            console.log(`💔 Player2 체력 업데이트: ${player2Health}`);
        }
    }
    
    updateHealthBars();
    
    // 피격 효과 (내가 맞았을 때만)
    if ((data.isPlayer1 && isPlayer1) || (!data.isPlayer1 && !isPlayer1)) {
        const gameArea = document.getElementById('pvp-game-area');
        gameArea.classList.add('hit-effect');
        setTimeout(() => {
            gameArea.classList.remove('hit-effect');
        }, 300);
    }
    
    // 게임 종료 (중복 호출 방지)
    if (data.winner && pvpGameActive) {
        console.log('🏆 게임 종료 처리:', data.winner);
        endPvPGame(data.winner);
    }
});
