import React, { useState } from 'react';

const VoiceAssistant = () => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';

  // Start Listening
  const startListening = () => {
    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(spokenText);
      speakWithElevenLabs(spokenText); // call ElevenLabs here
    };

    recognition.onerror = (event) => {
      console.error('Speech error', event);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  // ElevenLabs TTS
  const speakWithElevenLabs = async (inputText) => {
    const apiKey = 'sk_58d8bd2f25bb1598ced769c6880ba8452349ca006fe1f6a8';
    const voiceId = 'MF4J4IDTRo0AxOO4dpFR'; // or use your preferred voice from ElevenLabs

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `You said: ${inputText}`,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.7 },
      }),
    });

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play();
  };

  return (
    <div className="p-4 text-center">
      <h2 className="text-xl font-bold mb-2">🎤 Voice Assistant</h2>
      <button onClick={startListening} disabled={isListening} className="bg-blue-600 text-white px-4 py-2 rounded">
        {isListening ? 'Listening...' : 'Start Talking'}
      </button>
      <p className="mt-4">🗣 You said: <strong>{text}</strong></p>
    </div>
  );
};

export default VoiceAssistant;




