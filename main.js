// Elementos del DOM
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const authButton = document.getElementById('auth-button'); // Nuevo: botón de autenticación

// Clave para almacenar el historial de chat del usuario en Puter.kv
const CHAT_HISTORY_KEY = 'gatitoSentimentalChatHistory';

// Historial de la conversación para mantener el contexto con la IA
let history = [
    {
        role: "system",
        content: `Eres Gatito Sentimental, un personaje de TikTok que ofrece apoyo, consejos y recomendaciones sobre superación, aceptación y psicología. Eres humilde, empático, no serio y tu objetivo es ayudar a las personas a sentirse mejor consigo mismas. Responde de manera concisa y amable, como lo haría Gatito Sentimental. Evita parecer un asistente de IA genérico.`
    },
];

// Función para añadir un mensaje al chat en la UI
function addMessageToUI(text, sender = 'user', isTyping = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex', 'mb-2');

    if (sender === 'user') {
        messageDiv.classList.add('justify-end');
        messageDiv.innerHTML = `
            <div class="bg-blue-600 text-white p-3 rounded-lg max-w-[80%] break-words shadow">
                ${text}
            </div>
        `;
    } else { // sender === 'bot'
        messageDiv.classList.add('justify-start');
        messageDiv.innerHTML = `
            <div class="bg-gray-700 text-gray-100 p-3 rounded-lg max-w-[80%] break-words shadow ${isTyping ? 'animate-pulse' : ''}">
                ${isTyping ? '...' : text}
            </div>
        `;
        if (isTyping) {
            messageDiv.id = 'typing-indicator'; // Para poder removerlo fácilmente
        }
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Desplazarse al final
}

// Función para cargar el historial de chat del usuario
async function loadChatHistory() {
    if (puter.auth.isSignedIn()) {
        try {
            const storedHistory = await puter.kv.get(CHAT_HISTORY_KEY);
            if (storedHistory) {
                // Filtramos el mensaje "system" para que no se duplique si lo guardamos.
                // En este caso, el mensaje "system" siempre lo tenemos al inicio del array 'history' localmente.
                // Los mensajes guardados en KV son solo los de la conversación.
                const conversationalHistory = JSON.parse(storedHistory);

                // Reconstruir el 'history' con el mensaje del sistema y los mensajes guardados
                history = [
                    {
                        role: "system",
                        content: `Eres Gatito Sentimental, un personaje de TikTok que ofrece apoyo, consejos y recomendaciones sobre superación, aceptación y psicología. Eres humilde, empático, no serio y tu objetivo es ayudar a las personas a sentirse mejor consigo mismas. Responde de manera concisa y amable, como lo haría Gatito Sentimental. Evita parecer un asistente de IA genérico.`
                    },
                    ...conversationalHistory
                ];

                // Mostrar los mensajes guardados en la UI
                chatMessages.innerHTML = ''; // Limpiar el mensaje inicial de bienvenida
                conversationalHistory.forEach(msg => {
                    if (msg.role === 'user') {
                        addMessageToUI(msg.content, 'user');
                    } else if (msg.role === 'assistant') {
                        addMessageToUI(msg.content, 'bot');
                    }
                });
                return true; // Se cargó el historial
            }
        } catch (error) {
            console.error("Error al cargar el historial del chat:", error);
            // Podrías mostrar un mensaje de error al usuario aquí
        }
    }
    return false; // No se cargó el historial
}

// Función para guardar el historial de chat del usuario
async function saveChatHistory() {
    if (puter.auth.isSignedIn()) {
        try {
            // Guardar solo los mensajes conversacionales, excluyendo el mensaje "system"
            const conversationalHistory = history.filter(msg => msg.role !== 'system');
            await puter.kv.set(CHAT_HISTORY_KEY, JSON.stringify(conversationalHistory));
            console.log("Historial de chat guardado.");
        } catch (error) {
            console.error("Error al guardar el historial del chat:", error);
        }
    }
}

// Función para inicializar la autenticación y el chat
async function initializeChat() {
    if (puter.auth.isSignedIn()) {
        const user = await puter.auth.getUser();
        authButton.textContent = user.username;
        authButton.disabled = true; // Deshabilitar el botón si ya está logeado
        authButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        authButton.classList.add('bg-gray-600', 'cursor-default');

        const historyLoaded = await loadChatHistory();
        if (!historyLoaded) {
            // Si no hay historial guardado o no se pudo cargar, mostrar el mensaje inicial
            addMessageToUI('¡Hola! Soy Gatito Sentimental. ¿En qué puedo ayudarte hoy?', 'bot');
        }
    } else {
        authButton.textContent = 'Iniciar Sesión';
        // Mostrar el mensaje inicial si no hay sesión iniciada
        addMessageToUI('¡Hola! Soy Gatito Sentimental. ¿En qué puedo ayudarte hoy?', 'bot');
    }
}


// Función para enviar el mensaje y obtener respuesta de Gemini
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (userMessage === '') return; // No enviar mensajes vacíos

    addMessageToUI(userMessage, 'user'); // Mostrar mensaje del usuario en la UI
    messageInput.value = ''; // Limpiar el input

    // Añadir el mensaje del usuario al historial para el contexto de la IA
    history.push({ role: "user", content: userMessage });

    // Deshabilitar input y botón mientras se espera la respuesta
    messageInput.disabled = true;
    sendButton.disabled = true;
    sendButton.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>`; // Icono de carga

    addMessageToUI('', 'bot', true); // Añadir indicador de "está escribiendo..."

    try {
        // Llamada a la API de Gemini con streaming, pasando todo el historial
        const stream = await puter.ai.chat(history, { // ¡Aquí pasamos el historial!
            model: 'google/gemini-2.5-flash-preview',
            stream: true,
            temperature: 0.7
        });

        // Contenedor para el mensaje del bot que se va a ir llenando en la UI
        let botMessageDiv = document.getElementById('typing-indicator');
        let assistantReply = ''; // Para acumular la respuesta completa del asistente

        for await (const part of stream) {
            if (part?.text) {
                // Eliminar el indicador de "está escribiendo..." si existe y es la primera parte real
                if (botMessageDiv && botMessageDiv.classList.contains('animate-pulse')) {
                    botMessageDiv.classList.remove('animate-pulse');
                    botMessageDiv.id = ''; // Remover el ID para que no se use para futuros mensajes
                }

                assistantReply += part.text;
                // Reemplazar el contenido del div existente para simular el streaming
                botMessageDiv.innerHTML = assistantReply.replaceAll('\n', '<br>');
                chatMessages.scrollTop = chatMessages.scrollHeight; // Desplazarse al final
            }
        }

        // Una vez que el streaming ha terminado, añadir la respuesta completa del asistente al historial
        history.push({ role: "assistant", content: assistantReply });

        // Guardar el historial después de cada interacción
        await saveChatHistory();

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        // Remover el indicador de "está escribiendo..." si hubo un error
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        addMessageToUI("Lo siento, hubo un error al obtener la respuesta. Por favor, inténtalo de nuevo más tarde.", 'bot');
    } finally {
        // Habilitar input y botón nuevamente
        messageInput.disabled = false;
        sendButton.disabled = false;
        sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>`; // Icono de enviar
        messageInput.focus(); // Volver a enfocar el input
        // Ajustar la altura del textarea después de habilitarlo
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    }
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
});

authButton.addEventListener('click', async () => {
    if (!puter.auth.isSignedIn()) {
        await puter.auth.signIn();
        initializeChat(); // Re-inicializar el chat después de iniciar sesión para cargar el historial
    }
});

// Inicializar el chat al cargar la página
initializeChat();
    
