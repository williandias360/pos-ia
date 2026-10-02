const worker = new Worker(new URL('./worker/worker.js', import.meta.url));
const img = document.getElementById('imagem_preview');
const inputImagem = document.getElementById('input_imagem');

const canvas = document.getElementById('image_output');
canvas.width = img.clientWidth || img.width;
canvas.height = img.clientHeight || img.height;
const ctx = canvas.getContext('2d');

worker.onmessage = ({ data }) => {
  if (data.type !== 'detections') return;
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
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /**
   * CORREÇÃO #5 - Escala/offset do canvas em cima do <img>
   * -------------------------------------------------------
   * Versão ORIGINAL (com bug):
   *   canvas.width = img.width;
   *   canvas.height = img.height;
   *   ... depois usava d.bbox direto: ctx.strokeRect(x, y, w, h)
   *
   * `d.bbox` vem do worker em PIXELS DA IMAGEM ORIGINAL (ex.: 768x576), mas o
   * <canvas> é desenhado por cima do <img>, que no CSS tem
   * `width: 600px; height: 600px; object-fit: contain`. Esse `object-fit`
   * redimensiona a imagem MANTENDO a proporção dentro da caixa 600x600,
   * sobrando um espaço vazio (letterbox) nas laterais ou em cima/baixo quando
   * a foto não é quadrada — desenhar o bbox "cru" (sem reescalar) fazia a
   * caixa não bater com o que é realmente exibido na tela.
   *
   * A correção replica a MESMA conta que o `object-fit: contain` faz
   * internamente: calcula um fator de escala (a menor proporção entre
   * largura/altura do canvas e da imagem original) e um deslocamento
   * (`offsetX`/`offsetY`) para centralizar, e aplica os dois em cada bbox
   * antes de desenhar.
   */
  const scale = Math.min(canvas.width / width, canvas.height / height);
  const offsetX = (canvas.width - width * scale) / 2;
  const offsetY = (canvas.height - height * scale) / 2;

  detections.forEach(d => {
    const [bx, by, bw, bh] = d.bbox;
    const x = bx * scale + offsetX;
    const y = by * scale + offsetY;
    const w = bw * scale;
    const h = bh * scale;

    //Configurações para a caixa
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    //Configurações para texto
    const txt = `${d.label} ${(d.score * 100).toFixed(0)}%`;
    const textHeight = 20;
    const textY = y > textHeight ? y - textHeight : y;
    ctx.fillStyle = '#00FF00';
    ctx.font = '24px Arial';
    ctx.textBaseline = 'top';

    ctx.fillText(txt, x, textY);
  });
}