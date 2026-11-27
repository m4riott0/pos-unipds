
const SAMPLING = {
    samplingMode: 'balanced', // most-predictable | predictable | balanced | creative | most-creative
    legacy: { temperature: 0.7, topK: 8 },
};

// De preferencia em inglês motivo desconhecido: se o prompt estiver em português, o modelo responde em português mesmo com a flag de idioma de saída em inglês. 
const SYSTEM_PROMPT = `You are an AI assistant that responds clearly and objectively.
Always respond in plain text format instead of markdown.`; 

const LANGUAGE_OPTIONS = {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const hasLegacyParams = () => typeof LanguageModel?.params === 'function';

export class AIService {
    constructor() {
        this.session = null;
        this.abortController = null;
    }

    async checkRequirements() {
        const errors = [];

        // @ts-ignore
        if (!window.chrome) {
            errors.push('Este recurso só funciona no Google Chrome ou Chrome Canary (versão recente).');
        }

        if (!('LanguageModel' in self)) {
            errors.push('As APIs nativas de IA não estão ativas.');
            errors.push('Ative a flag chrome://flags/#prompt-api-for-gemini-nano, reinicie o Chrome e tente novamente.');
            return errors;
        }

        if ('Translator' in self) {
            const availability = await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
            if (availability === 'unavailable') {
                errors.push('Tradução de inglês para português não está disponível.');
            }
        } else {
            errors.push('A API de Tradução não está ativa (chrome://flags/#translation-api).');
        }

        if (!('LanguageDetector' in self)) {
            errors.push('A API de Detecção de Idioma não está ativa (chrome://flags/#language-detector-api).');
        }

        if (errors.length > 0) return errors;

        const availability = await LanguageModel.availability(LANGUAGE_OPTIONS);
        console.log('Language Model Availability:', availability);

        if (availability === 'available') return null;

        if (availability === 'unavailable') {
            return ['O seu dispositivo não suporta modelos de linguagem nativos de IA.'];
        }
        if (availability === 'downloading') {
            return ['O modelo de IA está sendo baixado. Aguarde alguns minutos e recarregue a página.'];
        }

        // 'downloadable'
        try {
            const session = await LanguageModel.create({
                ...LANGUAGE_OPTIONS,
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Downloaded ${(e.loaded * 100).toFixed(0)}%`);
                    });
                },
            });
            session.destroy();
            return null;
        } catch (error) {
            console.error('Error downloading model:', error);
            return [`Erro ao baixar o modelo: ${error.message}`];
        }
    }

    async #samplingOptions() {
        if (hasLegacyParams()) {
            try {
                const p = await LanguageModel.params();
                return {
                    temperature: Math.min(SAMPLING.legacy.temperature, p.maxTemperature),
                    topK: Math.min(SAMPLING.legacy.topK, p.maxTopK),
                };
            } catch { /* usa samplingMode */ }
        }
        return { samplingMode: SAMPLING.samplingMode };
    }

    // Descobre se o Chrome aceita imagem/áudio (depende do device e das flags).
    async #detectCapabilities() {
        if (this.capabilities) return this.capabilities;
        const probe = async (type) => {
            try {
                const a = await LanguageModel.availability({
                    expectedInputs: [...LANGUAGE_OPTIONS.expectedInputs, { type }],
                    expectedOutputs: LANGUAGE_OPTIONS.expectedOutputs,
                });
                return a !== 'unavailable';
            } catch {
                return false;
            }
        };
        const [image, audio] = await Promise.all([probe('image'), probe('audio')]);
        this.capabilities = { image, audio };
        console.log('Capacidades multimodais:', this.capabilities);
        return this.capabilities;
    }

    // Uma sessão por conversa: o modelo lembra das mensagens anteriores.
    // Cria a sessão antes da 1ª mensagem (chamado ao abrir a página)
    warmUp() {
        return this.#getSession().catch((e) => console.warn('Warm-up falhou:', e));
    }

    #getSession() {
        if (this.session) return Promise.resolve(this.session);
        // Reaproveita a criação em andamento (evita criar 2 sessões)
        this.sessionPromise ??= this.#createSession().finally(() => { this.sessionPromise = null; });
        return this.sessionPromise;
    }

    async #createSession() {

        const caps = await this.#detectCapabilities();
        const expectedInputs = [{ type: 'text', languages: ['en'] }];
        if (caps.image) expectedInputs.push({ type: 'image' });
        if (caps.audio) expectedInputs.push({ type: 'audio' });

        this.session = await LanguageModel.create({
            expectedInputs,
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
            ...(await this.#samplingOptions()),
            initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
        });
        return this.session;
    }

    async* sendMessage(question, file = null) {
        this.abortController?.abort();
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        const session = await this.#getSession();

        const content = [{ type: 'text', value: question }];
        if (file) {
            const fileType = file.type.split('/')[0];
            if (fileType === 'image' || fileType === 'audio') {
                if (!this.capabilities[fileType]) {
                    throw new Error(
                        `Seu Chrome não aceita ${fileType === 'image' ? 'imagem' : 'áudio'}. ` +
                        'Ative chrome://flags/#prompt-api-for-gemini-nano-multimodal-input e reinicie o Chrome.'
                    );
                }
                content.push({ type: fileType, value: new Blob([await file.arrayBuffer()], { type: file.type }) });
            }
        }

        const stream = session.promptStreaming([{ role: 'user', content }], { signal });
        for await (const chunk of stream) {
            if (signal.aborted) break;
            yield chunk;
        }
    }

    resetConversation() {
        this.abort();
        this.session?.destroy();
        this.session = null;
    }

    abort() {
        this.abortController?.abort();
    }

    isAborted() {
        return this.abortController?.signal.aborted;
    }
}