      </motion.div>
    </>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle,
  color 
}: { 
  icon: typeof Award;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    'neon-green': 'text-neon-green bg-neon-green/10',
    'cyan-blue': 'text-cyan-blue bg-cyan-blue/10',
    'electric-purple': 'text-electric-purple bg-electric-purple/10',
    'warning': 'text-warning bg-warning/10',
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <p className="text-text-muted text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      
      {subtitle && (
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      )}
    </div>
  );
}
