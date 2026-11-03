import tf from '@tensorflow/tfjs-node';

const CATEGORIAS = ['premium', 'medium', 'basic'];

async function treinarModelo(caracteristicas, rotulos) {
    const modelo = tf.sequential();

    modelo.add(tf.layers.dense({
        inputShape: [7],
        units: 80,
        activation: 'relu'
    }));
    modelo.add(tf.layers.dense({
        units: CATEGORIAS.length,
        activation: 'softmax'
    }));

    modelo.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    await modelo.fit(caracteristicas, rotulos, {
        verbose: 0,
        epochs: 100,
        shuffle: true
    });

    return modelo;
}

async function preverCategorias(modelo, caracteristicas) {
    const entrada = tf.tensor2d(caracteristicas);
    const previsao = modelo.predict(entrada);
    const probabilidades = await previsao.array();

    return probabilidades[0].map((probabilidade, indice) => ({
        probabilidade,
        indice
    }));
}

async function main() {
    const dadosDeTreinamento = [
        [0.33, 1, 0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0, 1, 0],
        [1, 0, 0, 1, 0, 0, 1]
    ];
    const rotulosDeTreinamento = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];

    const caracteristicas = tf.tensor2d(dadosDeTreinamento);
    const rotulos = tf.tensor2d(rotulosDeTreinamento);
    const modelo = await treinarModelo(caracteristicas, rotulos);

    const pessoaParaClassificar = {
        nome: 'Zé',
        idadeNormalizada: 0.2,
        cor: 'verde',
        localizacao: 'Curitiba'
    };
    const caracteristicasDaPessoa = [[
        pessoaParaClassificar.idadeNormalizada,
        0,
        0,
        1,
        0,
        0,
        1
    ]];

    const previsoes = await preverCategorias(modelo, caracteristicasDaPessoa);
    const resultado = previsoes
        .sort((a, b) => b.probabilidade - a.probabilidade)
        .map(({ probabilidade, indice }) =>
            `${CATEGORIAS[indice]} (${(probabilidade * 100).toFixed(2)}%)`
        )
        .join('\n');

    console.log(`Previsão para ${pessoaParaClassificar.nome}:`);
    console.log(resultado);
}

main();
