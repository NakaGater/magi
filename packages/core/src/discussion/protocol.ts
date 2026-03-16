import type {
  Statement,
  RoundResult,
  ConsensusStatus,
  MagiEvent,
  MagiEventHandler,
  PipelineStage,
} from "../types.js";
import type { RoleEngine } from "../roles/engine.js";

export interface DiscussionOptions {
  topic: string;
  context: string;
  stage: PipelineStage;
  maxRounds: number;
  minRounds?: number;
}

export interface DiscussionResult {
  rounds: RoundResult[];
  allStatements: Statement[];
  finalConsensus: ConsensusStatus;
}

/**
 * Discussion protocol: manages multi-round discussions between roles.
 * Extracted from PipelineRunner to be reusable across Spec and Build modes.
 */
export class DiscussionProtocol {
  private roleEngine: RoleEngine;
  private eventHandlers: MagiEventHandler[] = [];
  private pendingMessages: string[] = [];

  constructor(roleEngine: RoleEngine) {
    this.roleEngine = roleEngine;
  }

  /** Queue a user message to be injected after the current round */
  injectMessage(message: string): void {
    this.pendingMessages.push(message);
  }

  onEvent(handler: MagiEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: Omit<MagiEvent, "timestamp">): void {
    const fullEvent: MagiEvent = { ...event, timestamp: new Date() };
    for (const handler of this.eventHandlers) {
      handler(fullEvent);
    }
  }

  /** Run a full discussion with multiple rounds until consensus or maxRounds */
  async discuss(options: DiscussionOptions): Promise<DiscussionResult> {
    const { topic, context, stage, maxRounds, minRounds } = options;
    const rounds: RoundResult[] = [];
    const allStatements: Statement[] = [];

    for (let round = 1; round <= maxRounds; round++) {
      this.emit({
        type: "round_start",
        stage,
        data: { round },
      });

      const roundResult = await this.roleEngine.runRound(
        topic,
        context,
        round,
        allStatements,
      );

      rounds.push(roundResult);
      allStatements.push(...roundResult.statements);

      // Emit each statement
      for (const stmt of roundResult.statements) {
        this.emit({
          type: "statement",
          stage,
          data: {
            role: stmt.role,
            content: stmt.content,
            round,
          },
        });
      }

      // Drain pending user messages
      while (this.pendingMessages.length > 0) {
        const message = this.pendingMessages.shift()!;
        const userStatement: Statement = {
          role: "User",
          content: message,
          timestamp: new Date(),
          round,
        };
        allStatements.push(userStatement);
        this.emit({
          type: "user_message",
          stage,
          data: {
            role: "User",
            content: message,
            round,
          },
        });
      }

      this.emit({
        type: "round_end",
        stage,
        data: { round, consensus: roundResult.consensus },
      });

      // If all roles agree and minimum rounds reached, stop early
      if (roundResult.consensus === "agreed" && round >= (minRounds ?? 2)) {
        break;
      }
    }

    const lastRound = rounds[rounds.length - 1];
    const finalConsensus = lastRound?.consensus ?? "disagreed";

    return {
      rounds,
      allStatements,
      finalConsensus,
    };
  }

  /** Extract key points from discussion statements */
  extractKeyPoints(statements: Statement[]): string {
    return statements
      .map((s) => `【${s.role}】${s.content}`)
      .join("\n\n");
  }
}
