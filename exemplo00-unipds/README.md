# Exemplo 00 — Classificação com TensorFlow.js

Este exemplo demonstra o fluxo básico de classificação usando uma rede neural
com TensorFlow.js: preparar dados numéricos, treinar o modelo e estimar a
categoria de uma nova pessoa.

> **Objetivo didático:** os dados são pequenos e inventados para facilitar o
> estudo. O resultado serve para acompanhar o funcionamento do código, não para
> tomar decisões reais.

## Requisitos e execução

- Node.js com suporte a módulos ES.
- Dependências instaladas com `npm install`.

Para executar:

```bash
npm start
```

## Dados de entrada

Cada pessoa é representada por um vetor de sete números, nesta ordem:

| Índice | Característica | Valores possíveis |
| --- | --- | --- |
| 1 | Idade normalizada | De 0 a 1 |
| 2 | Cor azul | 0 ou 1 |
| 3 | Cor vermelha | 0 ou 1 |
| 4 | Cor verde | 0 ou 1 |
| 5 | Localização São Paulo | 0 ou 1 |
| 6 | Localização Rio | 0 ou 1 |
| 7 | Localização Curitiba | 0 ou 1 |

As cores e localizações são representadas com *one-hot encoding*: a opção da
pessoa recebe `1` e as demais recebem `0`. A idade é normalizada usando o
intervalo de 25 a 40 anos:

```text
(idade - 25) / (40 - 25)
```

Por exemplo, 28 anos correspondem a `0.2`. A mesma ordem e o mesmo padrão de
normalização precisam ser usados nos dados de treino e na previsão.

Os rótulos também usam *one-hot encoding*, seguindo a ordem
`[premium, medium, basic]`:

| Categoria | Vetor |
| --- | --- |
| premium | `[1, 0, 0]` |
| medium | `[0, 1, 0]` |
| basic | `[0, 0, 1]` |

## Como o modelo funciona

1. `treinarModelo` cria uma rede sequencial com uma camada densa de 80 neurônios
   e ativação ReLU. Ela recebe os sete valores de cada pessoa.
2. A camada final tem três neurônios, um para cada categoria, e usa softmax
   para produzir probabilidades.
3. O modelo é compilado com Adam como otimizador e
   `categoricalCrossentropy` como função de perda, apropriada para rótulos
   categóricos one-hot.
4. O treinamento percorre os dados por 100 épocas e embaralha as amostras.
5. `preverCategorias` transforma os dados da nova pessoa em tensor e obtém as
   probabilidades. O resultado é exibido da categoria mais provável para a
   menos provável.

## Organização do código

- `CATEGORIAS`: nomes das categorias na mesma ordem dos rótulos.
- `treinarModelo`: construção, configuração e treinamento da rede.
- `preverCategorias`: execução da inferência e associação das probabilidades
  aos índices de categoria.
- `main`: dados de exemplo, criação dos tensores, treino e apresentação da
  previsão.

O exemplo tem somente três amostras de treinamento. Uma rede com 80 neurônios
é grande em relação a essa base e pode memorizar os exemplos, sem generalizar
para novos dados. Na prática, use mais amostras representativas e avalie o
modelo com dados que não foram usados durante o treinamento.
