import { createHash } from 'crypto';
import nacl from 'tweetnacl';

export class ClawID {
  public id: string;
  private privateKey: Uint8Array;
  public reputation: number;
  public merkleRoot: string;

  static async create(initialAttestation: any) {
    const keypair = nacl.sign.keyPair();
    const root = createHash('sha256').update(JSON.stringify(initialAttestation)).digest('hex');
    return new ClawID(keypair.publicKey, keypair.secretKey, initialAttestation.reputation, root);
  }

  constructor(publicKey: Uint8Array, privateKey: Uint8Array, rep: number, root: string) {
    this.id = Buffer.from(publicKey).toString('hex');
    this.privateKey = privateKey;
    this.reputation = rep;
    this.merkleRoot = root;
  }
}
