const worker = new Worker(new URL('./worker/worker.js', import.meta.url));

worker.onmessage = ({ data }) => {

}

const img = document.getElementById('imagem_preview');
const inputImagem = document.getElementById('input_imagem');

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
})