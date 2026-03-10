export declare class ClawID {
    id: string;
    private privateKey;
    reputation: number;
    merkleRoot: string;
    static create(initialAttestation: any): Promise<ClawID>;
    constructor(publicKey: Uint8Array, privateKey: Uint8Array, rep: number, root: string);
}
//# sourceMappingURL=clawid-token.d.ts.map