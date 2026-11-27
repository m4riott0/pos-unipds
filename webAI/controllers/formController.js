export class FormController {
    constructor(aiService, translationService, view) {
        this.aiService = aiService;
        this.translationService = translationService;
        this.view = view;
        this.isGenerating = false;
    }

    setupEventListeners() {
        this.view.onFileChange((event) => this.view.handleFilePreview(event));
        this.view.onFileButtonClick(() => this.view.triggerFileInput());
        this.view.onEnterToSend();

        this.view.onFormSubmit(async (event) => {
            event.preventDefault();

            if (this.isGenerating) {
                this.stopGeneration();
                return;
            }

            await this.handleSubmit();
        });
    }

    async handleSubmit() {
        const question = this.view.getQuestionText().trim();
        if (!question) return;

        const file = this.view.getFile();

        // Ainda dentro do gesto do usuário: garante o tradutor (pode precisar de download)
        this.translationService.getTranslator('en').catch(() => {});

        this.view.addUserMessage(question, file);
        this.view.clearComposer();
        const reply = this.view.addAssistantMessage();

        this.toggleButton(true);

        // Mostra a resposta já em português, frase a frase
        let shown = '';
        const translator = this.translationService.createStreamTranslator((text) => {
            shown += text;
            reply.setText(shown);
        });

        try {
            for await (const chunk of this.aiService.sendMessage(question, file)) {
                if (this.aiService.isAborted()) break;
                translator.push(chunk);
            }
            await translator.flush();

            if (!shown.trim()) {
                reply.setText(this.aiService.isAborted() ? '(interrompido)' : '(sem resposta)');
            }
        } catch (error) {
            await translator.flush().catch(() => {});
            if (error.name === 'AbortError') {
                reply.setStatus('(interrompido)');
            } else {
                console.error('Error during AI generation:', error);
                reply.setError(`Erro: ${error.message}`);
            }
        }

        this.toggleButton(false);
    }

    stopGeneration() {
        this.aiService.abort();
        this.toggleButton(false);
    }

    toggleButton(isGenerating) {
        this.isGenerating = isGenerating;
        if (isGenerating) this.view.setButtonToStopMode();
        else this.view.setButtonToSendMode();
    }
}