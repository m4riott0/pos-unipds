export class View {
    constructor() {
        this.elements = {
            form: document.getElementById('question-form'),
            questionInput: document.getElementById('question'),
            messages: document.getElementById('messages'),
            welcome: document.getElementById('welcome'),
            button: document.getElementById('ask-button'),
            year: document.getElementById('year'),
            fileInput: document.getElementById('file-input'),
            filePreview: document.getElementById('file-preview'),
            fileUploadBtn: document.getElementById('file-upload-btn'),
            fileSelectedName: document.getElementById('file-selected-name'),
        };

        this.elements.questionInput.addEventListener('input', () => this.#autoResize());
    }

    setYear() {
        const year = this.elements.year;
        if (year) year.textContent = new Date().getFullYear();
    }

    getQuestionText() {
        return this.elements.questionInput.value;
    }

    getFile() {
        return this.elements.fileInput.files[0] ?? null;
    }

    // ---------- Mensagens ----------

    addUserMessage(text, file = null) {
        this.#hideWelcome();
        const msg = this.#el('div', 'msg user');
        const bubble = this.#el('div', 'bubble');

        if (file) {
            const type = file.type.split('/')[0];
            if (type === 'image') {
                const img = this.#el('img', 'msg-attachment');
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                bubble.append(img);
            } else {
                bubble.append(this.#el('span', 'msg-file-label', `🎧 ${file.name}`));
            }
        }

        bubble.append(document.createTextNode(text));
        msg.append(bubble);
        this.elements.messages.append(msg);
        this.#scrollToBottom(true);
    }

    /** Cria a resposta da IA e devolve funções para atualizá-la. */
    addAssistantMessage() {
        this.#hideWelcome();
        const msg = this.#el('div', 'msg assistant');
        const avatar = this.#el('div', 'avatar', '✦');
        const bubble = this.#el('div', 'bubble');
        bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
        msg.append(avatar, bubble);
        this.elements.messages.append(msg);
        this.#scrollToBottom(true);

        return {
            setText: (text) => {
                bubble.classList.remove('error');
                bubble.textContent = text;
                this.#scrollToBottom();
            },
            setStatus: (status, text = bubble.textContent) => {
                bubble.textContent = text ? `${text}\n` : '';
                bubble.append(this.#el('span', 'status', status));
                this.#scrollToBottom();
            },
            setError: (text) => {
                bubble.classList.add('error');
                bubble.textContent = text;
            },
        };
    }

    showError(errors) {
        const reply = this.addAssistantMessage();
        reply.setError(errors.join('\n'));
        this.elements.button.disabled = true;
        this.elements.questionInput.disabled = true;
    }

    clearComposer() {
        this.elements.questionInput.value = '';
        this.#autoResize();
        this.#clearFile();
    }

    // ---------- Botão ----------

    setButtonToStopMode() {
        this.elements.button.classList.add('stop-button');
        this.elements.button.title = 'Parar';
    }

    setButtonToSendMode() {
        this.elements.button.classList.remove('stop-button');
        this.elements.button.title = 'Enviar';
    }

    // ---------- Arquivo ----------

    handleFilePreview(event) {
        const file = event.target.files[0];
        this.elements.filePreview.innerHTML = '';
        this.elements.fileSelectedName.textContent = '';
        if (!file) return;

        const chip = this.#el('div', 'file-chip');
        const type = file.type.split('/')[0];

        if (type === 'image') {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            chip.append(img);
        } else if (type === 'audio') {
            const audio = document.createElement('audio');
            audio.src = URL.createObjectURL(file);
            audio.controls = true;
            chip.append(audio);
        }

        chip.append(this.#el('span', 'chip-name', file.name));

        const removeBtn = this.#el('button', 'remove-file-btn', '×');
        removeBtn.type = 'button';
        removeBtn.title = 'Remover arquivo';
        removeBtn.onclick = () => this.#clearFile();
        chip.append(removeBtn);

        this.elements.filePreview.append(chip);
        this.elements.questionInput.focus();
    }

    triggerFileInput() {
        this.elements.fileInput.click();
    }

    // ---------- Eventos ----------

    onFileChange(callback) {
        this.elements.fileInput.addEventListener('change', callback);
    }

    onFileButtonClick(callback) {
        this.elements.fileUploadBtn.addEventListener('click', callback);
    }

    onFormSubmit(callback) {
        this.elements.form.addEventListener('submit', callback);
    }

    onEnterToSend() {
        this.elements.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                this.elements.form.requestSubmit();
            }
        });
    }

    // ---------- Internos ----------

    #el(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        return el;
    }

    #clearFile() {
        this.elements.fileInput.value = '';
        this.elements.filePreview.innerHTML = '';
        this.elements.fileSelectedName.textContent = '';
    }

    #hideWelcome() {
        this.elements.welcome?.remove();
    }

    #autoResize() {
        const input = this.elements.questionInput;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
    }

    #scrollToBottom(force = false) {
        const m = this.elements.messages;
        if (force || m.scrollHeight - m.scrollTop - m.clientHeight < 150) {
            m.scrollTop = m.scrollHeight;
        }
    }
}
