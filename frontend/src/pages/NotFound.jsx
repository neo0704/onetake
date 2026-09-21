import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-center p-4">
      <div>
        <Clapperboard className="w-16 h-16 text-primary/40 mx-auto mb-4" />
        <h1 className="text-6xl font-black text-white mb-2">404</h1>
        <p className="text-white/50 mb-6">This page doesn't exist</p>
        <button onClick={() => navigate(-1)} className="btn-primary mx-auto">Go Back</button>
      </div>
    </div>
  );
}
