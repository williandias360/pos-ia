import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';

let trainingWorker;
let trainingState = { state: 'idle' };
const trainingEvents = new EventEmitter();

function createTrainingWorker() {
  const worker = new Worker(
    new URL('../workers/modelTrainingWorker.js', import.meta.url),
    {
      type: 'module',
      execArgv: process.execArgv.filter((argument) => !argument.startsWith('--input-type')),
    },
  );

  worker.on('message', (message) => {
    if (message.type === 'progress') {
      trainingState = { state: 'running', ...message };
      trainingEvents.emit('progress', message);
    }

    if (message.type === 'complete') {
      trainingState = { state: 'complete', ...message };
    }

    if (message.type === 'error') {
      trainingState = { state: 'error', error: message.error };
    }
  });

  worker.on('error', (error) => {
    console.error('Erro ao iniciar/executar o worker:', error);
    trainingState = { state: 'error', error: error.message };
  });

  worker.on('exit', () => {
    trainingWorker = undefined;
  });

  return worker;
}

export function startTraining(data = {}) {
  if (trainingWorker) return trainingState;

  trainingState = { state: 'running', progress: 0 };
  trainingWorker = createTrainingWorker();
  trainingWorker.postMessage({
    action: 'trainingModel', ...data
  });

  return trainingState;
}

export function getTrainingStatus() {
  return trainingState;
}

export function onTrainingProgress(listener) {
  trainingEvents.on('progress', listener);
  return () => trainingEvents.off('progress', listener);
}