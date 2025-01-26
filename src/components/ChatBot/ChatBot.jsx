import React, { useState, useEffect } from 'react';
import { MessageCircle, X, FileDown, Shield } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { analyzePSCData } from '../../utils/pscAnalysis';
import { fetchPSCData } from '../../services/pscService';

const ChatBot = ({ data, vesselName, filters }) => {
  // Keep your existing state variables
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [pscAnalyzer, setPscAnalyzer] = useState(null);

  // Add new state for PSC data
  useEffect(() => {
    const loadPSCData = async () => {
      try {
        const pscData = await fetchPSCData();
        setPscAnalyzer(analyzePSCData(pscData));
      } catch (error) {
        console.error('Error loading PSC data:', error);
      }
    };
    loadPSCData();
  }, []);

  // Keep your existing generatePDF function unchanged
  // ... (your existing generatePDF function)

  const handlePSCQuery = async (query) => {
    if (!pscAnalyzer) {
      return "PSC data is still loading...";
    }

    const queryLower = query.toLowerCase();
    let response = '';

    try {
      if (queryLower.includes('common deficiencies')) {
        const common = pscAnalyzer.getCommonDeficiencies();
        response = 'Most common PSC deficiencies:\n\n' + 
          common.map(([def, count], i) => 
            `${i + 1}. ${def}\n   Occurrences: ${count}`).join('\n\n');
      }
      else if (queryLower.includes('detention')) {
        const detentions = pscAnalyzer.getDetentionAnalysis();
        response = 'Recent Detention Cases:\n\n' + 
          detentions.slice(0, 5).map(d => 
            `Port: ${d.port}, ${d.country}\n` +
            `Date: ${d.date}\n` +
            `Vessel Type: ${d.vesselType}\n` +
            `Reason: ${d.deficiency}`
          ).join('\n\n');
      }
      else if (queryLower.includes('criticality')) {
        const criticalities = pscAnalyzer.getDeficienciesByCriticality();
        response = 'Deficiencies by Criticality Level:\n\n' + 
          Object.entries(criticalities)
            .map(([level, count]) => `${level}: ${count} cases`)
            .join('\n\n');
      }
      else if (queryLower.includes('port')) {
        const portData = pscAnalyzer.getDeficienciesByPort();
        response = 'Top Ports with Deficiencies:\n\n' + 
          Object.entries(portData)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5)
            .map(([port, data]) => 
              `${port}, ${data.country}\n` +
              `Total deficiencies: ${data.count}\n` +
              `Detentions: ${data.detentions}`
            ).join('\n\n');
      }
      else if (queryLower.includes('search')) {
        const searchTerm = queryLower.replace('search', '').trim();
        const results = pscAnalyzer.searchDeficiencies(searchTerm);
        response = `Search results for "${searchTerm}":\n\n` +
          results.map((r, i) => 
            `${i + 1}. ${r['Nature of deficiency']}\n` +
            `   Criticality: ${CRITICALITY_MAPPING[r['Reference Code1']] || 'Unknown'}`
          ).join('\n\n');
      }
      else {
        response = "I can help you with PSC deficiencies analysis. Try asking:\n\n" +
          "• Show common deficiencies\n" +
          "• Show detention cases\n" +
          "• Show deficiencies by criticality\n" +
          "• Show port-wise analysis\n" +
          "• Search [term] for specific deficiencies\n\n" +
          "You can also generate a defects report using the button below.";
      }
    } catch (error) {
      console.error('Error processing query:', error);
      response = "Sorry, I encountered an error processing your request. Please try again.";
    }

    return response;
  };

  const handleMessageSubmit = async () => {
    if (!userInput.trim()) return;

    const newMessage = {
      text: userInput,
      type: 'user'
    };

    setMessages(prev => [...prev, newMessage]);
    setUserInput('');

    const response = await handlePSCQuery(userInput);
    
    setMessages(prev => [...prev, {
      text: response,
      type: 'bot'
    }]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 p-3 rounded-full bg-orange-500 text-white shadow-lg 
        hover:bg-orange-600 transition-all ${isOpen ? 'scale-0' : 'scale-100'} z-50`}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Ask AI</span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed bottom-4 right-4 w-96 bg-[#132337] rounded-lg shadow-xl border border-white/10 z-50">
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">PSC Assistant</h3>
                  <p className="text-xs text-white/60">Ask about PSC deficiencies</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`${
                    message.type === 'user' 
                      ? 'bg-orange-500/10 ml-auto' 
                      : 'bg-white/5'
                  } rounded-lg p-3 max-w-[80%]`}
                >
                  <pre className="text-xs text-white/90 whitespace-pre-wrap">
                    {message.text}
                  </pre>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleMessageSubmit();
                    }
                  }}
                  placeholder="Ask about PSC deficiencies..."
                  className="flex-1 bg-white/5 rounded-md px-3 py-2 text-sm text-white 
                    focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  onClick={handleMessageSubmit}
                  className="bg-orange-500 text-white px-4 py-2 rounded-md text-sm 
                    hover:bg-orange-600 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Keep your existing Generate Report button */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={generatePDF}
                disabled={loading}
                className="w-full py-2 px-4 bg-orange-500 text-white text-sm rounded-md
                hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Generating PDF...'
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Generate Defects Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
