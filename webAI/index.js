import { FormController } from './controllers/formController.js';
import { AIService } from './services/aiService.js';
import { TranslationService } from './services/translationService.js';
import { View } from './views/view.js';

(async function main() {
    const aiService = new AIService();
    const translationService = new TranslationService();
    const view = new View();

    view.setYear();

    const errors = await aiService.checkRequirements();
    if (errors) {
        view.showError(errors);
        return;
    }

    if (!TranslationService.isSupported()) {
        console.warn('APIs de tradução não suportadas neste navegador.');
    }

    const controller = new FormController(aiService, translationService, view);
    controller.setupEventListeners();

    // Aquece em segundo plano: a 1ª resposta sai bem mais rápido
    aiService.warmUp();
    translationService.warmUp();

    console.log('Application initialized successfully');
})();