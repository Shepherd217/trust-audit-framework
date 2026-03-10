"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClawID = void 0;
const crypto_1 = require("crypto");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
class ClawID {
    static async create(initialAttestation) {
        const keypair = tweetnacl_1.default.sign.keyPair();
        const root = (0, crypto_1.createHash)('sha256').update(JSON.stringify(initialAttestation)).digest('hex');
        return new ClawID(keypair.publicKey, keypair.secretKey, initialAttestation.reputation, root);
    }
    constructor(publicKey, privateKey, rep, root) {
        this.id = Buffer.from(publicKey).toString('hex');
        this.privateKey = privateKey;
        this.reputation = rep;
        this.merkleRoot = root;
    }
}
exports.ClawID = ClawID;
//# sourceMappingURL=clawid-token.js.map