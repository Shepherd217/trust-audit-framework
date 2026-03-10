import { createHash, randomBytes } from 'crypto';

export class ClawID {
  public id: string;
  private privateKey: Buffer;
  public reputation: number;
  public merkleRoot: string;

  static async create(initialAttestation: any) {
    // Generate Ed25519 keypair using Node.js crypto
    const privateKey = randomBytes(32);
    const root = createHash('sha256').update(JSON.stringify(initialAttestation)).digest('hex');
    return new ClawID(privateKey, initialAttestation.reputation, root);
  }

  constructor(privateKey: Buffer, rep: number, root: string) {
    this.id = createHash('sha256').update(privateKey).digest('hex').substring(0, 64);
    this.privateKey = privateKey;
    this.reputation = rep;
    this.merkleRoot = root;
  }
}
