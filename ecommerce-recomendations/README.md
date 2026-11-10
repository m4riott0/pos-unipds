# Recomendador de Produtos com TensorFlow.js

Projeto do módulo da pós: um sistema de recomendação que treina uma **rede neural no navegador**, dentro de um **Web Worker**, usando **TensorFlow.js**. O modelo aprende com o histórico de compras dos usuários e devolve os produtos ordenados pela probabilidade de o usuário querer cada um.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Pesos das features](#1-pesos-das-features)
3. [Normalização](#2-normalização)
4. [Contexto (`makeContext`)](#3-contexto-makecontext)
5. [Codificação do produto](#4-codificação-do-produto-encodeproduct)
6. [Codificação do usuário](#5-codificação-do-usuário-encodeuser)
7. [Como o modelo enxerga os dados](#6-como-o-modelo-enxerga-os-dados)
8. [Dados de treino](#7-dados-de-treino-createtrainingdata)
9. [Rede neural](#8-rede-neural-configureneuralnetandtrain)
10. [Treinamento (`trainModel`)](#9-treinamento-trainmodel)
11. [Recomendação (`recommend`)](#10-recomendação-recommend)
12. [Comunicação com a UI](#11-comunicação-com-a-ui)

---

## Visão geral

```
Usuários + Produtos
        │
        ▼
  makeContext        → min/max, índices de categoria e cor, idade média por produto
        │
        ▼
  encodeProduct / encodeUser   → tudo vira vetor numérico (0–1, com pesos)
        │
        ▼
  createTrainingData → pares [usuário + produto] com rótulo 1 (comprou) ou 0 (não comprou)
        │
        ▼
  Rede neural (128 → 64 → 32 → 1)
        │
        ▼
  recommend          → score de 0 a 1 para cada produto, ordenado
```

---

## 1. Pesos das features

Define o quanto cada característica influencia a recomendação:

```js
const WEIGHTS = {
    category: 0.4,
    color: 0.3,
    price: 0.2,
    age: 0.1,
};
```

A categoria é a que mais pesa e a idade, a que menos pesa.

---

## 2. Normalização

🔢 **Normaliza valores contínuos (preço e idade) para o intervalo de 0 a 1.**

**Por quê?** Mantém todas as features equilibradas para que nenhuma domine o treinamento.

**Fórmula:** `(val - min) / (max - min)`

**Exemplo:** `price = 129.99`, `minPrice = 39.99`, `maxPrice = 199.99` → **0.56**

```js
const normalize = (value, min, max) => (value - min) / ((max - min) || 1)
```

O `|| 1` evita divisão por zero quando `max` e `min` são iguais.

---

## 3. Contexto (`makeContext`)

Prepara tudo o que a codificação precisa:

- **Idades mínima e máxima** dos usuários e **preços mínimo e máximo** dos produtos, usados na normalização.
- **Cores** e **categorias** únicas (`new Set`), cada uma com um **índice** (`colorsIndex` e `categoriesIndex`), necessário para o one-hot.
- **Média de idade dos compradores de cada produto** (`productAvgAgeNorm`), que ajuda a personalizar a recomendação.
  - Soma a idade dos usuários que compraram cada produto e divide pela quantidade de compras.
  - Se ninguém comprou o produto, usa a idade do meio (`midAge = (minAge + maxAge) / 2`).
  - O resultado é normalizado.
- **Dimensões do vetor**: `price + age + colors + categories`

```js
dimentions: 2 + categories.length + colors.length
```

---

## 4. Codificação do produto (`encodeProduct`)

Normaliza os dados para ficar de 0 a 1 e **aplica o peso na recomendação**. O vetor do produto é a concatenação de:

| Parte | Como é calculada |
|---|---|
| Preço | `normalize(price, minPrice, maxPrice) * WEIGHTS.price` |
| Idade | idade média normalizada dos compradores (`?? 0.5` se não houver) `* WEIGHTS.age` |
| Categoria | one-hot da categoria `* WEIGHTS.category` |
| Cor | one-hot da cor `* WEIGHTS.color` |

```js
const oneHotWeighted = (index, length, weight) =>
    tf.oneHot(index, length).cast('float32').mul(weight)
```

```js
return tf.concat1d([price, age, category, color])
```

---

## 5. Codificação do usuário (`encodeUser`)

**Usuário com compras:** empilha os vetores dos produtos comprados e tira a **média**. O perfil do usuário é a média do que ele já comprou.

```js
tf.stack(user.purchases.map(product => encodeProduct(product, context)))
    .mean(0)
    .reshape([1, context.dimentions])
```

**Usuário sem compras:** monta um vetor com:

- **Preço ignorado** (`tf.zeros([1])`)
- **Idade normalizada** `* WEIGHTS.age`
- **Categoria ignorada** (`tf.zeros([numCategories])`)
- **Cor ignorada** (`tf.zeros([numColors])`)

---

## 6. Como o modelo enxerga os dados

### Antes da codificação

```js
const exampleUser = {
    id: 201,
    name: 'Rafael Souza',
    age: 27,
    purchases: [
        { id: 8, name: 'Boné Estiloso', category: 'acessórios', price: 39.99, color: 'preto' },
        { id: 9, name: 'Mochila Executiva', category: 'acessórios', price: 159.99, color: 'cinza' }
    ]
};
```

### Depois da codificação

O modelo **não vê nomes ou palavras**. Ele vê um **vetor numérico**, todo normalizado entre 0 e 1:

```
[preço_normalizado, idade_normalizada, cat_one_hot..., cor_one_hot...]
```

Supondo:

- categorias = `['acessórios', 'eletrônicos', 'vestuário']`
- cores = `['preto', 'cinza', 'azul']`

Para o Rafael (idade 27, categoria acessórios, cores preto e cinza), o vetor poderia ser:

```
[
  0.45,            // peso do preço normalizado
  0.60,            // idade normalizada
  1, 0, 0,         // one-hot de categoria (acessórios = ativo)
  1, 0, 0          // one-hot de cores (preto e cinza ativos, azul inativo)
]
```

**São esses números que vão para a rede neural.**

---

## 7. Dados de treino (`createTrainingData`)

Para cada usuário que tem compras e para cada produto do catálogo:

1. Codifica o usuário (`userVector`) e o produto (`productVector`).
2. Define o **rótulo**: `1` se o usuário comprou aquele produto, `0` se não comprou.
3. **Combina user + product** em uma única entrada: `[...userVector, ...productVector]`.

```js
inputs.push([...userVector, ...productVector])
labels.push(label)
```

Retorno:

```js
{
    xs: tf.tensor2d(inputs),
    ys: tf.tensor2d(labels, [labels.length, 1]),
    inputDimention: context.dimentions * 2
    // tamanho = userVector + productVector
}
```

---

## 8. Rede neural (`configureNeuralNetAndTrain`)

Modelo `tf.sequential()` com quatro camadas densas.

### Camada de entrada

- **`inputShape`**: número de features por exemplo de treino (`trainData.inputDimention`). Exemplo: se o vetor produto + usuário tem 20 números, então `inputDim = 20`.
- **`units: 128`**: 128 neurônios, muitos "olhos" para detectar padrões.
- **`activation: 'relu'`**: mantém apenas sinais positivos e ajuda a aprender padrões não lineares.

### Camada oculta 1

- **`units: 64`**: menos neurônios que a primeira camada, então começa a **comprimir** a informação.
- **`activation: 'relu'`**: ainda extrai combinações relevantes de features.

### Camada oculta 2

- **`units: 32`**: mais estreita de novo, **destilando** as informações mais importantes. Exemplo: de muitos sinais, mantém apenas os padrões mais fortes.
- **`activation: 'relu'`**

### Camada de saída

- **`units: 1`**: um neurônio porque a rede retorna apenas **uma pontuação de recomendação**.
- **`activation: 'sigmoid'`**: comprime o resultado para o intervalo 0–1. Exemplo: `0.9` = recomendação forte, `0.1` = recomendação fraca.

### Compilação e treino

```js
model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
})

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
```

| Parâmetro | Valor |
|---|---|
| Otimizador | Adam, learning rate `0.01` |
| Loss | `binaryCrossentropy` |
| Métrica | `accuracy` |
| Épocas | 100 |
| Batch size | 32 |
| Shuffle | ativado |

A cada época, o `onEpochEnd` envia `loss` e `accuracy` para a interface acompanhar o treino.

---

## 9. Treinamento (`trainModel`)

Fluxo executado quando a UI envia o evento `trainModel`:

1. Avisa progresso `1`.
2. Carrega os produtos de `/data/products.json`.
3. Monta o contexto com `makeContext(products, users)`.
4. Gera e guarda o vetor de cada produto em `context.productVectors` (nome, metadados e vetor).
5. Salva o contexto em `_globalCtx`.
6. Cria os dados de treino e treina a rede (`_model`).
7. Avisa progresso `100` e dispara `trainingComplete`.

---

## 10. Recomendação (`recommend`)

Só executa se o modelo já estiver treinado (`if (!_model) return`).

**1️⃣ Codificar o usuário.** Converte o usuário fornecido no vetor de features codificadas (preço ignorado, idade normalizada, categorias ignoradas). Isso transforma as informações do usuário no **mesmo formato numérico** usado no treino.

> **Em aplicações reais:** armazenar todos os vetores de produtos em um **banco de dados vetorial** (como Postgres, Neo4j ou Pinecone). A consulta encontra os **200 produtos mais próximos** do vetor do usuário, e o `_model.predict()` roda **apenas nesses produtos**.

**2️⃣ Criar os pares de entrada.** Para cada produto, concatena o vetor do usuário com o vetor do produto. **Por quê?** O modelo prevê o **score de compatibilidade** para cada par (usuário, produto).

```js
const inputs = context.productVectors.map(({ vector }) => {
    return [...userVector, ...vector]
})
```

**3️⃣ Converter para um único Tensor.** Todos os pares viram um tensor de formato `[numProdutos, inputDim]`.

```js
const inputTensor = tf.tensor2d(inputs)
```

**4️⃣ Rodar a rede treinada.** Executa em todos os pares de uma vez. O resultado é uma **pontuação entre 0 e 1** para cada produto. Quanto maior, maior a probabilidade de o usuário querer aquele produto.

```js
const predictions = _model.predict(inputTensor)
```

**5️⃣ Extrair as pontuações.** Converte para um array JS normal e associa cada score ao seu produto.

```js
const scores = predictions.dataSync()
const recommendations = context.productVectors.map((item, index) => ({
    ...item.meta,
    name: item.name,
    score: scores[index] // previsão do modelo para este produto
}))
```

**Ordenação.** Do maior para o menor score.

```js
const sortedItems = recommendations.sort((a, b) => b.score - a.score)
```

**8️⃣ Enviar para a UI.** Manda a lista ordenada para a thread principal, que já pode exibi-la.

```js
postMessage({
    type: workerEvents.recommend,
    user,
    recommendations: sortedItems
});
```

---

## 11. Comunicação com a UI

O Worker recebe mensagens com `{ action, ...data }` e chama o handler correspondente:

```js
const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: recommend,
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
```

| Direção | Evento | Payload |
|---|---|---|
| UI → Worker | `trainModel` | `{ users }` |
| UI → Worker | `recommend` | `{ user }` |
| Worker → UI | `progressUpdate` | `{ progress: { progress } }` |
| Worker → UI | `trainingLog` | `{ epoch, loss, accuracy }` |
| Worker → UI | `trainingComplete` | nenhum |
| Worker → UI | `recommend` | `{ user, recommendations }` |

---

## Tecnologias

- JavaScript (ES Modules)
- TensorFlow.js 4.22.0
- Web Workers
- Fetch API