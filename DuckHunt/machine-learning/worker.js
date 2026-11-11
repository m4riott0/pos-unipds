importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest');

const MODEL_PATH = `yolov5n_web_model/model.json`;
const LABELS_PATH = `yolov5n_web_model/labels.json`;
const INPUT_MODEL_DIMENSIONS = 640


let _labels = []
let _model = null

async function loadModelAndLabels() {
    await tf.ready()

    _labels = await (await fetch(LABELS_PATH)).json()
    _model = await tf.loadGraphModel(MODEL_PATH)

    // Warm up the model with a dummy input
    const dummyInput = tf.ones(_model.inputs[0].shape)
    // sempre que usar um tensor deve-se liberar a memória depois de usar, para evitar memory leak
    await _model.executeAsync(dummyInput)
    tf.dispose(dummyInput)
}


function preprocessImage(input) {
    return tf.tidy(() => {
        const image = tf.browser.fromPixels(input)

        returntf.image.resizeBilinear(image, [INPUT_MODEL_DIMENSIONS, INPUT_MODEL_DIMENSIONS]).div(255).expandDims(0)
    })
}

async function runInference(tensor) {
    const output = await _model.executeAsync(tensor)
    tf.dispose(tensor)

    const [boxes, scores, classes] = output.slice(0, 3)
    const [boxesData, scoresData, classesData] = await Promise.all([
        boxes.array(),
        scores.array(),
        classes.array()
    ])

    output.forEach(t => tf.dispose())

    return {
        boxes: boxesData,
        scores: scoresData,
        classes: classesData
    }
}


loadModelAndLabels()

self.onmessage = async ({ data }) => {
    if (data.type !== 'predict') return

    if (!_model) return;

    const input = preprocessImage(data.imageData)
    const {width, height} = data.imageData

    const interferenceResult = await runInference(input)

    debugger
    postMessage({
        type: 'prediction',
        x: 400,
        y: 400,
        score: 0
    });


};

console.log('🧠 YOLOv5n Web Worker initialized');
