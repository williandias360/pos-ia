const BASE_URL = 'http://localhost:3333/api';
document.getElementById('btn-movies').addEventListener('click', async () => {
  await doGet('movies');
});

document.getElementById('btn-users').addEventListener('click', async () => {
  await doGet('users');
});

document.getElementById('btn-training-model').addEventListener('click', async () => {
  await doPost('training');
});


async function doGet(path) {
  const responseElement = document.getElementById('response');
  responseElement.textContent = 'Loading...';
  try {
    const response = await fetch(`${BASE_URL}/${path}`);
    const data = await response.json();
    responseElement.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    responseElement.textContent = `Error: ${error.message}`;
  }
}

async function doPost(path, body = null) {
  const responseElement = document.getElementById('response');
  responseElement.textContent = 'Loading...';
  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
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