const worker = new Worker(new URL('./worker/worker.js', import.meta.url));
const img = document.getElementById('imagem_preview');
const inputImagem = document.getElementById('input_imagem');

const canvas = document.getElementById('image_output');

const ctx = canvas.getContext('2d');

worker.onmessage = ({ data }) => {
  if (data.type !== 'detections') return;

  debugger;
  drawCanvas(data);
}

inputImagem.addEventListener('change', (event) => {
  const arquivo = event.target.files[0];

  if (arquivo) {
    const leitor = new FileReader();

    leitor.onload = async function (e) {
      const image_data = e.target.result;
      img.src = image_data;
      img.style.display = 'block';

      worker.postMessage({
        type: 'predict',
        image: image_data,
      });
    }

    leitor.readAsDataURL(arquivo);
  }
  else {
    img.src = '';
    img.style.display = 'none';
  }
});

function drawCanvas({ detections, width, height }) {
  debugger
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  detections.forEach(d => {
    const [x, y, w, h] = d.bbox;

    //Configurações para a caixa
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    //Configurações para texto
    const txt = `${(d.score * 100).toFixed(0)}%`;
    const textWidth = ctx.measureText(txt).width;
    const textHeight = 20;
    const textY = y > textHeight ? y - textHeight : y;
    ctx.fillStyle = '#00FF00';
    ctx.font = '24px Arial';
    ctx.textBaseline = 'top';

    ctx.fillText(txt, textY, textWidth + 8, textHeight);
  });
}