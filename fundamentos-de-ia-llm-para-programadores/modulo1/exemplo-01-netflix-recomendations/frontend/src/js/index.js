const BASE_URL = 'http://localhost:3333';
document.getElementById('btn-movies').addEventListener('click', async () => {
  await doGet('movies');
});

document.getElementById('btn-users').addEventListener('click', async () => {
  await doGet('users');
});

document.getElementById('btn-training-model').addEventListener('click', async () => {
  await doPost('training');
});

document.getElementById('btn-users-watches').addEventListener('click', async () => {
  await doGet('users-watches');
})


async function doGet(path) {
  const responseElement = document.getElementById('response');
  responseElement.textContent = 'Loading...';
  try {
    const response = await fetch(`${BASE_URL}/api/${path}`);
    const json = await response.json();
    responseElement.textContent = JSON.stringify(json.data.slice(0, 1000), null, 2);
  } catch (error) {
    responseElement.textContent = `Error: ${error.message}`;
  }
}

async function doPost(path, body = null) {
  const responseElement = document.getElementById('response');
  responseElement.textContent = 'Loading...';
  try {
    const response = await fetch(`${BASE_URL}/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });

    const data = await response.json();
    responseElement.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    responseElement.textContent = `Error: ${error.message}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const socket = io(BASE_URL, {
    transports: ['websocket']
  });

  let primeiro = true;
  socket.on('training_progress', (progress) => {
    const responseElement = document.getElementById('response');
    const progressBar = document.getElementById('progress');

    const { epoch, progress: localProgress, logs: { loss, acc } } = progress
    responseElement.innerHTML += `${new Date().toLocaleString()} Epoch: ${epoch} | Progress: ${localProgress} | Loss: ${loss} | Acc: ${acc}<br/>`;
    progressBar.value = localProgress;
  });

  socket.on('training_start', () => {
    const responseElement = document.getElementById('response');
    responseElement.innerHTML = '';

    const progress = document.getElementById('progress');
    progress.value = 0
  });
});