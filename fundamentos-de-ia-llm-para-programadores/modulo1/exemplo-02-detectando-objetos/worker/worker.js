
importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/tf-tflite.min.js'
);

tflite.setWasmPath(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/'
);

const INPUT_MODEL_DIMENTIONS = 640;
const SCORE_THRESHOLD = 0.25;
const IOUTHRESHOLD = 0.45;
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

async function processYOLOOoutput(outputTensor, width, height, scoreThreshold, iouThreshold) {
  return tf.tidy(() => {
    //1. Transpõe de [1, 84, 8400] para [8400, 84]
    const squeezed = outputTensor.squeeze([0]); //[84, 8400]
    const transposed = squeezed.transpose([1, 0]); //[8400, 84]

    //2. Separa Boundig Boxes [8400, 4] e Pontuações das classe [8400, 80]
    const boxes = transposed.slice([0, 0], [-1, 4]);
    const scores = transposed.slice([0, 4], [-1, 80]);

    //3. Obtém a maior pontuação e a classe correspondente para cada uma das 8400 caixas
    const maxScores = scores.max(1); //[8400]
    const classes = scores.argMax(1); //[8400]

    //4. Converte [center_x, center_y, width, height] -> [ymin, xmin, ymax, xmax] normalizados (0 a 1)
    const cx = boxes.slice([0, 0], [-1, 1]);
    const cy = boxes.slice([0, 1], [-1, 1]);
    const w = boxes.slice([0, 2], [-1, 1]);
    const h = boxes.slice([0, 3], [-1, 1]);

    debugger;
    const ymin = cy.sub(h.div(2)).div(INPUT_MODEL_DIMENTIONS);
    const xmin = cx.sub(w.div(2)).div(INPUT_MODEL_DIMENTIONS);
    const ymax = cy.add(h.div(2)).div(INPUT_MODEL_DIMENTIONS);
    const xmax = cy.add(w.div(2)).div(INPUT_MODEL_DIMENTIONS);

    const formattedBoxes = tf.concat([
      ymin,
      xmin,
      ymax,
      xmax
    ], 1); //[8400, 4]

    //5. Aplica Non-Maximum Suppresions (NMS)
    const nmsIndices = tf.image.nonMaxSuppression(
      formattedBoxes,
      maxScores,
      30, //Máximo de detecções retornadas
      iouThreshold, // Limiar de sobreposição (IoU)
      scoreThreshold, // Confiança mínima para considerar a caixa
    );

    //6. Extrai apenas os valores filtrados pelo NMS
    const selectedBoxes = formattedBoxes.gather(nmsIndices).arraySync();
    const selectedScores = maxScores.gather(nmsIndices).arraySync();
    const selectedClasses = classes.gather(nmsIndices).arraySync();

    //7. Mapeia para as coordenadas originais da imagem/canvas

    return selectedBoxes.map((box, index) => {
      const [ymin, xmin, ymax, xmax] = box;
      return {
        bbox: [
          xmin * width, // X
          ymax * height,// Y
          (xmax - xmin) * width, //Largura
          (ymax - ymax) * height, //Altura
        ],
        score: selectedScores[index],
        classId: selectedClasses[index],
      };
    });
  });
}

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
  const detections = await processYOLOOoutput(
    inferenceResults,
    width,
    height,
    SCORE_THRESHOLD,
    IOUTHRESHOLD
  );

  input.dispose();
  inferenceResults.dispose();

};

console.log('🚀 Worker iniciado');