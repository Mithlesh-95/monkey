import React from 'react';
import Game from './components/Game';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-8">
      <div className="text-center flex flex-col items-center">
        <h1 className="text-4xl font-bold text-white mb-8">Banana Rush</h1>
        <Game />
      </div>
    </div>
  );
}

export default App;