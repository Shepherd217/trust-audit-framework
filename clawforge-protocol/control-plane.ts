export class ClawForgeControlPlane {
  static async registerAgent(agentId: string, clawID: any) {
    console.log(`ClawForge registered agent ${agentId}`);
    return true;
  }
}
