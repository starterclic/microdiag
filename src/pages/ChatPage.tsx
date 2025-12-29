// ============================================
// MICRODIAG SENTINEL - Chat Page
// ============================================

import { ChatMessage } from '../types';

interface ChatPageProps {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (slug: string, name: string) => void;
}

export function ChatPage({
  messages,
  input,
  loading,
  onInputChange,
  onSend,
  onQuickAction,
}: ChatPageProps) {
  return (
    <div className="page chat-page">
      <div className="page-header">
        <h1>Assistant IA</h1>
      </div>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-avatar">{msg.role === 'user' ? 'U' : 'AI'}</div>
              <div className="message-content">
                <p>{msg.content}</p>
                {msg.action && (
                  <button
                    className="action-suggestion"
                    onClick={() => onQuickAction(msg.action!, msg.action!)}
                  >
                    Executer {msg.action}
                  </button>
                )}
                <span className="message-time">
                  {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <div className="message-avatar">AI</div>
              <div className="message-content typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </div>
        <div className="chat-quick-actions">
          <button onClick={() => onInputChange("Mon PC est lent")}>PC lent</button>
          <button onClick={() => onInputChange("Comment liberer de l'espace ?")}>Espace disque</button>
          <button onClick={() => onInputChange("J'ai un probleme d'imprimante")}>Imprimante</button>
          <button onClick={() => onInputChange("Securiser mon PC")}>Securite</button>
        </div>
        <div className="chat-input-container">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSend()}
            placeholder="Posez votre question..."
            disabled={loading}
          />
          <button onClick={onSend} disabled={loading || !input.trim()}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
