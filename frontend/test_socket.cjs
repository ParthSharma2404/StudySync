const io = require('socket.io-client');

async function runTest() {
  console.log('--- Starting Integration Test ---');
  try {
    // 1. Create a User
    const ts = Date.now();
    const username = `testuser_${ts}`;
    const email = `testuser_${ts}@example.com`;
    const password = `password123`;

    console.log('Registering user...');
    let res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (!res.ok) throw new Error(await res.text());

    console.log('Logging in...');
    res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    const authData = await res.json();
    const token = authData.token;
    const user = authData.user;
    console.log('User logged in:', user.id);

    // 2. Create a Room
    console.log('Creating room...');
    res = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Room', description: 'Testing' })
    });
    if (!res.ok) throw new Error(await res.text());
    const roomData = await res.json();
    const roomId = roomData.roomId;
    console.log('Room created:', roomId);

    // 3. Connect via Socket
    console.log('Connecting socket...');
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      
      console.log('Emitting identify...');
      socket.emit('identify', { userId: user.id, username: user.username });

      console.log('Emitting join-room...');
      socket.emit('join-room', {
        roomId: roomId,
        userId: user.id,
        username: user.username,
        peerId: 'dummy-peer'
      });
    });

    socket.on('room-state-updated', (state) => {
      console.log('--> room-state-updated received!');
      console.log('Moderator ID:', state.moderatorId);
      console.log('Participants:', state.participants.length);
      
      if (state.moderatorId === user.id) {
        console.log('SUCCESS: Moderator matches user id!');
        console.log('Emitting task-create...');
        socket.emit('task-create', { title: 'Test Task 1' });
      } else {
        console.error('FAIL: Moderator does not match user id!');
      }
    });

    socket.on('tasks-updated', (tasks) => {
      console.log('--> tasks-updated received!');
      console.log('Tasks:', tasks);
      if (tasks.length > 0) {
        console.log('SUCCESS: Task was created and broadcasted!');
        process.exit(0);
      }
    });

    setTimeout(() => {
      console.error('Test timeout!');
      process.exit(1);
    }, 5000);

  } catch (e) {
    console.error('Error in test:', e);
    process.exit(1);
  }
}

runTest();
