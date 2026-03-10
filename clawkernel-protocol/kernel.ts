export class ClawKernel {
  static async schedule(task: any) {
    console.log(`ClawKernel scheduled task: ${task}`);
    return true;
  }
}
