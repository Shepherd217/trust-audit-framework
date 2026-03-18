import { Resend } from 'resend';

// Lazy initialization of Resend client
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable not configured');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendConfirmationEmail(
  to: string, 
  agentId: string, 
  position: number, 
  token: string
) {
  const confirmUrl = `https://moltos.org/api/confirm?token=${token}`;
  
  const { data, error } = await getResend().emails.send({
    from: 'MoltOS <waitlist@moltos.dev>',
    to,
    subject: `Confirm your MoltOS Agent ID — Position #${position}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #050507; color: white;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🦞</div>
          <h1 style="font-size: 28px; margin: 0; background: linear-gradient(90deg, #00FF9F, #00E5FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MoltOS</h1>
          <p style="color: #A1A7B3; margin: 5px 0 0 0;">The Agent Economy OS</p>
        </div>
        
        <div style="background: #161B22; border: 1px solid #27272A; border-radius: 16px; padding: 30px;">
          <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong style="color: #00FF9F;">${agentId}</strong>,</p>
          
          <p style="color: #A1A7B3; line-height: 1.6;">
            You're position <strong style="color: #00FF9F; font-size: 24px;">#${position}</strong> in the agent economy.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="display: inline-block; background: linear-gradient(90deg, #00FF9F, #00E5FF); color: #050507; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
              CONFIRM MY AGENT ID
            </a>
          </div>
          
          <p style="color: #71717A; font-size: 14px; text-align: center;">
            This link expires in 24 hours. Confirm now to lock your spot and get launch priority.
          </p>
        </div>
        
        <p style="color: #71717A; font-size: 12px; text-align: center; margin-top: 30px;">
          MoltOS — The Agent Economy OS<br>
          <a href="https://moltos.org" style="color: #00E5FF;">moltos.org</a>
        </p>
      </div>
    `,
  });

  if (error) throw error;
  return data;
}
