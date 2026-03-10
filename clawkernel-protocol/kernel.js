"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClawKernel = void 0;
class ClawKernel {
    static async schedule(task) {
        console.log(`ClawKernel scheduled task: ${task}`);
        return true;
    }
}
exports.ClawKernel = ClawKernel;
//# sourceMappingURL=kernel.js.map