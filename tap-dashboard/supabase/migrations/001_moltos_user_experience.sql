-- Database migrations for MoltOS user experience
-- Run this in your Supabase SQL editor

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    website TEXT,
    twitter TEXT,
    github TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    reputation_score INTEGER DEFAULT 0,
    total_agents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Profiles are viewable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" 
    ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- AGENT TEMPLATES TABLE (Marketplace)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    category TEXT NOT NULL,
    tags TEXT[],
    icon TEXT,
    image_url TEXT,
    price_per_hour DECIMAL(10, 2) DEFAULT 0,
    setup_fee DECIMAL(10, 2) DEFAULT 0,
    min_reputation INTEGER DEFAULT 0,
    features JSONB DEFAULT '[]',
    specs JSONB DEFAULT '{}',
    config_schema JSONB DEFAULT '{}',
    default_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent templates are viewable by everyone" 
    ON public.agent_templates FOR SELECT USING (true);

CREATE POLICY "Only admins can modify agent templates" 
    ON public.agent_templates FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- USER AGENTS TABLE (User's hired agents)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_template_id UUID REFERENCES public.agent_templates(id),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'starting', 'stopping', 'error', 'suspended')),
    health TEXT DEFAULT 'unknown' CHECK (health IN ('healthy', 'degraded', 'critical', 'unknown')),
    config JSONB DEFAULT '{}',
    hired_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    total_runtime_hours DECIMAL(10, 2) DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    vm_instance_id TEXT,
    claw_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agents" 
    ON public.user_agents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agents" 
    ON public.user_agents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" 
    ON public.user_agents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" 
    ON public.user_agents FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- AGENT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.user_agents(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their own agents" 
    ON public.agent_logs FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_agents 
            WHERE user_agents.id = agent_logs.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert logs for their own agents" 
    ON public.agent_logs FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_agents 
            WHERE user_agents.id = agent_logs.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- ============================================
-- AGENT METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.user_agents(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    value DECIMAL(10, 4) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics of their own agents" 
    ON public.agent_metrics FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_agents 
            WHERE user_agents.id = agent_metrics.agent_id 
            AND user_agents.user_id = auth.uid()
        )
    );

-- ============================================
-- SWARMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.swarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'error', 'scaling')),
    agent_ids UUID[] DEFAULT '{}',
    region TEXT,
    throughput_per_min INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.swarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own swarms" 
    ON public.swarms FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own swarms" 
    ON public.swarms FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_templates_updated_at 
    BEFORE UPDATE ON public.agent_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_agents_updated_at 
    BEFORE UPDATE ON public.user_agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarms_updated_at 
    BEFORE UPDATE ON public.swarms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user's total_agents count
CREATE OR REPLACE FUNCTION update_user_agent_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles 
        SET total_agents = total_agents + 1 
        WHERE user_id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.profiles 
        SET total_agents = total_agents - 1 
        WHERE user_id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_agent_count_trigger
    AFTER INSERT OR DELETE ON public.user_agents
    FOR EACH ROW EXECUTE FUNCTION update_user_agent_count();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON public.user_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_status ON public.user_agents(status);
CREATE INDEX IF NOT EXISTS idx_user_agents_template_id ON public.user_agents(agent_template_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON public.agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON public.agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON public.agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarms_user_id ON public.swarms(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_slug ON public.agent_templates(slug);
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON public.agent_templates(category);

-- ============================================
-- SEED DATA (Sample Agent Templates)
-- ============================================
INSERT INTO public.agent_templates (name, slug, description, short_description, category, tags, icon, price_per_hour, setup_fee, features, specs, default_config) VALUES
('Genesis Agent', 'genesis', 'The original MoltOS agent with full feature access. The Genesis Agent serves as the foundation template for all agents on the network, offering comprehensive capabilities including task execution, attestations, and reputation building.', 'The foundation agent with full MoltOS capabilities', 'core', ARRAY['core', 'foundation', 'premium'], '🦞', 5.00, 50.00, ARRAY['Full TAP integration', 'Arbitra dispute resolution', 'ClawFS persistence', 'Multi-region deployment', 'Priority support'], '{"cpu": "2 vCPU", "memory": "4 GB", "storage": "50 GB", "network": "1 Gbps"}'::jsonb, '{"auto_restart": true, "log_level": "info", "max_concurrent_tasks": 10}'::jsonb),

('Trading Bot', 'trading', 'Automated trading agent with risk management and real-time market analysis. Executes trades based on predefined strategies while maintaining strict risk parameters and compliance with market regulations.', 'AI-powered trading with built-in risk management', 'finance', ARRAY['trading', 'finance', 'automation'], '📈', 8.00, 100.00, ARRAY['Real-time market data', 'Risk management engine', 'Portfolio tracking', 'Automated rebalancing', 'Compliance checks'], '{"cpu": "4 vCPU", "memory": "8 GB", "storage": "100 GB", "network": "10 Gbps"}'::jsonb, '{"max_position_size": 1000, "stop_loss_percent": 5, "take_profit_percent": 10, "risk_level": "moderate"}'::jsonb),

('Support Agent', 'support', '24/7 customer support agent with natural language understanding and knowledge base integration. Handles inquiries, resolves common issues, and escalates complex cases to human agents.', 'Intelligent customer support automation', 'support', ARRAY['support', 'customer-service', 'nlp'], '💬', 3.00, 25.00, ARRAY['Multi-channel support', 'Knowledge base integration', 'Sentiment analysis', 'Auto-escalation', 'Conversation history'], '{"cpu": "2 vCPU", "memory": "4 GB", "storage": "30 GB", "network": "1 Gbps"}'::jsonb, '{"response_time_target": 30, "escalation_threshold": 0.7, "languages": ["en", "es", "fr"]}'::jsonb),

('Data Analyzer', 'data-analyzer', 'Advanced data processing and analysis agent. Capable of processing large datasets, generating insights, and creating visualizations. Ideal for business intelligence and research applications.', 'Powerful data analysis and visualization', 'analytics', ARRAY['analytics', 'data', 'visualization'], '📊', 6.00, 75.00, ARRAY['Big data processing', 'ML model inference', 'Report generation', 'Data visualization', 'API integrations'], '{"cpu": "8 vCPU", "memory": "16 GB", "storage": "500 GB", "network": "10 Gbps"}'::jsonb, '{"max_dataset_size_gb": 100, "auto_visualize": true, "export_formats": ["csv", "json", "pdf"]}'::jsonb),

('Security Monitor', 'security', 'Continuous security monitoring and threat detection agent. Scans for vulnerabilities, monitors network traffic, and alerts on suspicious activities with automated response capabilities.', '24/7 security monitoring and threat detection', 'security', ARRAY['security', 'monitoring', 'threat-detection'], '🔒', 10.00, 150.00, ARRAY['Real-time threat detection', 'Vulnerability scanning', 'SIEM integration', 'Automated response', 'Compliance reporting'], '{"cpu": "4 vCPU", "memory": "8 GB", "storage": "200 GB", "network": "10 Gbps"}'::jsonb, '{"scan_frequency": "hourly", "alert_threshold": "medium", "auto_block": false}'::jsonb),

('Content Creator', 'content', 'AI-powered content generation agent for blogs, social media, and marketing materials. Maintains brand voice consistency and optimizes content for engagement and SEO.', 'Automated content creation and optimization', 'marketing', ARRAY['content', 'marketing', 'seo'], '✍️', 4.00, 40.00, ARRAY['Multi-format content', 'SEO optimization', 'Brand voice learning', 'Scheduling', 'Performance analytics'], '{"cpu": "2 vCPU", "memory": "4 GB", "storage": "50 GB", "network": "1 Gbps"}'::jsonb, '{"content_types": ["blog", "social", "email"], "tone": "professional", "schedule_enabled": true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================
-- Note: Create this bucket manually in Supabase Dashboard
-- Bucket name: avatars
-- Public: true
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- Max file size: 2MB
