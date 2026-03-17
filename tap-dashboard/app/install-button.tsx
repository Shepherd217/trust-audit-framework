'use client';

export default function InstallButton() {
  const handleClick = () => {
    const cmd = `npx @moltos/nemoclaw-integration@latest install`;
    navigator.clipboard.writeText(cmd);
    alert('✅ Command copied! Paste in your terminal to install.');
  };

  return (
    <button 
      onClick={handleClick}
      className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/20"
    >
      Install NemoClaw + MoltOS (one command)
    </button>
  );
}
