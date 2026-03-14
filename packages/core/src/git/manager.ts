import { simpleGit, type SimpleGit } from "simple-git";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

export class GitManager {
  private git: SimpleGit;
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.git = simpleGit(baseDir);
  }

  /** Initialize .magi directory structure */
  async initMagiDir(): Promise<void> {
    const magiDir = `${this.baseDir}/.magi`;
    const discussionsDir = `${magiDir}/discussions`;

    if (!existsSync(magiDir)) {
      await mkdir(magiDir, { recursive: true });
    }
    if (!existsSync(discussionsDir)) {
      await mkdir(discussionsDir, { recursive: true });
    }
  }

  /** Create a commit with a prefixed message */
  async commit(
    prefix: string,
    message: string,
    files?: string[],
  ): Promise<string> {
    if (files && files.length > 0) {
      await this.git.add(files);
    } else {
      await this.git.add(".");
    }

    const result = await this.git.commit(`${prefix}: ${message}`);
    return result.commit || "";
  }

  /** Create a new branch */
  async createBranch(branchName: string): Promise<void> {
    await this.git.checkoutLocalBranch(branchName);
  }

  /** Get current branch name */
  async getCurrentBranch(): Promise<string> {
    const result = await this.git.branch();
    return result.current;
  }

  /** Check if there are uncommitted changes */
  async hasChanges(): Promise<boolean> {
    const status = await this.git.status();
    return !status.isClean();
  }

  /** Get the short hash of HEAD */
  async getHeadHash(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 });
    return log.latest?.hash.substring(0, 7) ?? "";
  }

  /** Get log entries */
  async getLog(count: number = 10): Promise<Array<{ hash: string; message: string; date: string }>> {
    const log = await this.git.log({ maxCount: count });
    return log.all.map((entry) => ({
      hash: entry.hash.substring(0, 7),
      message: entry.message,
      date: entry.date,
    }));
  }
}
