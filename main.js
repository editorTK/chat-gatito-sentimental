// Elementos del DOM
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Historial de la conversación para mantener el contexto
// Incluimos un mensaje inicial del sistema para definir la personalidad de Gatito Sentimental
let history = [
    {
        role: "system",
        content: `Eres Gatito Sentimental, un personaje de TikTok que ofrece apoyo, consejos y recomendaciones sobre superación, aceptación y psicología. Eres humilde, empático, no serio y tu objetivo es ayudar a las personas a sentirse mejor consigo mismas. Responde de manera concisa y amable, como lo haría Gatito Sentimental. Evita parecer un asistente de IA genérico.`
    },
    // Este mensaje inicial se mostrará al usuario al cargar la página.
    // Aunque no está en el historial 'real' del modelo, inicia la conversación en la UI.
    // La primera interacción del usuario con Gatito Sentimental definirá el primer 'user' en history.
];

// Función para añadir un mensaje al chat en la UI
function addMessageToUI(text, sender = 'user') {
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
            <div class="bg-gray-700 text-gray-100 p-3 rounded-lg max-w-[80%] break-words shadow">
                ${text}
            </div>
        `;
    }
    chatMessages.appendChild(messageDiv);
    // Desplazarse al final para ver el último mensaje
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mostrar el mensaje de bienvenida inicial de Gatito Sentimental al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    addMessageToUI('¡Hola! Soy Gatito Sentimental. Estoy aquí para escucharte y ofrecerte un poco de apoyo. ¿Cómo te sientes hoy?', 'bot');
});


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

    try {
        // Llamada a la API de Gemini con streaming, pasando todo el historial
        const stream = await puter.ai.chat(history, { // ¡Aquí pasamos el historial!
            model: 'google/gemini-2.5-flash-preview',
            stream: true,
            temperature: 0.7 // Un poco de temperatura para variedad, sin desviarse demasiado
        });

        // Contenedor para el mensaje del bot que se va a ir llenando en la UI
        let botMessageDiv;
        let assistantReply = ''; // Para acumular la respuesta completa del asistente

        for await (const part of stream) {
            if (part?.text) {
                // Crear el div si es la primera parte del mensaje del bot
                if (!botMessageDiv) {
                    const messageContainer = document.createElement('div');
                    messageContainer.classList.add('flex', 'mb-2', 'justify-start');
                    botMessageDiv = document.createElement('div');
                    botMessageDiv.classList.add('bg-gray-700', 'text-gray-100', 'p-3', 'rounded-lg', 'max-w-[80%]', 'break-words', 'shadow');
                    messageContainer.appendChild(botMessageDiv);
                    chatMessages.appendChild(messageContainer);
                }

                // Añadir el texto progresivamente a la UI y acumularlo
                assistantReply += part.text;
                botMessageDiv.innerHTML = assistantReply.replaceAll('\n', '<br>'); // Reemplazar saltos de línea para HTML
                chatMessages.scrollTop = chatMessages.scrollHeight; // Desplazarse al final
            }
        }

        // Una vez que el streaming ha terminado, añadir la respuesta completa del asistente al historial
        history.push({ role: "assistant", content: assistantReply });

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        addMessageToUI("Lo siento, hubo un error al obtener la respuesta. Por favor, inténtalo de nuevo más tarde.", 'bot');
        // Si hay un error, también podrías considerar no añadir el mensaje fallido al historial
        // o añadir un mensaje de error específico si quieres que el historial refleje problemas.
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
    // Si la tecla es Enter y NO se presiona Shift (para nueva línea)
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Evita el salto de línea por defecto
        sendMessage();
    }
    // Ajustar la altura del textarea dinámicamente
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
});

// Ajustar la altura inicial del textarea (en caso de contenido preexistente)
messageInput.style.height = (messageInput.scrollHeight) + 'px';
