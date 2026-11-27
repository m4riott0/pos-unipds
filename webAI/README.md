# ✦ Web AI Chat

Chat com Inteligência Artificial que roda **100% no navegador**, usando o **Gemini Nano** embutido no Google Chrome.
Sem servidor, sem chave de API e sem custo: nenhuma mensagem sai do seu computador.

> 🎓 **Versão melhorada** do projeto desenvolvido na pós-graduação **Engenharia de Software com IA Aplicada** (UNIPDS), do Erick Wendel.

---

## 🆕 O que mudou em relação à versão da pós

| Versão original | Esta versão |
|---|---|
| Formulário com uma pergunta e uma resposta | Interface de **chat** completa, no estilo ChatGPT/Gemini |
| Sessão recriada a cada pergunta | **Conversa com memória**: a sessão é reaproveitada |
| Sliders de `temperature` e `topK` na tela | Parâmetros definidos pela aplicação, via `samplingMode` |
| Quebrava no Chrome 151+ (`LanguageModel.params is not a function`) | **Compatível com o Chrome 151+** e com versões anteriores |
| Sempre pedia entrada de imagem e áudio (`NotSupportedError`) | **Detecta as capacidades** do dispositivo antes de criar a sessão |
| Resposta mostrada em inglês e traduzida só no final | **Tradução em streaming**, frase a frase |
| Detector de idioma chamado em toda resposta | Tradução direta en→pt, com uma etapa a menos |
| Modelo carregado no primeiro envio | **Inicialização antecipada** da IA e do tradutor ao abrir a página |
| Aviso "No output language was specified" | Idiomas de entrada e saída declarados corretamente |
| Enviar só pelo botão | **Enter envia**, Shift+Enter quebra linha, campo de texto que cresce sozinho |

---

## ✨ Funcionalidades

- 💬 **Chat com memória**: a IA lembra das mensagens anteriores da conversa
- ⚡ **Respostas em streaming**: o texto aparece enquanto é gerado
- 🇧🇷 **Tradução automática**: o modelo responde em inglês e a resposta é traduzida para português frase a frase, em tempo real
- 🖼️ **Anexo de imagem e áudio**: quando o navegador oferece suporte multimodal
- ⏹️ **Botão de parar** a geração a qualquer momento
- 🔒 **Privacidade total**: tudo é processado localmente, no seu dispositivo
- 🚀 **Inicialização antecipada**: a sessão da IA e o tradutor começam a carregar assim que a página abre

## 🧠 Tecnologias

| Tecnologia | Uso |
|---|---|
| [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (`LanguageModel`) | Geração de respostas com o Gemini Nano |
| [Translator API](https://developer.chrome.com/docs/ai/translator-api) | Tradução inglês → português |
| [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) | Detecção de idioma |
| JavaScript (ES Modules) | Sem frameworks e sem build |
| `http-server` | Servidor estático para desenvolvimento |

## 📋 Requisitos

- **Google Chrome** recente (desktop: Windows, macOS, Linux ou ChromeOS)
- Hardware compatível com o Gemini Nano (GPU com VRAM suficiente ou CPU recomendada pelo Google)
- Espaço livre em disco para o download do modelo, feito uma única vez
- **Node.js** (apenas para rodar o servidor local)

### Flags do Chrome

Acesse `chrome://flags`, ative as opções abaixo e reinicie o navegador:

| Flag | Para quê |
|---|---|
| `#prompt-api-for-gemini-nano` | Habilita a IA (obrigatória) |
| `#prompt-api-for-gemini-nano-multimodal-input` | Permite anexar imagem e áudio |
| `#translation-api` | Tradução das respostas |
| `#language-detector-api` | Detecção de idioma |

> 💡 Para conferir se o modelo já foi baixado, acesse `chrome://on-device-internals`.


Abra o endereço exibido no terminal (por exemplo, `http://localhost:8080`) no Chrome.

> Na primeira execução, o Chrome pode precisar baixar o modelo. O progresso aparece no console do DevTools.

**Dica:** durante o desenvolvimento, use `npx http-server . -c-1` para desativar o cache e sempre carregar a versão mais recente dos arquivos.

## ⚙️ Configuração

Os parâmetros do modelo ficam centralizados no topo de `services/aiService.js`, sem exposição na interface:

```js
const SAMPLING = {
    samplingMode: 'balanced', // most-predictable | predictable | balanced | creative | most-creative
    legacy: { temperature: 0.7, topK: 8 },
};
```

- **Chrome 151+ (páginas web):** usa `samplingMode`. A partir dessa versão, `LanguageModel.params()`, `temperature` e `topK` foram removidos do contexto web.
- **Extensões e versões anteriores:** usa `temperature` e `topK`, limitados ao máximo suportado pelo dispositivo.

O comportamento da IA (system prompt) também pode ser ajustado na constante `SYSTEM_PROMPT`. > AVISO: De preferencia em inglês !!

## ⚠️ Limitações

- Funciona apenas no **Google Chrome desktop** com hardware compatível
- O Gemini Nano responde em `en`, `de`, `es`, `fr` e `ja`; por isso o português passa pela tradução
- A velocidade de geração depende do hardware (principalmente da GPU)
- O suporte a imagem e áudio depende da flag multimodal e do dispositivo
- As APIs de IA do Chrome ainda são experimentais e podem mudar entre versões

## 🛠️ Solução de problemas

| Erro | Solução |
|---|---|
| `LanguageModel.params is not a function` | Normal no Chrome 151+. O projeto já trata esse caso |
| `NotSupportedError: Model capability is not available` | Ative a flag multimodal ou envie apenas texto |
| `As APIs nativas de IA não estão ativas` | Ative `#prompt-api-for-gemini-nano` e reinicie o Chrome |
| Mudanças no código não aparecem | Recarregue com `Ctrl+Shift+R` ou use `http-server -c-1` |

## 📄 Licença

Distribuído sob a licença **MIT**.

---

Baseado no projeto da pós-graduação **Engenharia de Software com IA Aplicada** (UNIPDS), do [Erick Wendel](https://github.com/ErickWendel), evoluído com novas funcionalidades e compatibilidade com o Chrome mais recente.