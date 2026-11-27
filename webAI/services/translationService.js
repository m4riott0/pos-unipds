export class TranslationService {
    constructor() {
        this.translators = new Map(); // um tradutor por idioma de origem
        this.languageDetector = null;
    }

    static isSupported() {
        return 'Translator' in self && 'LanguageDetector' in self;
    }

    // Chamar DENTRO de um handler de clique/submit
    async ensureDetector() {
        if (this.languageDetector) return;
        this.languageDetector = await LanguageDetector.create();
    }

    async getTranslator(sourceLanguage, targetLanguage = 'pt') {
        const key = `${sourceLanguage}-${targetLanguage}`;
        if (this.translators.has(key)) return this.translators.get(key);

        const options = { sourceLanguage, targetLanguage };
        const availability = await Translator.availability(options);
        if (availability === 'unavailable') {
            throw new Error(`Par de idiomas ${key} não suportado.`);
        }

        const translator = await Translator.create({
            ...options,
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    console.log(`Translator ${key}: ${(e.loaded * 100).toFixed(0)}%`);
                });
            }
        });
        this.translators.set(key, translator);
        return translator;
    }

    // Pré-carrega o tradutor en→pt ao abrir a página (se já estiver baixado)
    async warmUp() {
        if (!('Translator' in self)) return;
        try {
            await this.getTranslator('en');
        } catch (e) {
            console.warn('Tradutor será carregado no primeiro envio:', e.message);
        }
    }

    /**
     * Traduz a resposta do modelo (sempre em inglês) frase a frase, enquanto ela chega.
     * Não usa o detector: economiza uma chamada por resposta.
     */
    createStreamTranslator(onText) {
        let buffer = '';
        let queue = Promise.resolve();
        const boundary = /(?<=[\p{L})"'])[.!?](?=\s)|\n/u;

        const enqueue = (segment) => {
            queue = queue.then(async () => {
                const [, lead, core, trail] = segment.match(/^(\s*)([\s\S]*?)(\s*)$/);
                if (!core) return onText(segment);
                try {
                    const translator = await this.getTranslator('en');
                    onText(lead + (await translator.translate(core)) + trail);
                } catch {
                    onText(segment); // sem tradutor: mostra o original
                }
            });
        };

        return {
            push(delta) {
                buffer += delta;
                let m;
                while ((m = boundary.exec(buffer))) {
                    const end = m.index + m[0].length;
                    enqueue(buffer.slice(0, end));
                    buffer = buffer.slice(end);
                }
            },
            flush() {
                if (buffer) enqueue(buffer);
                buffer = '';
                return queue;
            },
        };
    }

    async translateToPortuguese(text) {
        if (!TranslationService.isSupported()) return text;

        try {
            await this.ensureDetector();
            const [top] = await this.languageDetector.detect(text);
            const source = top?.detectedLanguage;
            console.log('Idioma detectado:', top);

            if (!source || source === 'pt' || source === 'und') return text;

            const translator = await this.getTranslator(source);
            return await translator.translate(text);
        } catch (error) {
            console.error('Translation error:', error);
            return text;
        }
    }
}