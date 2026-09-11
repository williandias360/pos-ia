import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

console.log('Model training worker initialized');
let _globalCtx = {};
let _model = null;
const WEIGHTS = {
    category: 0.4,
    color: 0.3,
    price: 0.2,
    age: 0.1,
};
//Normaliza os valores (price, age) para o intervalo de 0-1
//Mantém os dados balanceados para o treinamento
//Formula: (val - min) / (max - min)
const normalize = (value, min, max) => (value - min) / ((max - min) || 1)

function makeContext(products, users) {
    const ages = users.map(u => u.age);
    const prices = products.map(p => p.price);
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const colors = [...new Set(products.map(p => p.color))];
    const categories = [...new Set(products.map(p => p.category))];

    const colorsIndex = Object.fromEntries(colors.map((color, index) => {
        return [color, index]
    }));

    const categoriesIndex = Object.fromEntries(categories.map((category, index) => {
        return [category, index]
    }));

    //Computatar a média de idade dos compradores por produto
    //(ajuda a personalizar)
    const midAge = (minAge + maxAge) / 2;
    const ageSums = {};
    const ageCounts = {};

    users.forEach(user => {
        user.purchases.forEach(p => {
            ageSums[p.name] = (ageSums[p.name] || 0) + user.age;
            ageCounts[p.name] = (ageCounts[p.name] || 0) + 1;
        })
    });

    const productAvgAgeNorm = Object.fromEntries(
        products.map(product => {
            const avg = ageCounts[product.name] ?
                ageSums[product.name] / ageCounts[product.name] :
                minAge

            return [product.name, normalize(avg, minAge, maxAge)]
        })
    )

    return {
        products,
        users,
        colorsIndex,
        categoriesIndex,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        productAvgAgeNorm,
        numCategories: categories.length,
        numColors: colors.length,
        //price + age + colors + categories
        dimentions: 2 + categories.length + colors.length,
    }
}

const oneHotWeighted = (index, length, weight) => tf
    .oneHot(index, length)
    .cast('float32')
    .mul(weight);

function encodeProduct(product, context) {
    //Normalizando dados para ficar de 0 a 1 e aplicar o preço na recomendação
    const price = tf.tensor1d([
        normalize(
            product.price,
            context.minPrice,
            context.maxPrice
        ) * WEIGHTS.price
    ]);

    const age = tf.tensor1d([
        (
            context.productAvgAgeNorm[product.name] ?? 0.5
        ) * WEIGHTS.age
    ]);

    const category = oneHotWeighted(
        context.categoriesIndex[product.category],
        context.numCategories,
        WEIGHTS.category
    );

    const color = oneHotWeighted(
        context.colorsIndex[product.color],
        context.numColors,
        WEIGHTS.color
    );

    return tf.concat1d(
        [price, age, category, color]
    );
}

function encodeUser(user, context) {
    if (user.purchases.length) {
        return tf.stack(
            user.purchases.map(
                product => encodeProduct(product, context)
            )
        )
            .mean(0)
            .reshape([
                1,
                context.dimentions
            ])
    }

    return tf.concat1d(
        [
            tf.zeros([1]), //preço é ignorado
            tf.tensor1d([
                normalize(user.age, context.minAge, context.maxAge) * WEIGHTS.age
            ]),
            tf.zeros([context.numCategories]), //categoria ignorada
            tf.zeros([context.numColors]), //color ignorada
        ]
    ).reshape([1, context.dimentions])
}

function createTrainingData(context) {
    const inputs = [];
    const labels = [];
    context
        .users
        .filter(u => u.purchases.length)
        .forEach((user) => {
            const userVector = encodeUser(user, context).dataSync();
            context.products.forEach(product => {
                const productVector = encodeProduct(product, context).dataSync();

                const label = user.purchases.some(purchase => purchase.name === product.name ? 1 : 0);
                //combinar user + product
                inputs.push([...userVector, ...productVector]);
                labels.push(label);
            });
        })

    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        //tamanho = userVector + productVector
        inputDimention: context.dimentions * 2,
    }
}

async function configureNeuralNetAndTrain(trainData) {
    const model = tf.sequential();
    //Camada de entrada
    //inputShape: Número de features por exemplo de treino
    //(traindata.inputDim)
    //Exemplo: Se o vetor produto + usuario = 20 números, então inputDim = 20
    //units: 128 neurônios (muitos "olhos" para detectar padrões)
    //activation: 'relu' (mantém apenas sinais positivos, ajuda
    //a aprender padrões não lineares)  
    model.add(
        tf.layers.dense({
            inputShape: [trainData.inputDimention],
            units: 128,
            activation: 'relu'
        })
    );

    //Camada oculta 1
    //64 neurônios (comprimindo informação)
    model.add(
        tf.layers.dense({
            units: 64,
            activation: 'relu'
        })
    );

    //Camada oculta 2
    //32 neurônios (mas estreita de novo, destilando as informações mais importantes)
    //Exemplo: De muitos sinais, mantém apenas os padrões mais fortes
    // - activation: 'relu'

    model.add(
        tf.layers.dense({
            units: 32,
            activation: 'relu'
        })
    );

    // Camada de saída
    // 1 - neurônio porque vamos retornar apenas uma pontuação de recomendação
    // - activiation: 'sigmoid' comprime o resultado para o intervalo 0-1
    //Exemplo: 0.9 = recomedação forte, 0.1 = recomendação fraca
    model.add(
        tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
        })
    );

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });

    await model.fit(trainData.xs, trainData.ys, {
        epochs: 100,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch: epoch,
                    loss: logs.loss,
                    accuracy: logs.acc
                });
            }
        }
    })

    return model;
}

async function trainModel({ users }) {
    console.log('Training model with users:', users)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 50 } });
    const products = await (await fetch('/data/products.json')).json();
    const context = makeContext(products, users);

    context.productVectors = products.map(product => {
        return {
            name: product.name,
            meta: { ...product },
            vector: encodeProduct(product, context).dataSync(),
        }
    });

    _globalCtx = context;
    const trainData = createTrainingData(context);
    _model = await configureNeuralNetAndTrain(trainData);

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
    postMessage({ type: workerEvents.trainingComplete });
}

function recommend(user, ctx) {
    if (!_model) return;
    const context = _globalCtx;
    //Converta o usuário fornecido no vetor de features codificadas
    //(preço ignorado, idade normalizado, categorias ignorado, cores ignorado)
    //Isso transforma as informações do usuário no mesmo formato numérico
    //que foi usado para treinar o modelo
    const userVector = encodeUser(user, context).dataSync();

    //Em aplicações reais:
    //Armazene todos os vetores de produtos em um banco de dados vetorial
    //(como Postgres, Neo4j ou Pinecone)
    //Consulta: Encontre os 200 produtos mais próximos do vetor do usuário
    //Execute _model.predict() apenas nesses produtos

    //Crie pares de entrada: para cada produto, concatene o vetor do usuario
    //com o vetor codificado do produto.
    //Por quê? O modelo prevê o "score de compatibilidade"
    //para cada par (usuario, produto);
    const inputs = context.productVectors.map(({ vector }) => {
        return [...userVector, ...vector];
    });

    //Converta todos os pares (usuário, produto) em um único tensor
    //Formato: [numProdutos, inputDim]
    const inputTensor = tf.tensor2d(inputs);

    //Rode a rede neural treinada em todos os pares (usuário, produto) de uma vez.
    //O resultado é uma pontuação para cada produto entre 0 e 1;
    //Quanto maior, maior a probabilidade do usuário querer aquele produto.
    const predictions = _model.predict(inputTensor);

    //Extraia as pontuações para um array JS normal
    const scores = predictions.dataSync();
    const recommendations = context.productVectors.map((item, index) => {
        return {
            ...item.meta,
            name: item.name,
            score: scores[index] //previsão do modelo para este produto
        }
    });

    const sortedItens = recommendations
        .sort((a, b) => b.score - a.score);

    postMessage({
        type: workerEvents.recommend,
        user,
        recommendations: sortedItens
    });
}

const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: d => recommend(d.user, _globalCtx),
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
