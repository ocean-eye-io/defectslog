import React, { useState, useEffect } from 'react';
import { MessageCircle, X, FileDown, Shield } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fetchPSCData } from '../../services/pscService';

const ChatBot = ({ data, vesselName, filters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  const generatePDF = async () => {
    try {
      setLoading(true);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Add title
      page.drawText('PSC Deficiencies Report', {
        x: 50,
        y: page.getHeight() - 50,
        size: 20,
        font,
        color: rgb(0, 0, 0),
      });

      // Add vessel info if available
      if (vesselName) {
        page.drawText(`Vessel: ${vesselName}`, {
          x: 50,
          y: page.getHeight() - 80,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // Add deficiencies data
      if (data && data.length > 0) {
        let yPosition = page.getHeight() - 120;
        data.forEach((item, index) => {
          if (yPosition < 50) {
            page = pdfDoc.addPage();
            yPosition = page.getHeight() - 50;
          }

          page.drawText(`${index + 1}. ${item.deficiency}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });

          yPosition -= 20;
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${vesselName || 'vessel'}-psc-deficiencies.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePSCQuery = async (query) => {
    const queryLower = query.toLowerCase();
    let response = '';

    try {
      if (queryLower.includes('most common deficiencies')) {
        const apiResponse = await fetch(
          'https://pscragapi-production.up.railway.app/common-deficiencies'
        );
        const data = await apiResponse.json();
        response =
          'Most common PSC deficiencies:\n\n' +
          data
            .map(
              (item, index) =>
                `${index + 1}. ${item.deficiency}\n   Occurrences: ${item.count}`
            )
            .join('\n\n');
      } else if (queryLower.includes('detainable deficiencies in australian ports')) {
        const apiResponse = await fetch(
          'https://pscragapi-production.up.railway.app/detainable-deficiencies?country=Australia'
        );
        const data = await apiResponse.json();
        response =
          'Top Ports with Deficiencies:\n\n' +
          data
            .map(
              (item, index) =>
                `${index + 1}. ${item.port}\n   Detentions: ${item.detentions}`
            )
            .join('\n\n');
      } else {
        response =
          "I can help you with PSC deficiencies analysis. Try asking:\n\n" +
          "• Show most common deficiencies\n" +
          "• Show detainable deficiencies in Australian ports\n\n" +
          "You can also generate a defects report using the button below.";
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      response = 'Sorry, I encountered an error processing your request. Please try again.';
    }

    return response;
  };

  const handleMessageSubmit = async () => {
    if (!userInput.trim()) return;

    const newMessage = {
      text: userInput,
      type: 'user',
    };

    setMessages((prev) => [...prev, newMessage]);
    setUserInput('');

    const response = await handlePSCQuery(userInput);

    setMessages((prev) => [
      ...prev,
      {
        text: response,
        type: 'bot',
      },
    ]);
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

            {/* Generate Report Button */}
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
