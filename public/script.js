// 기본 변수들
let username = '';
let userColor = '';
let isAdmin = false;
let isSuspended = false;
const ADMIN_USERNAME = '앳새이하준';
const onlineUsers = {};
const socket = io();

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

// 메시지 추가
function addMessage(message, isUser = false, isSystem = false, isAdmin = false) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (isSystem) {
        messageElement.classList.add('system-message');
    } else if (isAdmin) {
        messageElement.classList.add('admin-message');
    } else if (isUser) {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('other-message');
    }
    
    messageElement.innerHTML = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 메시지 전송
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (message) {
        socket.emit('sendMessage', { text: message });
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
                <div class="user-name">${user.username}${user.id === socket.id ? ' (나)' : ''}</div>
            </div>
        `;
        usersListElement.appendChild(userElement);
    }
}

// 이벤트 리스너들
document.addEventListener('DOMContentLoaded', () => {
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
    
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('send-button').addEventListener('click', sendMessage);
    
    document.getElementById('users-toggle').addEventListener('click', () => {
        const panel = document.getElementById('users-panel');
        const icon = document.querySelector('.toggle-icon');
        panel.classList.toggle('active');
        icon.classList.toggle('active');
    });
});

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
        addMessage(data.text, true);
    } else {
        addMessage(`<strong style="color: ${data.color}">${data.sender}</strong>: ${data.text}`);
    }
});

socket.on('connect', () => {
    addMessage('서버에 연결되었습니다.', false, true);
});

socket.on('activeUsers', (users) => {
    for (const userId in users) {
        onlineUsers[userId] = users[userId];
    }
    updateOnlineUsersList();
});

socket.on('getActiveUsers', () => {
    socket.emit('getActiveUsers');
});

window.onload = () => {
    document.getElementById('username-input').focus();
};
