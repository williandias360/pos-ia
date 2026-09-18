
importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/tf-tflite.min.js'
);

tflite.setWasmPath(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/'
);

const INPUT_MODEL_DIMENTIONS = 640;
const SCORE_THRESHOLD = 0.4;
const IOUTHRESHOLD = 0.40;
const LABELS_PATH = '../machine_learning/labels.json';
let _model = null;
let _labels = null;

/**
 * CORREÇÃO #1 - Pré-processamento (por que existe o "letterbox" abaixo?)
 * -----------------------------------------------------------------------
 * Versão ORIGINAL (com bug):
 *   const image = tf.browser.fromPixels(input);
 *   tf.image.resizeBilinear(image, [640, 640])
 *
 * Isso fazia um "stretch" (esticar) direto da imagem para 640x640, sem se
 * importar com a proporção original. Se a foto não é quadrada (ex: 768x576),
 * a imagem fica achatada/esticada de forma diferente no eixo X e no eixo Y.
 *
 * O YOLO foi treinado com imagens em "letterbox": redimensiona mantendo a
 * proporção original e preenche ("pad") o espaço que sobra com uma cor cinza
 * neutra (114), até formar o quadrado 640x640. Ao alimentar o modelo com uma
 * imagem esticada (fora do padrão que ele aprendeu), a posição do objeto
 * detectado sai um pouco deslocada em relação à posição real - foi o que
 * causei o "deslocamento horizontal" reportado, já que o desvio depende de
 * quanto cada eixo foi esticado.
 *
 * Por isso agora calculamos `scale`, `padLeft` e `padTop` e devolvemos esses
 * valores junto do tensor: eles serão necessários depois, na hora de reverter
 * o processo e converter as coordenadas da caixa de volta para a imagem
 * original (ver CORREÇÃO #4 mais abaixo, no passo 7 do processYOLOOutput).
 */
function preprocessImage(input) {
  const origWidth = input.width;
  const origHeight = input.height;

  const scale = Math.min(
    INPUT_MODEL_DIMENTIONS / origWidth,
    INPUT_MODEL_DIMENTIONS / origHeight
  );
  const resizedWidth = Math.round(origWidth * scale);
  const resizedHeight = Math.round(origHeight * scale);
  const padLeft = Math.floor((INPUT_MODEL_DIMENTIONS - resizedWidth) / 2);
  const padTop = Math.floor((INPUT_MODEL_DIMENTIONS - resizedHeight) / 2);
  const padRight = INPUT_MODEL_DIMENTIONS - resizedWidth - padLeft;
  const padBottom = INPUT_MODEL_DIMENTIONS - resizedHeight - padTop;

  const tensor = tf.tidy(() => {
    const image = tf.browser.fromPixels(input);
    const resized = tf.image.resizeBilinear(image, [resizedHeight, resizedWidth]);

    // Preenche o restante do quadrado 640x640 com cinza (114), padrão do letterbox do YOLO
    const padded = resized.pad(
      [[padTop, padBottom], [padLeft, padRight], [0, 0]],
      114
    );

    return padded
      .expandDims(0)
      .toFloat()
      .div(255)
      .transpose([0, 3, 1, 2]);
  });

  return { tensor, scale, padLeft, padTop };
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

    _labels = await (await fetch(LABELS_PATH)).json();

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

/**
 * CORREÇÃO #2 - runInference (o bug mais grave: escala errada no output)
 * -----------------------------------------------------------------------
 * Versão ORIGINAL (com bug):
 *   const output = await _model.predict(tensor);
 *   return tf.mul(tf.add(output, 1), 127.5);
 *
 * A fórmula `(x + 1) * 127.5` é usada para DESNORMALIZAR IMAGENS: converte
 * valores no intervalo [-1, 1] de volta para pixels [0, 255]. Isso é comum em
 * pós-processamento de GANs/autoencoders, mas aqui estava sendo aplicada por
 * engano em cima da SAÍDA do modelo de detecção (as 4 coordenadas da caixa +
 * 80 scores de classe), que não têm nada a ver com pixels de imagem.
 *
 * Como descobrimos: ao testar com uma imagem real, o placar de confiança
 * aparecia como "24629%" (deveria ser no máximo 100%). Calculando ao
 * contrário: 0.9317 (score real, já entre 0 e 1) → (0.9317 + 1) * 127.5 ≈
 * 246,3 → exibido como 24629% depois do `.toFixed(0)` * 100. Ou seja, a
 * fórmula estava distorcendo tanto os scores quanto as coordenadas da caixa,
 * o que explicava tanto o placar absurdo quanto a caixa desenhada longe do
 * cachorro. A correção é simplesmente NÃO transformar a saída do modelo -
 * ela já vem pronta para uso (ver CORREÇÃO #3 a seguir).
 */
async function runInference(tensor) {
  return _model.predict(tensor);
}

async function processYOLOOutput(outputTensor, scale, padLeft, padTop, scoreThreshold, iouThreshold) {
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

    /**
     * CORREÇÃO #3 - Normalização em dobro (boxes "encolhendo" para perto de zero)
     * ---------------------------------------------------------------------------
     * Versão ORIGINAL (com bug), depois de corrigir o runInference acima:
     *   const ymin = cy.sub(h.div(2)).div(INPUT_MODEL_DIMENTIONS);
     *   (idem para xmin, ymax, xmax)
     *
     * O modelo (YOLOv8 exportado para TFLite) já devolve cx, cy, w, h
     * NORMALIZADOS entre 0 e 1 (fração do quadrado 640x640), e não em pixels
     * (0 a 640) como o código original assumia. Ao dividir de novo por
     * INPUT_MODEL_DIMENTIONS (640), um valor já pequeno (ex.: 0.17) virava
     * 0.17/640 ≈ 0.00027 - ou seja, praticamente zero.
     *
     * Como descobrimos: instrumentamos o worker e logamos o bbox final. As
     * caixas vinham com X e Y minúsculos (ex.: 0.20) misturados com um valor
     * de Y gigante e negativo (-95.5) depois do desfazer-letterbox - um sinal
     * claro de que xmin/ymin estavam sendo "esmagados" antes de chegar lá.
     * A correção é não dividir por INPUT_MODEL_DIMENTIONS aqui: mantemos
     * ymin/xmin/ymax/xmax já normalizados (0 a 1), que é o formato que o
     * `tf.image.nonMaxSuppression` espera e também o formato que a CORREÇÃO #4
     * (abaixo) espera receber para desfazer o letterbox corretamente.
     */
    const cx = boxes.slice([0, 0], [-1, 1]);
    const cy = boxes.slice([0, 1], [-1, 1]);
    const w = boxes.slice([0, 2], [-1, 1]);
    const h = boxes.slice([0, 3], [-1, 1]);

    const ymin = cy.sub(h.div(2));
    const xmin = cx.sub(w.div(2));
    const ymax = cy.add(h.div(2));
    const xmax = cx.add(w.div(2));

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
      100, //Máximo de detecções retornadas
      iouThreshold, // Limiar de sobreposição (IoU)
      scoreThreshold, // Confiança mínima para considerar a caixa
    ).arraySync();

    //6. Extrai apenas os valores filtrados pelo NMS
    const selectedBoxes = formattedBoxes.gather(nmsIndices).arraySync();
    const selectedScores = maxScores.gather(nmsIndices).arraySync();
    const selectedClasses = classes.gather(nmsIndices).arraySync();

    //7. Mapeia para as coordenadas originais da imagem/canvas
    const mapBoxes = [];
    for (let index = 0; index < selectedBoxes.length; index++) {
      if (selectedScores[index] < SCORE_THRESHOLD) continue;
      const label = _labels[selectedClasses[index]];

      if (!['dog', 'person', 'cat', 'car'].includes(label)) continue;

      const [ymin, xmin, ymax, xmax] = selectedBoxes[index];

      /**
       * CORREÇÃO #4 - Mapear a caixa de volta para a imagem original
       * ---------------------------------------------------------------
       * Versão ORIGINAL (com bug):
       *   xmin * origWidth, ymin * origHeight, ...
       *
       * Essa conta só funciona se a imagem tivesse sido esticada (stretch)
       * direto para 640x640 sem preservar proporção. Como agora fazemos
       * letterbox no pré-processamento (CORREÇÃO #1: resize proporcional +
       * padding cinza), o caminho de volta precisa desfazer os MESMOS passos,
       * na ordem inversa:
       *   1. normalizado (0-1)      -> pixels dentro do quadrado 640x640 (* 640)
       *   2. pixels no quadrado 640 -> pixels na imagem redimensionada (- padding)
       *   3. imagem redimensionada  -> imagem original (/ scale)
       *
       * `scale`, `padLeft` e `padTop` são os mesmos valores calculados e
       * retornados lá no preprocessImage, repassados pelo onmessage abaixo.
       */
      const xMin = (xmin * INPUT_MODEL_DIMENTIONS - padLeft) / scale;
      const yMin = (ymin * INPUT_MODEL_DIMENTIONS - padTop) / scale;
      const xMax = (xmax * INPUT_MODEL_DIMENTIONS - padLeft) / scale;
      const yMax = (ymax * INPUT_MODEL_DIMENTIONS - padTop) / scale;

      mapBoxes.push({
        bbox: [
          xMin, // X
          yMin, // Y
          xMax - xMin, //Largura
          yMax - yMin, //Altura
        ],
        score: selectedScores[index],
        classId: selectedClasses[index],
        label: label,
      });
    }

    return mapBoxes;
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
  // preprocessImage agora devolve, além do tensor, o `scale`/`padLeft`/`padTop`
  // do letterbox (CORREÇÃO #1). Precisamos repassar esses 3 valores para
  // processYOLOOutput, pois são eles que permitem desfazer o letterbox no
  // passo 7 (CORREÇÃO #4) e devolver a caixa nas coordenadas certas.
  const { tensor, scale, padLeft, padTop } = preprocessImage(imageBitmap);
  const { width, height } = imageBitmap;

  //2. Inferência
  const inferenceResults = await runInference(tensor);

  //3. Pós processamento e NMS
  const detections = await processYOLOOutput(
    inferenceResults,
    scale,
    padLeft,
    padTop,
    SCORE_THRESHOLD,
    IOUTHRESHOLD
  );

  tensor.dispose();
  inferenceResults.dispose();

  postMessage({
    type: 'detections',
    width,
    height,
    detections
  });
};

console.log('🚀 Worker iniciado');