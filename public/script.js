// 기본 변수들
let username = '';
let userColor = '';
let isAdmin = false;
let isSuspended = false;
let messageIdCounter = 0;
let editingMessageId = null;
const ADMIN_USERNAME = '앳새이하준';
const onlineUsers = {};
const socket = io();

// 게임 관련 변수
let gameActive = false;
let player = null;
let gameArea = null;
let bubbles = [];
let playerY = 0;
let playerVelocityY = 0;
let playerX = 50; // 퍼센트
let score = 0;
let gameInterval = null;

// 랜덤 색상 생성
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2',
        '#FADBD8', '#D5F4E6', '#FCF3CF', '#EBDEF0', '#D6EAF8',
        '#FFB74D', '#81C784', '#64B5F6', '#F06292', '#BA68C8',
        '#FF8A65', '#4DB6AC', '#9575CD', '#7986CB', '#5DADE2',
        '#58D68D', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471',
        '#FF9999', '#99CCFF', '#99FF99', '#FFCC99', '#FF99CC',
        '#CCFF99', '#99FFCC', '#CC99FF', '#FFFF99', '#FF6666'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 시간 포맷
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 이모지만 있는지 확인하는 함수
function isEmojiOnly(text) {
    const emojiRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
    return emojiRegex.test(text.trim());
}

// 이모지 애니메이션 함수
function createFlyingEmoji(emoji, startX, startY) {
    const flyingEmoji = document.createElement('div');
    flyingEmoji.classList.add('flying-emoji');
    flyingEmoji.textContent = emoji;
    flyingEmoji.style.left = startX + 'px';
    flyingEmoji.style.top = startY + 'px';
    
    document.body.appendChild(flyingEmoji);
    
    setTimeout(() => {
        flyingEmoji.remove();
    }, 3000);
}

// 메시지 삭제 함수
function deleteMessage(messageId) {
    if (confirm('이 메시지를 삭제하시겠습니까?')) {
        socket.emit('deleteMessage', { messageId });
    }
}

// 메시지 수정 함수
function editMessage(messageId, currentText) {
    editingMessageId = messageId;
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    const messageContent = messageElement.querySelector('.message-content');
    
    messageElement.classList.add('editing-message');
    
    const editContainer = document.createElement('div');
    editContainer.innerHTML = `
        <input type="text" class="edit-input" value="${currentText}" id="edit-input-${messageId}">
        <div class="edit-actions">
            <button class="edit-save" onclick="saveEdit('${messageId}')">저장</button>
            <button class="edit-cancel" onclick="cancelEdit('${messageId}')">취소</button>
        </div>
    `;
    
    messageContent.innerHTML = '';
    messageContent.appendChild(editContainer);
    
    document.getElementById(`edit-input-${messageId}`).focus();
}

// 수정 저장
function saveEdit(messageId) {
    const newText = document.getElementById(`edit-input-${messageId}`).value.trim();
    if (newText) {
        socket.emit('editMessage', { messageId, newText });
    }
    cancelEdit(messageId);
}

// 수정 취소
function cancelEdit(messageId) {
    editingMessageId = null;
    location.reload(); // 간단한 방법으로 새로고침
}

// 메시지 추가 (개선)
function addMessage(message, isUser = false, isSystem = false, isAdmin = false, isKick = false, messageId = null, isEdited = false) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    
    messageElement.classList.add('message');
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    
    // 이모지만 있는 메시지인지 확인
    const isEmojiOnlyMessage = !isSystem && !isAdmin && !isKick && isEmojiOnly(message);
    
    if (isEmojiOnlyMessage) {
        messageElement.classList.add('emoji-only-message');
        if (isUser) {
            messageElement.style.alignSelf = 'flex-end';
        } else {
            messageElement.style.alignSelf = 'flex-start';
        }
        
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.textContent = message;
        messageElement.appendChild(messageContent);
        
        // 시간 정보 추가
        const timeInfo = document.createElement('div');
        timeInfo.classList.add('message-info');
        timeInfo.textContent = formatTime(new Date());
        messageElement.appendChild(timeInfo);
        
        // 이모지 애니메이션 효과
        const rect = messagesContainer.getBoundingClientRect();
        const randomX = rect.left + Math.random() * rect.width;
        const randomY = rect.top + Math.random() * rect.height;
        createFlyingEmoji(message, randomX, randomY);
        
    } else if (isKick) {
        messageElement.classList.add('kick-message');
        messageElement.innerHTML = message;
    } else if (isAdmin) {
        messageElement.classList.add('admin-message');
        messageElement.innerHTML = message;
    } else if (isSystem) {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = message;
    } else if (isUser) {
        messageElement.classList.add('user-message');
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.innerHTML = message + (isEdited ? ' <span style="opacity: 0.7; font-size: 10px;">(수정됨)</span>' : '');
        messageElement.appendChild(messageContent);
        
        // 본인 메시지에 삭제/수정 버튼 추가
        if (messageId) {
            const actions = document.createElement('div');
            actions.classList.add('message-actions');
            actions.innerHTML = `
                <button class="action-btn" onclick="editMessage('${messageId}', '${message.replace(/'/g, '\\\'')}')" title="수정">✏️</button>
                <button class="action-btn" onclick="deleteMessage('${messageId}')" title="삭제">🗑️</button>
            `;
            messageElement.appendChild(actions);
        }
        
        // 시간 정보 추가
        const timeInfo = document.createElement('div');
        timeInfo.classList.add('message-info');
        timeInfo.textContent = formatTime(new Date());
        messageElement.appendChild(timeInfo);
    } else {
        messageElement.classList.add('other-message');
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.innerHTML = message + (isEdited ? ' <span style="opacity: 0.7; font-size: 10px;">(수정됨)</span>' : '');
        messageElement.appendChild(messageContent);
    }
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 메시지 전송 (개선)
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (message) {
        // 관리자 명령어 처리
        if (isAdmin) {
            if (message.startsWith('/정지 ')) {
                const parts = message.split(' ');
                if (parts.length >= 3) {
                    const targetUsername = parts[1];
                    const duration = parseInt(parts[2]);
                    if (!isNaN(duration)) {
                        socket.emit('suspendUser', { targetUsername, duration });
                        messageInput.value = '';
                        return;
                    }
                }
            }
            if (message.startsWith('/강퇴 ')) {
                const parts = message.split(' ');
                if (parts.length >= 2) {
                    const targetUsername = parts[1];
                    socket.emit('kickUser', { targetUsername });
                    messageInput.value = '';
                    return;
                }
            }
        }
        
        // 메시지 ID 생성
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        socket.emit('sendMessage', {
            text: message,
            messageId: messageId
        });
        messageInput.value = '';
    }
}

// 사용자 목록 업데이트
function updateOnlineUsersList() {
    const usersListElement = document.getElementById('users-list');
    usersListElement.innerHTML = '';
    
    for (const userId in onlineUsers) {
        const user = onlineUsers[userId];
        const userElement = document.createElement('div');
        userElement.classList.add('user-item');
        userElement.innerHTML = `
            <div class="user-info">
                <div class="user-color" style="background-color: ${user.color}"></div>
                <div class="user-name">
                    ${user.username}${user.id === socket.id ? ' (나)' : ''}
                    ${user.isAdmin ? '<span class="admin-badge">관리자</span>' : ''}
                </div>
            </div>
        `;
        usersListElement.appendChild(userElement);
    }
}

// 게임 시작
function startGame() {
    gameActive = true;
    score = 0;
    playerY = 500;
    playerVelocityY = 0;
    playerX = 50;
    bubbles = [];
    
    document.getElementById('game-container').style.display = 'flex';
    gameArea = document.getElementById('game-area');
    player = document.getElementById('player');
    
    // 초기 플랫폼 생성
    createBubblePlatform(200, 450, '점프!');
    createBubblePlatform(100, 350, 'ㅎㅇ');
    createBubblePlatform(300, 250, '대박!');
    
    gameInterval = setInterval(updateGame, 16); // 60fps
}

// 게임 종료
function endGame() {
    gameActive = false;
    clearInterval(gameInterval);
    document.getElementById('game-container').style.display = 'none';
    
    // 게임 결과 채팅에 전송
    if (score > 0) {
        socket.emit('sendMessage', {
            text: `🎮 게임 결과: ${score}m 높이까지 올라갔어요!`,
            messageId: `game_${Date.now()}`
        });
    }
}

// 말풍선 플랫폼 생성
function createBubblePlatform(x, y, text) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble-platform');
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
    bubble.textContent = text;
    bubble.dataset.x = x;
    bubble.dataset.y = y;
    
    gameArea.appendChild(bubble);
    bubbles.push(bubble);
}

// 게임 업데이트
function updateGame() {
    if (!gameActive) return;
    
    // 플레이어 물리
    playerVelocityY += 0.8; // 중력
    playerY += playerVelocityY;
    
    // 플랫폼 충돌 검사
    bubbles.forEach(bubble => {
        const bubbleX = parseInt(bubble.dataset.x);
        const bubbleY = parseInt(bubble.dataset.y);
        const playerScreenX = (playerX / 100) * 400;
        
        // 충돌 검사
        if (playerY >= bubbleY - 30 && playerY <= bubbleY + 10 &&
            playerScreenX >= bubbleX - 20 && playerScreenX <= bubbleX + 80 &&
            playerVelocityY > 0) {
            playerVelocityY = -15; // 점프
            
            // 점수 업데이트
            const height = Math.max(0, Math.floor((600 - playerY) / 10));
            if (height > score) {
                score = height;
                document.getElementById('game-score').textContent = score;
            }
        }
    });
    
    // 새로운 플랫폼 생성
    if (Math.random() < 0.02 && bubbles.length < 10) {
        const messages = ['ㅋㅋㅋ', '와!', '대박', '굿', '화이팅', '점프!', '높이!', '오케이'];
        const randomX = Math.random() * 300;
        const randomY = Math.random() * 100 + 150;
        createBubblePlatform(randomX, randomY, messages[Math.floor(Math.random() * messages.length)]);
    }
    
    // 화면 아래로 떨어지면 게임 오버
    if (playerY > 650) {
        endGame();
        return;
    }
    
    // 플레이어 위치 업데이트
    player.style.left = playerX + '%';
    player.style.bottom = (600 - playerY) + 'px';
    
    // 오래된 플랫폼 제거
    bubbles = bubbles.filter(bubble => {
        const bubbleY = parseInt(bubble.dataset.y);
        if (bubbleY > playerY + 200) {
            bubble.remove();
            return false;
        }
        return true;
    });
}

// 이벤트 리스너들
document.addEventListener('DOMContentLoaded', () => {
    // 사용자 이름 입력
    document.getElementById('username-submit').addEventListener('click', () => {
        const usernameInput = document.getElementById('username-input');
        username = usernameInput.value.trim();
        
        if (username) {
            userColor = getRandomColor();
            isAdmin = (username === ADMIN_USERNAME);
            document.getElementById('username-modal').style.display = 'none';
            
            socket.emit('join', {
                username: username,
                color: userColor,
                isAdmin: isAdmin
            });
        }
    });
    
    // 메시지 입력
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('send-button').addEventListener('click', sendMessage);
    
    // 사용자 목록 토글
    document.getElementById('users-toggle').addEventListener('click', () => {
        const panel = document.getElementById('users-panel');
        const icon = document.querySelector('.toggle-icon');
        panel.classList.toggle('active');
        icon.classList.toggle('active');
    });
    
    // 이모지 버튼
    document.getElementById('emoji-button').addEventListener('click', () => {
        const picker = document.getElementById('emoji-picker');
        picker.classList.toggle('active');
    });
    
    // 이모지 선택
    document.querySelectorAll('.emoji-item').forEach(button => {
        button.addEventListener('click', () => {
            const emoji = button.textContent;
            const messageInput = document.getElementById('message-input');
            messageInput.value += emoji;
            messageInput.focus();
            document.getElementById('emoji-picker').classList.remove('active');
        });
    });
    
    // 게임 버튼
    document.getElementById('game-button').addEventListener('click', startGame);
    document.getElementById('game-close').addEventListener('click', endGame);
    
    // 이모지 선택기 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('emoji-picker');
        const button = document.getElementById('emoji-button');
        
        if (!picker.contains(e.target) && !button.contains(e.target)) {
            picker.classList.remove('active');
        }
    });
});

// 키보드 이벤트 (게임용)
document.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    
    switch(e.code) {
        case 'Space':
            e.preventDefault();
            if (playerVelocityY >= 0) {
                playerVelocityY = -15;
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            playerX = Math.max(5, playerX - 5);
            break;
        case 'ArrowRight':
            e.preventDefault();
            playerX = Math.min(95, playerX + 5);
            break;
    }
});

// 소켓 이벤트들
// 소켓 이벤트들
socket.on('userJoined', (data) => {
    addMessage(`${data.username}님이 입장했습니다.`, false, true);
    document.getElementById('user-count').textContent = data.userCount;
    onlineUsers[data.id] = data;
    updateOnlineUsersList();
});

socket.on('userLeft', (data) => {
    addMessage(`${data.username}님이 퇴장했습니다.`, false, true);
    document.getElementById('user-count').textContent = data.userCount;
    for (const userId in onlineUsers) {
        if (onlineUsers[userId].username === data.username) {
            delete onlineUsers[userId];
            break;
        }
    }
    updateOnlineUsersList();
});

socket.on('newMessage', (data) => {
    const isMyMessage = data.sender === username;
    if (isMyMessage) {
        addMessage(data.text, true, false, false, false, data.messageId, data.isEdited);
    } else {
        const messageWithSender = `<strong style="color: ${data.color}">${data.sender}</strong>: ${data.text}`;
        addMessage(messageWithSender, false, false, false, false, data.messageId, data.isEdited);
    }
});

// 메시지 삭제 이벤트
socket.on('messageDeleted', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        messageElement.classList.add('deleted-message');
        const content = messageElement.querySelector('.message-content');
        if (content) {
            content.innerHTML = '<em>삭제된 메시지입니다</em>';
        }
        const actions = messageElement.querySelector('.message-actions');
        if (actions) {
            actions.remove();
        }
    }
});

// 메시지 수정 이벤트
socket.on('messageEdited', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const content = messageElement.querySelector('.message-content');
        if (content) {
            content.innerHTML = data.newText + ' <span style="opacity: 0.7; font-size: 10px;">(수정됨)</span>';
        }
    }
});

socket.on('connect', () => {
    addMessage('서버에 연결되었습니다.', false, true);
    socket.emit('getActiveUsers');
});

socket.on('activeUsers', (users) => {
    for (const userId in users) {
        onlineUsers[userId] = users[userId];
    }
    updateOnlineUsersList();
});

socket.on('joinError', (data) => {
    alert(data.message);
    document.getElementById('username-modal').style.display = 'flex';
    document.getElementById('username-input').focus();
});

// 관리자 기능 소켓 이벤트들
socket.on('userSuspended', (data) => {
    addMessage(`${data.adminUsername}님이 ${data.username}님을 ${data.duration}초 동안 정지했습니다.`, false, false, true);
});

socket.on('userKicked', (data) => {
    addMessage(`${data.adminUsername}님이 ${data.username}님을 강퇴했습니다.`, false, false, false, true);
});

socket.on('kicked', (data) => {
    addMessage(`${data.adminUsername}님에 의해 강퇴되었습니다.`, false, false, false, true);
    document.getElementById('message-input').disabled = true;
    document.getElementById('send-button').disabled = true;
});

window.onload = () => {
    document.getElementById('username-input').focus();
};
