import React, { useState } from 'react';
import { Check, Send, Gamepad2, Flame } from 'lucide-react';

const TruthDareGame = ({
    gameState,
    userId,
    partnerId,
    onPick,
    onSend,
    onComplete,
    onStart,
    isEmbedded = false
}) => {
    const [challengeText, setChallengeText] = useState('');

    const handleSendChallenge = () => {
        if (!challengeText.trim()) return;
        onSend(challengeText);
        setChallengeText('');
    };

    const stage = gameState?.stage || 'idle';
    const isAsker = gameState?.turn === userId;
    const isPerformer = !isAsker && stage !== 'idle';

    if (stage === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <Flame size={40} className="text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Truth or Dare</h2>
                    <p className="text-gray-400">Ready to spill secrets or take on challenges?</p>
                </div>
                <button
                    onClick={onStart}
                    className="w-full max-w-xs py-4 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                >
                    <Gamepad2 size={20} />
                    Start New Game
                </button>
            </div>
        );
    }

    if (stage === 'picking') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-8">
                <h2 className="text-2xl font-bold text-white">
                    {isAsker ? "It's Your Turn! 🔥" : "Partner is Picking..."}
                </h2>
                {isAsker ? (
                    <div className="flex flex-col w-full gap-4 max-w-sm">
                        <button
                            onClick={() => onPick('truth')}
                            className="group relative overflow-hidden py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xl transition-all shadow-lg hover:shadow-blue-500/25"
                        >
                            <span className="relative z-10">TRUTH</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        </button>
                        <button
                            onClick={() => onPick('dare')}
                            className="group relative overflow-hidden py-6 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold text-xl transition-all shadow-lg hover:shadow-red-500/25"
                        >
                            <span className="relative z-10">DARE</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
                            <div className="w-3 h-3 bg-violet-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                        </div>
                        <p className="text-gray-400 italic">Waiting for your friend to choose their fate...</p>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'writing') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                <h2 className="text-2xl font-bold text-white">
                    {isAsker ? `Set a ${gameState.type.toUpperCase()}` : `Partner is writing...`}
                </h2>
                {isAsker ? (
                    <div className="w-full max-w-md space-y-4">
                        <textarea
                            value={challengeText}
                            onChange={(e) => setChallengeText(e.target.value)}
                            placeholder={gameState.type === 'truth' ? "Ask a risky question..." : "Give them a wild task..."}
                            className="w-full bg-gray-800 border-2 border-gray-700 focus:border-pink-500 rounded-2xl p-4 text-white placeholder-gray-500 outline-none resize-none h-32 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleSendChallenge}
                            disabled={!challengeText.trim()}
                            className="w-full py-4 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                        >
                            <Send size={18} /> Send Challenge
                        </button>
                    </div>
                ) : (
                    <div className="text-gray-400 animate-pulse">
                        Thinking of something juicy...
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'performing') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-8">
                <h2 className="text-2xl font-bold text-white">
                    {isPerformer ? 'Your Challenge! 🎯' : "Challenge in Progress"}
                </h2>
                <div className="w-full max-w-md bg-gray-800/50 border border-gray-700 rounded-3xl p-8 relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-2 h-full bg-pink-600"></div>
                    <p className="text-xl text-white leading-relaxed font-medium">
                        "{gameState.content}"
                    </p>
                </div>
                {isPerformer ? (
                    <button
                        onClick={onComplete}
                        className="group w-full max-w-xs py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-green-500/25"
                    >
                        <Check size={20} className="group-hover:scale-125 transition-transform" />
                        Mission Accomplished
                    </button>
                ) : (
                    <p className="text-gray-400 italic">Waiting for them to finish...</p>
                )}
            </div>
        );
    }

    return null;
};

export default TruthDareGame;
