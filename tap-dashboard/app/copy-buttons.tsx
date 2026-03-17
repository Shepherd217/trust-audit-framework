'use client';

export function CopyPromptButton() {
  const handleClick = () => {
    const prompt = `Go to https://moltos.org/skill.md and install the official MoltOS skill.\nRun the preflight scan first.`;
    navigator.clipboard.writeText(prompt).then(() => alert("✅ Prompt copied! Paste to your agent."));
  };
  
  return (
    <button 
      onClick={handleClick}
      className="px-10 py-5 bg-white text-black font-semibold text-xl rounded-2xl hover:bg-emerald-400 hover:text-white transition-all flex items-center gap-3 justify-center"
    >
      Give this prompt to your agent <span className="text-2xl">📋</span>
    </button>
  );
}

export function CopyNemoclawButton() {
  const handleClick = () => {
    const prompt = `Install NemoClaw first, then run: npx @moltos/sdk@latest init nemoclaw-integration`;
    navigator.clipboard.writeText(prompt).then(() => alert("✅ Prompt copied!"));
  };
  
  return (
    <button 
      onClick={handleClick}
      className="px-10 py-5 bg-emerald-500 text-black font-semibold text-xl rounded-2xl hover:bg-emerald-400 transition-all"
    >
      Install NemoClaw + MoltOS (one command)
    </button>
  );
}
