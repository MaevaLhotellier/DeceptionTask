import {Timestamp} from 'firebase-admin/firestore';
import {
  SenderReceiverStagePublicData,
  SenderReceiverRoundData,
  SenderReceiverStageConfig,
  SeededRandom,
  getRoundDefault,
  computeTruthfulnessForRound,
} from '@deliberation-lab/utils';

/**
 * Checks if both roles are assigned and the game hasn't started (Round 1 missing).
 * If so, returns the update object to initialize Round 1.
 */
export function startGameIfReady(
  publicData: SenderReceiverStagePublicData,
  config: SenderReceiverStageConfig,
  stageId: string,
): Record<string, unknown> | null {
  // 1. Check if roles are filled
  if (!publicData.senderId || !publicData.receiverId) {
    return null; // Not ready
  }

  // 2. Check if already started (Round 1 exists)
  if (publicData.roundMap && publicData.roundMap[1]) {
    return null; // Already started
  }

  // 3. Initialize Round 1 with balanced state generation (first round needs WAITING_BOTH_START)
  const pairSeed = getPairSeed(publicData, stageId);
  const firstRound = createNewRound(1, config, pairSeed, true); // isFirstRound = true

  return {
    [`roundMap.1`]: firstRound,
    currentRound: 1,
  };
}

/**
 * Helper to create a new round object with balanced state generation
 * @param roundNumber - The round number (1-indexed)
 * @param config - Stage configuration
 * @param pairSeed - Seed for deterministic random generation
 * @param isFirstRound - Whether this is the first round (needs WAITING_BOTH_START status)
 */
export const SR_TO_ROLE_SURVEY_MAP: Record<
  string,
  {stageId: string; questionId: string}
> = {
  sg_block1: {
    stageId: 'sg_role_survey_1',
    questionId: 'role_question_1',
  },
  sg_block2: {
    stageId: 'sg_role_survey_2',
    questionId: 'role_question_2',
  },
  sg_block3: {
    stageId: 'sg_role_survey_3',
    questionId: 'role_question_3',
  },
};

export const ROLE_SURVEY_TO_SR_MAP: Record<string, string> = {
  sg_role_survey_1: 'sg_block1',
  sg_role_survey_2: 'sg_block2',
  sg_role_survey_3: 'sg_block3',
};
export function createNewRound(
  roundNumber: number,
  config: SenderReceiverStageConfig,
  pairSeed: string,
  isFirstRound: boolean = false,
): SenderReceiverRoundData {
  // Use balanced state generation based on participant pair seed
  const roundDefaults = getRoundDefault(
    roundNumber,
    config.numRounds,
    config.state1Probability ?? 0.5,
    pairSeed,
  );
  const trueState = roundDefaults.trueState;

  // First round starts with WAITING_BOTH_START, subsequent rounds start with WAITING_SENDER_DECIDE
  const initialStatus = isFirstRound
    ? 'WAITING_BOTH_START'
    : 'WAITING_SENDER_DECIDE';

  // Compute truthfulness fields if feature is enabled
  let truthfulnessProbability: number | null = null;
  let isHonestRound: boolean | null = null;
  let systemRecommendation: 'A' | 'B' | null = null;
  let systemRecommendationMessage: string | null = null;

  if (config.enableTruthfulnessFeature) {
    const result = computeTruthfulnessForRound(
      roundNumber,
      trueState,
      config,
      pairSeed,
    );
    truthfulnessProbability = result.truthfulnessProbability;
    isHonestRound = result.isHonestRound;
    systemRecommendation = result.recommendation;
    systemRecommendationMessage = result.recommendationMessage;
  }

  return {
    roundNumber,
    trueState,
    status: initialStatus,

    senderChoice: null,
    senderMessage: null,
    senderDraftMessage: null,
    senderDraftChoice: null,
    receiverChoice: null,
    senderPayoff: null,
    receiverPayoff: null,

    defaultSenderChoice: (() => {
      if (config.defaultSenderChoice === 'recommend_A') return 'A';
      if (config.defaultSenderChoice === 'recommend_B') return 'B';
      const rng = new SeededRandom(`${pairSeed}-sender-default-${roundNumber}`);
      return rng.next() < 0.5 ? 'A' : 'B';
    })() as 'A' | 'B',
    senderTimedOut: false,
    receiverTimedOut: false,

    // Ready to start flags (only used for first round)
    senderReadyStart: false,
    receiverReadyStart: false,

    // Timestamps: startTime and senderUnlockedTime will be set when both players click Start Game
    startTime: isFirstRound ? null : Timestamp.now(),
    senderUnlockedTime: isFirstRound ? null : Timestamp.now(),
    senderSubmittedTime: null,
    receiverSawMessageTime: null,
    receiverUnlockedTime: null,
    receiverSubmittedTime: null,

    senderReactionTimeSeconds: null,
    receiverReactionTimeSeconds: null,
    senderActiveTimeSeconds: null,
    receiverActiveTimeSeconds: null,
    attentionCheckReactionTimeMs: null,
    senderAttentionCheckReactionTimeMs: null,
    receiverAttentionCheckReactionTimeMs: null,

    // Truthfulness probability feature
    truthfulnessProbability,
    isHonestRound,
    systemRecommendation,
    systemRecommendationMessage,
  };
}

/**
 * Calculates payoffs for a round
 */
export function calculatePayoffs(
  receiverChoice: 'A' | 'B' | null,
  trueState: 1 | 2,
  config: SenderReceiverStageConfig,
  senderTimedOut: boolean,
  receiverTimedOut: boolean,
) {
  let senderPayoff = 0;
  let receiverPayoff = 0;

  if (receiverChoice === 'A' || receiverChoice === null) {
    senderPayoff = config.payoffSenderChoiceA;
    receiverPayoff = config.payoffReceiverChoiceA;
  } else {
    if (trueState === 1) {
      senderPayoff = config.payoffSenderChoiceB1;
      receiverPayoff = config.payoffReceiverChoiceB1;
    } else {
      senderPayoff = config.payoffSenderChoiceB2;
      receiverPayoff = config.payoffReceiverChoiceB2;
    }
  }

  if (config.requireParticipantClick) {
    if (senderTimedOut) senderPayoff = 0;
    if (receiverTimedOut) receiverPayoff = 0;
  }

  return {senderPayoff, receiverPayoff};
}

/**
 * Calculates reaction time in seconds between two Firestore timestamps.
 * Returns null if unlockedTime is not available.
 */
export function calculateReactionTime(
  unlockedTime: FirebaseFirestore.Timestamp | null,
  submittedTime: FirebaseFirestore.Timestamp,
): number | null {
  if (!unlockedTime) return null;
  return (submittedTime.toMillis() - unlockedTime.toMillis()) / 1000;
}

/**
 * Constructs the deterministic pair seed used for balanced defaults and truthfulness RNG.
 */
export function getPairSeed(
  publicData: SenderReceiverStagePublicData,
  stageId: string,
): string {
  return `${publicData.senderId}-${publicData.receiverId}-${stageId}`;
}
