
importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/tf-tflite.min.js'
);

tflite.setWasmPath(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/'
);

const INPUT_MODEL_DIMENTIONS = 640;
const SCORE_THRESHOLD = 0.5;
const IOUTHRESHOLD = 0.35;
let _model = null;

function preprocessImage(input) {
  return tf.tidy(() => {
    const image = tf.browser.fromPixels(input);

    return tf.image
      .resizeBilinear(image, [INPUT_MODEL_DIMENTIONS, INPUT_MODEL_DIMENTIONS])
      .expandDims(0)
      .toFloat()
      .div(255)
      .transpose([0, 3, 1, 2]);
  })
}

async function loadModel() {
  try {
    await tf.ready();

    const modelUrl = new URL(
      '../machine_learning/yolov8n.tflite',
      self.location.href
    );

    _model = await tflite.loadTFLiteModel(modelUrl.href, {
      numThreads: 1
    });

    console.log('✅ Modelo TFLite carregado');

    self.postMessage({
      type: 'model-loaded'
    });
  } catch (error) {
    console.error('❌ Erro ao carregar o modelo:', error);

    self.postMessage({
      type: 'model-error',
      message: error.message
    });
  }
}

async function runInference(tensor) {
  const output = await _model.predict(tensor);

  return tf.mul(tf.add(output, 1), 127.5);
}

async function processYOLOOutput(outputTensor, origWidth, origHeight, scoreThreshold, iouThreshold) {
  // return tf.tidy(() => {
  //   //1. Transpõe de [1, 84, 8400] para [8400, 84]
  //   const squeezed = outputTensor.squeeze([0]); //[84, 8400]
  //   const transposed = squeezed.transpose([1, 0]); //[8400, 84]

  //   //2. Separa Boundig Boxes [8400, 4] e Pontuações das classe [8400, 80]
  //   const boxes = transposed.slice([0, 0], [-1, 4]);
  //   const scores = transposed.slice([0, 4], [-1, 80]);

  //   //3. Obtém a maior pontuação e a classe correspondente para cada uma das 8400 caixas
  //   const maxScores = scores.max(1); //[8400]
  //   const classes = scores.argMax(1); //[8400]

  //   //4. Converte [center_x, center_y, width, height] -> [ymin, xmin, ymax, xmax] normalizados (0 a 1)
  //   const cx = boxes.slice([0, 0], [-1, 1]);
  //   const cy = boxes.slice([0, 1], [-1, 1]);
  //   const w = boxes.slice([0, 2], [-1, 1]);
  //   const h = boxes.slice([0, 3], [-1, 1]);

  //   const ymin = cy.sub(h.div(2)).div(INPUT_MODEL_DIMENTIONS);
  //   const xmin = cx.sub(w.div(2)).div(INPUT_MODEL_DIMENTIONS);
  //   const ymax = cy.add(h.div(2)).div(INPUT_MODEL_DIMENTIONS);
  //   const xmax = cy.add(w.div(2)).div(INPUT_MODEL_DIMENTIONS);

  //   const formattedBoxes = tf.concat([
  //     ymin,
  //     xmin,
  //     ymax,
  //     xmax
  //   ], 1); //[8400, 4]

  //   //5. Aplica Non-Maximum Suppresions (NMS)
  //   const nmsIndices = tf.image.nonMaxSuppression(
  //     formattedBoxes,
  //     maxScores,
  //     30, //Máximo de detecções retornadas
  //     iouThreshold, // Limiar de sobreposição (IoU)
  //     scoreThreshold, // Confiança mínima para considerar a caixa
  //   );

  //   //6. Extrai apenas os valores filtrados pelo NMS
  //   const selectedBoxes = formattedBoxes.gather(nmsIndices).arraySync();
  //   const selectedScores = maxScores.gather(nmsIndices).arraySync();
  //   const selectedClasses = classes.gather(nmsIndices).arraySync();

  //   //7. Mapeia para as coordenadas originais da imagem/canvas

  //   return selectedBoxes.map((box, index) => {
  //     const [ymin, xmin, ymax, xmax] = box;
  //     return {
  //       bbox: [
  //         xmin * width, // X
  //         ymax * height,// Y
  //         (xmax - xmin) * width, //Largura
  //         (ymax - ymax) * height, //Altura
  //       ],
  //       score: selectedScores[index],
  //       classId: selectedClasses[index],
  //     };
  //   });
  // });

  // 1. Extrai o array de dados puro e o formato [1, 84, 8400]
  const rawData = await outputTensor.data(); // Float32Array com 84 x 8400 valores
  const numAnchors = 8400;
  const numChannels = 84; // 4 (boxes) + 80 (classes)

  const boxes = [];
  const scores = [];
  const classIds = [];

  // 2. Loop direto pelos dados (evita erros de transposição do TFJS)
  for (let i = 0; i < numAnchors; i++) {
    // Busca a maior pontuação de classe para esta âncora
    let maxScore = 0;
    let maxClassId = -1;

    for (let c = 0; c < 80; c++) {
      // No formato [1, 84, 8400], o valor da classe 'c' na âncora 'i' fica no índice: (4 + c) * 8400 + i
      const score = rawData[(4 + c) * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = c;
      }
    }

    // Filtra apenas o que passa pelo score mínimo inicial
    if (maxScore >= scoreThreshold) {
      // Coordenadas da caixa (em escala 0 a 640)
      const cx = rawData[0 * numAnchors + i];
      const cy = rawData[1 * numAnchors + i];
      const w = rawData[2 * numAnchors + i];
      const h = rawData[3 * numAnchors + i];

      // Converte para [ymin, xmin, ymax, xmax] normalizados (0.0 a 1.0) para o NMS do TFJS
      const xmin = Math.max(0, (cx - w / 2) / 640);
      const ymin = Math.max(0, (cy - h / 2) / 640);
      const xmax = Math.min(1, (cx + w / 2) / 640);
      const ymax = Math.min(1, (cy + h / 2) / 640);

      boxes.push([ymin, xmin, ymax, xmax]);
      scores.push(maxScore);
      classIds.push(maxClassId);
    }
  }

  // Se nada ultrapassou o limiar de confiança, retorna array vazio
  if (boxes.length === 0) return [];

  // 3. Aplica o Non-Maximum Suppression (NMS) apenas nas caixas válidas
  return tf.tidy(() => {
    const boxesTensor = tf.tensor2d(boxes);
    const scoresTensor = tf.tensor1d(scores);

    const nmsIndices = tf.image.nonMaxSuppression(
      boxesTensor,
      scoresTensor,
      15,             // Máximo de detecções na imagem
      iouThreshold,   // Interseção sobre União (IoU)
      scoreThreshold
    );

    const indices = nmsIndices.arraySync();

    // 4. Converte as caixas filtradas para os pixels reais da tela (origWidth / origHeight)
    return indices.map((idx) => {
      const [ymin, xmin, ymax, xmax] = boxes[idx];
      return {
        bbox: [
          xmin * origWidth,                  // X
          ymin * origHeight,                 // Y
          (xmax - xmin) * origWidth,         // Largura
          (ymax - ymin) * origHeight         // Altura
        ],
        score: scores[idx],
        classId: classIds[idx]
      };
    });
  });
}

// async function processYOLOOutput(outputTensor, origWidth, origHeight, scoreThreshold = 0.50, iouThreshold = 0.35) {
//   const rawData = await outputTensor.data(); // Float32Array [84 x 8400]
//   const numAnchors = 8400;

//   const boxes = [];
//   const scores = [];
//   const classIds = [];

//   // 1. Decodificação das 8400 âncoras
//   for (let i = 0; i < numAnchors; i++) {
//     let maxScore = 0;
//     let maxClassId = -1;

//     // Busca a classe com maior pontuação
//     for (let c = 0; c < 80; c++) {
//       const score = rawData[(4 + c) * numAnchors + i];
//       if (score > maxScore) {
//         maxScore = score;
//         maxClassId = c;
//       }
//     }

//     // Só passa para o NMS se tiver confiança mínima de 50%
//     if (maxScore >= scoreThreshold) {
//       const cx = rawData[0 * numAnchors + i];
//       const cy = rawData[1 * numAnchors + i];
//       const w = rawData[2 * numAnchors + i];
//       const h = rawData[3 * numAnchors + i];

//       // Converte para [ymin, xmin, ymax, xmax] normalizados (0.0 a 1.0)
//       const xmin = Math.max(0, (cx - w / 2) / 640);
//       const ymin = Math.max(0, (cy - h / 2) / 640);
//       const xmax = Math.min(1, (cx + w / 2) / 640);
//       const ymax = Math.min(1, (cy + h / 2) / 640);

//       boxes.push([ymin, xmin, ymax, xmax]);
//       scores.push(maxScore);
//       classIds.push(maxClassId);
//     }
//   }

//   if (boxes.length === 0) return [];

//   // 2. Aplicação Rigorosa do Non-Maximum Suppression (NMS)
//   return tf.tidy(() => {
//     const boxesTensor = tf.tensor2d(boxes);   // Formato [N, 4] -> [ymin, xmin, ymax, xmax]
//     const scoresTensor = tf.tensor1d(scores); // Formato [N]

//     // O NMS do TFJS filtra caixas sobrepostas do mesmo objeto
//     const nmsIndices = tf.image.nonMaxSuppression(
//       boxesTensor,
//       scoresTensor,
//       5,              // Limita a no máximo 5 detecções principais na imagem
//       iouThreshold,   // 0.35 -> Descarta caixas com mais de 35% de sobreposição
//       scoreThreshold  // 0.50 -> Ignora palpites com menos de 50% de certeza
//     );

//     const selectedIndices = nmsIndices.arraySync();

//     // 3. Mapeia apenas os índices selecionados pelo NMS para as dimensões da tela
//     return selectedIndices.map((idx) => {
//       const [ymin, xmin, ymax, xmax] = boxes[idx];
//       return {
//         bbox: [
//           xmin * origWidth,                  // X (canto esquerdo)
//           ymin * origHeight,                 // Y (canto superior)
//           (xmax - xmin) * origWidth,         // Largura da caixa
//           (ymax - ymin) * origHeight         // Altura da caixa
//         ],
//         score: scores[idx],
//         classId: classIds[idx]
//       };
//     });
//   });
// }

loadModel();

self.onmessage = async ({ data }) => {
  if (data.type !== 'predict') return;
  if (!_model) {
    console.warn('Modelo ainda não foi carregado');
    return;
  }

  const dataUrl = data.image;
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();

  const blob = new Blob([arrayBuffer]);
  const imageBitmap = await createImageBitmap(blob);

  //1. Pré-processamento
  const input = preprocessImage(imageBitmap);
  const { width, height } = imageBitmap;

  //2. Inferência
  const inferenceResults = await runInference(input);

  //3. Pós processamento e NMS
  const detections = await processYOLOOutput(
    inferenceResults,
    width,
    height,
    SCORE_THRESHOLD,
    IOUTHRESHOLD
  );

  input.dispose();
  inferenceResults.dispose();

  postMessage({
    type: 'detections',
    width,
    height,
    detections
  });
};

console.log('🚀 Worker iniciado');