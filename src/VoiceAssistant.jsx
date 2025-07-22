import React, { useState, useRef, useEffect } from 'react';
import AskAi from './AskAi';
import { Mic, MicOff, Volume2, VolumeX, Settings, Activity, Zap, StopCircle, Pause, Play } from 'lucide-react';

const ProfessionalVoiceAI = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [conversationCount, setConversationCount] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const waveformRef = useRef(null);
  const recognitionRef = useRef(null);
  const autoRestartTimeoutRef = useRef(null);

  // Professional waveform animation
  useEffect(() => {
    if (isListening && waveformRef.current) {
      const bars = waveformRef.current.children;
      const animateBars = () => {
        Array.from(bars).forEach((bar, i) => {
          const baseHeight = 8;
          const amplitude = isListening ? 40 : 0;
          const frequency = 0.02;
          const phase = i * 0.5;
          const height = baseHeight + Math.sin(Date.now() * frequency + phase) * amplitude;
          bar.style.height = `${Math.max(height, baseHeight)}px`;
          bar.style.opacity = isListening ? 0.8 + Math.sin(Date.now() * 0.01 + i) * 0.2 : 0.3;
        });
      };
      
      const interval = setInterval(animateBars, 50);
      return () => clearInterval(interval);
    }
  }, [isListening]);

  const SpeechRecognition = typeof window !== 'undefined' ? 
    (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  // Auto-restart listening after AI response (continuous mode)
  const scheduleAutoRestart = () => {
    if (continuousMode && !isPaused) {
      autoRestartTimeoutRef.current = setTimeout(() => {
        if (!isListening && !isProcessing && !isSpeaking && !isPaused) {
          startListening(true);
        }
      }, 1500); // 1.5 second delay after AI finishes speaking
    }
  };

  // Clear auto-restart timeout
  const clearAutoRestart = () => {
    if (autoRestartTimeoutRef.current) {
      clearTimeout(autoRestartTimeoutRef.current);
      autoRestartTimeoutRef.current = null;
    }
  };

  // Stop current audio and interrupt if speaking
  const stopCurrentAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsSpeaking(false);
      setIsInterrupted(true);
    }
    clearAutoRestart();
  };

  const startListening = (isAutoRestart = false) => {
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    // If AI is speaking, interrupt it
    if (isSpeaking) {
      stopCurrentAudio();
    }

    // Enable continuous mode on first manual start
    if (!isAutoRestart && !continuousMode) {
      setContinuousMode(true);
    }
    
    clearAutoRestart();
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    setIsListening(true);
    setCurrentTranscript('');
    recognition.start();

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setCurrentTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        handleVoiceInput(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setCurrentTranscript('');
      
      // If in continuous mode and not manually stopped, try to restart
      if (continuousMode && !isPaused && event.error !== 'aborted') {
        scheduleAutoRestart();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // If no final transcript was received and in continuous mode, restart
      if (continuousMode && !isPaused && !currentTranscript) {
        scheduleAutoRestart();
      }
    };
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setCurrentTranscript('');
    clearAutoRestart();
  };

  const toggleContinuousMode = () => {
    const newMode = !continuousMode;
    setContinuousMode(newMode);
    
    if (!newMode) {
      // Stopping continuous mode
      stopListening();
      clearAutoRestart();
      setIsPaused(false);
    } else if (!isListening && !isProcessing && !isSpeaking) {
      // Starting continuous mode
      startListening();
    }
  };

  const pauseConversation = () => {
    setIsPaused(true);
    stopListening();
    stopCurrentAudio();
    clearAutoRestart();
  };

  const resumeConversation = () => {
    setIsPaused(false);
    if (continuousMode && !isListening && !isProcessing && !isSpeaking) {
      startListening(true);
    }
  };

  const handleVoiceInput = async (transcript) => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    setConversationCount(prev => prev + 1);

    try {
      // Prepare context for AI
      let contextualPrompt = transcript;
      
      // If this is an interruption, combine with previous context
      if (isInterrupted && lastResponse) {
        contextualPrompt = `Previous context: "${lastResponse}"\n\nUser interruption/continuation: "${transcript}"\n\nPlease respond considering both the previous context and the new input.`;
        setIsInterrupted(false);
      }

      // Add conversation history for context
      if (conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-4); // Last 4 exchanges
        const historyContext = recentHistory.map(entry => 
          `${entry.role}: ${entry.content}`
        ).join('\n');
        
        contextualPrompt = `Conversation history:\n${historyContext}\n\nCurrent input: ${transcript}`;
      }

      // Call AskAi function
      const aiResponse = await AskAi(contextualPrompt);
      
      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: aiResponse }
      ]);

      setLastResponse(aiResponse);
      setIsProcessing(false);
      
      // Speak the response
      await speakResponse(aiResponse);
      
    } catch (error) {
      console.error('AI processing error:', error);
      const errorResponse = "I apologize, but I encountered an error processing your request. Please try again.";
      setLastResponse(errorResponse);
      setIsProcessing(false);
      await speakResponse(errorResponse);
    }
  };

  const speakResponse = async (text) => {
    setIsSpeaking(true);
    
    // Using ElevenLabs API
    // New One = sk_a106cc5a0a4f70a578cd02f9410490e812ad0474143e2bec
      const apiKey = 'sk_309ec6cb402c9c82d37771e4e7db0018e244f123752c4cc1';
      const voiceId = 'M7w7Nrg0qw7vkKGD4cYu';

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { 
            stability: 0.6, 
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true
          },
        }),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        
        audio.onended = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
          
          // Schedule auto-restart in continuous mode
          scheduleAutoRestart();
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          setCurrentAudio(null);
          URL.revokeObjectURL(audioUrl);
          
          // Schedule auto-restart even on error in continuous mode
          scheduleAutoRestart();
        };
        
        await audio.play();
      } else {
        setIsSpeaking(false);
        console.error('TTS API error:', response.status);
        scheduleAutoRestart();
      }
    } catch (error) {
      setIsSpeaking(false);
      console.error('TTS Error:', error);
      scheduleAutoRestart();
    }
  };

  const clearConversation = () => {
    setConversationHistory([]);
    setLastResponse('');
    setConversationCount(0);
    setCurrentTranscript('');
    setContinuousMode(false);
    setIsPaused(false);
    stopCurrentAudio();
    stopListening();
    clearAutoRestart();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoRestart();
    };
  }, []);

  const VoiceWaveform = () => (
    <div ref={waveformRef} className="flex items-center justify-center space-x-1 h-20">
      {[...Array(25)].map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-100 ease-out"
          style={{ 
            height: '8px',
            background: continuousMode 
              ? 'linear-gradient(to top, #10b981, #047857, #34d399)' 
              : 'linear-gradient(to top, #3b82f6, #1d4ed8, #60a5fa)',
            boxShadow: isListening 
              ? `0 0 8px ${continuousMode ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)'}` 
              : 'none'
          }}
        />
      ))}
    </div>
  );

  const StatusIndicator = ({ active, label, icon: Icon }) => (
    <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
      active 
        ? continuousMode
          ? 'bg-gradient-to-r from-green-600/20 to-green-800/20 border border-green-500/30'
          : 'bg-gradient-to-r from-blue-600/20 to-blue-800/20 border border-blue-500/30'
        : 'bg-gray-800/50 border border-gray-700/50'
    }`}>
      <Icon className={`w-4 h-4 ${
        active 
          ? continuousMode ? 'text-green-400' : 'text-blue-400'
          : 'text-gray-400'
      }`} />
      <span className={`text-sm font-medium ${
        active 
          ? continuousMode ? 'text-green-300' : 'text-blue-300'
          : 'text-gray-400'
      }`}>
        {label}
      </span>
      {active && (
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          continuousMode ? 'bg-green-400' : 'bg-blue-400'
        }`} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
      {/* Professional Grid Background */}
      <div className="fixed inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(${continuousMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'} 1px, transparent 1px),
            linear-gradient(90deg, ${continuousMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Subtle Gradient Overlay */}
      <div className={`fixed inset-0 pointer-events-none ${
        continuousMode 
          ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-green-950/20'
          : 'bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950/20'
      }`} />

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                continuousMode 
                  ? 'bg-gradient-to-br from-green-600 to-green-800'
                  : 'bg-gradient-to-br from-blue-600 to-blue-800'
              }`}>
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">MentorVerse</h1>
                <p className={`text-sm ${
                  continuousMode ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {continuousMode ? 'Continuous Conversation Mode' : 'AI-Powered Voice Companion'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Conversations: <span className={`font-medium ${
                  continuousMode ? 'text-green-400' : 'text-blue-400'
                }`}>{conversationCount}</span>
              </div>
              
              {/* Continuous Mode Toggle */}
              <button 
                onClick={toggleContinuousMode}
                className={`px-3 py-1 text-xs rounded-lg transition-colors border ${
                  continuousMode
                    ? 'bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-300'
                    : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700/50 text-gray-300'
                }`}
              >
                {continuousMode ? 'Stop Auto' : 'Auto Mode'}
              </button>

              {/* Pause/Resume Button */}
              {continuousMode && (
                <button 
                  onClick={isPaused ? resumeConversation : pauseConversation}
                  className={`p-2 rounded-lg transition-colors border ${
                    isPaused
                      ? 'bg-yellow-600/20 hover:bg-yellow-600/30 border-yellow-500/30'
                      : 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/30'
                  }`}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Pause className="w-4 h-4 text-orange-400" />
                  )}
                </button>
              )}
              
              <button 
                onClick={clearConversation}
                className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button className="p-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-colors">
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Status Bar */}
        <div className="flex justify-center space-x-4 mb-12">
          <StatusIndicator active={isListening} label="Listening" icon={Mic} />
          <StatusIndicator active={isProcessing} label="Processing" icon={Activity} />
          <StatusIndicator active={isSpeaking} label="Speaking" icon={Volume2} />
        </div>

        {/* Central Voice Interface */}
        <div className="text-center space-y-8">
          {/* Main Voice Button */}
          <div className="relative inline-block">
            <button
              onClick={continuousMode ? (isListening ? stopListening : startListening) : (isListening ? stopListening : startListening)}
              disabled={isProcessing || isPaused}
              className={`relative p-8 rounded-full transition-all duration-300 shadow-2xl ${
                isPaused
                  ? 'bg-gradient-to-br from-yellow-600 to-yellow-800 cursor-not-allowed'
                  : isListening
                  ? 'bg-gradient-to-br from-red-500 to-red-700 scale-110'
                  : isProcessing
                  ? 'bg-gradient-to-br from-gray-600 to-gray-800 cursor-not-allowed'
                  : continuousMode
                  ? 'bg-gradient-to-br from-green-600 to-green-800 hover:scale-105 hover:from-green-500 hover:to-green-700'
                  : 'bg-gradient-to-br from-blue-600 to-blue-800 hover:scale-105 hover:from-blue-500 hover:to-blue-700'
              }`}
            >
              {isPaused ? (
                <Pause className="w-12 h-12 text-white" />
              ) : isListening ? (
                <MicOff className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-white" />
              )}
              
              {/* Animated Ring */}
              {(isListening || isProcessing) && (
                <div className={`absolute -inset-2 rounded-full border-2 animate-ping ${
                  continuousMode ? 'border-green-400/50' : 'border-blue-400/50'
                }`} />
              )}
            </button>
          </div>

          {/* Stop Speaking Button (when AI is speaking) */}
          {isSpeaking && (
            <button
              onClick={stopCurrentAudio}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg transition-all duration-200 shadow-lg flex items-center space-x-2 mx-auto"
            >
              <StopCircle className="w-5 h-5" />
              <span>Stop Speaking</span>
            </button>
          )}

          {/* Voice Waveform */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 p-8">
            <VoiceWaveform />
          </div>

          {/* Status Text */}
          <div className="space-y-4">
            {isPaused && (
              <div className="animate-pulse">
                <p className="text-lg text-yellow-400 font-medium">Conversation Paused</p>
                <p className="text-sm text-gray-400 mt-1">Click resume to continue</p>
              </div>
            )}
            
            {!isPaused && isListening && (
              <div className="animate-pulse">
                <p className={`text-lg font-medium ${
                  continuousMode ? 'text-green-400' : 'text-blue-400'
                }`}>
                  {isSpeaking ? "Interrupting AI - Listening..." : 
                   continuousMode ? "Auto-Listening..." : "Listening..."}
                </p>
                {currentTranscript && (
                  <p className="text-gray-300 mt-2 italic">"{currentTranscript}"</p>
                )}
              </div>
            )}
            
            {!isPaused && isProcessing && (
              <div className="animate-pulse">
                <p className={`text-lg font-medium ${
                  continuousMode ? 'text-green-400' : 'text-blue-400'
                }`}>Processing with AI...</p>
                <div className="flex justify-center space-x-1 mt-3">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    continuousMode ? 'bg-green-400' : 'bg-blue-400'
                  }`} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    continuousMode ? 'bg-green-400' : 'bg-blue-400'
                  }`} style={{ animationDelay: '0.1s' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    continuousMode ? 'bg-green-400' : 'bg-blue-400'
                  }`} style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}
            
            {!isPaused && isSpeaking && (
              <div className="animate-pulse">
                <p className={`text-lg font-medium ${
                  continuousMode ? 'text-green-400' : 'text-green-400'
                }`}>AI Speaking...</p>
                <p className="text-sm text-gray-400 mt-1">
                  {continuousMode 
                    ? "Will auto-listen after response • Click microphone to interrupt"
                    : "Click microphone to interrupt"
                  }
                </p>
              </div>
            )}
            
            {!isPaused && !isListening && !isProcessing && !isSpeaking && (
              <div>
                <p className={`text-lg ${
                  continuousMode ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {conversationCount === 0 
                    ? continuousMode
                      ? "Continuous mode active - Start speaking to begin"
                      : "Click the microphone to start a conversation" 
                    : continuousMode
                    ? "Ready - Will auto-listen after responses"
                    : "Ready for your next question"
                  }
                </p>
                {lastResponse && (
                  <div className="mt-6 p-4 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800/50 max-w-2xl mx-auto">
                    <p className="text-sm text-gray-300 italic">Last response: "{lastResponse.substring(0, 200)}..."</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Instructions */}
          <div className={`mt-12 p-6 backdrop-blur-sm rounded-xl border border-gray-800/50 ${
            continuousMode 
              ? 'bg-gradient-to-r from-gray-900/50 to-green-900/20'
              : 'bg-gradient-to-r from-gray-900/50 to-blue-900/20'
          }`}>
            <h3 className="text-lg font-semibold text-white mb-3">
              {continuousMode ? 'Continuous Conversation Mode' : 'How to Use'}
            </h3>
            
            {continuousMode ? (
              <div className="space-y-3 text-sm text-gray-300">
                <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/20">
                  <p className="text-green-300 font-medium mb-2">🔄 Auto-Flow Active</p>
                  <p>The conversation will continue automatically after each AI response. The microphone will turn on automatically after a 1.5-second delay.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white">🎤</div>
                    <p>Speak naturally - no need to click</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white">⏸️</div>
                    <p>Use pause button to stop auto-mode</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white">🔄</div>
                    <p>Interrupt AI anytime by speaking</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white">🛑</div>
                    <p>Toggle "Auto Mode" to disable</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">1</div>
                  <p>Click microphone to start speaking</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">2</div>
                  <p>AI processes with full context</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">3</div>
                  <p>Listen to AI voice response</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">4</div>
                  <p>Enable "Auto Mode" for continuous chat</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4 text-center text-sm text-gray-500">
          Professional Voice AI Assistant • {continuousMode ? 'Continuous Mode Active' : 'Manual Mode'} • Powered by Advanced AI & Speech Recognition
        </div>
      </footer>
    </div>
  );
};

export default ProfessionalVoiceAI;
