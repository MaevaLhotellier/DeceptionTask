/**
 * Handle all actions for the Sender-Receiver Stage.
 * role assignment, moves, and round progression.
 */

import {onCall} from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {Timestamp} from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import {
  SenderReceiverStageConfig,
  SenderReceiverStagePublicData,
  SenderReceiverActionData,
  StageKind,
  SurveyQuestionKind,
  StageParticipantAnswer,
  SenderReceiverStageParticipantAnswer,
} from '@deliberation-lab/utils';

import {SR_TO_ROLE_SURVEY_MAP} from './sender_receiver.utils';
interface SenderSignalPayload {
  senderChoice?: 'A' | 'B' | null;
  senderMessage?: string | null;
  senderDraftMessage?: string | null;
  senderDraftChoice?: 'A' | 'B' | null;
  activeTimeSeconds?: number | null;
  isTimedOut?: boolean;
  textboxFocusReactionSeconds?: number | null;
  buttonSelectionReactionSeconds?: number | null;
}

interface ReceiverChoicePayload {
  receiverChoice?: 'A' | 'B' | null;
  activeTimeSeconds?: number | null;
  isTimedOut?: boolean;
}

interface NextRoundPayload {
  attentionCheckReactionTimeMs?: number | null;
}

import {
  getFirestoreStage,
  getFirestoreStagePublicDataRef,
} from '../utils/firestore';

import {
  startGameIfReady,
  calculatePayoffs,
  createNewRound,
  calculateReactionTime,
  getPairSeed,
} from './sender_receiver.utils';

export const submitSenderReceiverAction = onCall<SenderReceiverActionData>(
  {cors: true},
  async (request) => {
    const {
      experimentId,
      cohortId,
      stageId,
      action,
      payload,
      participantPrivateId,
      participantPublicId,
    } = request.data;
    console.log('ids:', {
      participantPrivateId,
      participantPublicId,
      experimentId,
      cohortId,
      stageId,
    });
    let userId = participantPublicId ?? null;

    if (!userId) {
      const privateId = request.auth?.uid;
      if (!privateId) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be logged in.',
        );
      }
      const profileDoc = await admin
        .firestore()
        .collection('experiments')
        .doc(experimentId)
        .collection('participants')
        .doc(privateId)
        .get();
      userId = profileDoc.data()?.publicId;
    }

    if (!userId) {
      throw new functions.https.HttpsError(
        'not-found',
        'Could not resolve publicId.',
      );
    }

    const privateIdForPath = participantPrivateId ?? request.auth?.uid;

    // 1. Fetch Stage Config only for actions that need it
    const configNeeded =
      action !== 'start_game' && action !== 'receiver_saw_message';
    let config: SenderReceiverStageConfig | null = null;
    if (configNeeded) {
      const stage = await getFirestoreStage(experimentId, stageId);
      if (!stage || stage.kind !== StageKind.SENDER_RECEIVER) {
        throw new functions.https.HttpsError(
          'not-found',
          'Stage not found or invalid kind',
        );
      }
      config = stage as SenderReceiverStageConfig;
    }

    // 2. Fetch answerMap (participant's historical private data) for assign_role
    // This replaces the old fetchHistoricalRole logic
    const answerMap: Record<string, StageParticipantAnswer> = {};
    if (action === 'assign_role') {
      const stageDataSnapshot = await admin
        .firestore()
        .collection('experiments')
        .doc(experimentId)
        .collection('participants')
        .doc(privateIdForPath!)
        .collection('stageData')
        .get();

      stageDataSnapshot.docs.forEach((doc) => {
        answerMap[doc.id] = doc.data() as StageParticipantAnswer;
      });
    }

    // 3. Run Transaction
    let roleToSave: 'sender' | 'receiver' | null = null;
    let totalPayoffToSave: number = 0;

    await admin.firestore().runTransaction(async (transaction) => {
      const publicDataRef = getFirestoreStagePublicDataRef(
        experimentId,
        cohortId,
        stageId,
      );
      const publicDoc = await transaction.get(publicDataRef);

      if (!publicDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Public data doc does not exist',
        );
      }

      const currentPublicData =
        publicDoc.data() as SenderReceiverStagePublicData;
      let updates: Record<string, unknown> = {};

      // -- ACTION SWITCH --

      switch (action) {
        case 'assign_role':
          updates = handleAssignRole(
            currentPublicData,
            config!,
            stageId,
            userId,
            answerMap, // Pass the newly fetched answerMap here
            payload?.requestedRole,
          );
          break;

        case 'start_game':
          updates = handleStartGame(currentPublicData, userId);
          break;

        case 'sender_signal':
          updates = handleSenderSignal(
            currentPublicData,
            config!,
            userId,
            payload,
          );
          break;

        case 'receiver_saw_message':
          updates = handleReceiverSawMessage(currentPublicData, userId);
          break;

        case 'receiver_choice':
          updates = handleReceiverChoice(
            currentPublicData,
            config!,
            userId,
            payload,
          );

          // CRITICAL FIX: Save payoff and role on receiver_choice as well.
          // This prevents the "Final Round Trap" where data is lost if the game ends here.
          roleToSave =
            currentPublicData.senderId === userId ? 'sender' : 'receiver';
          totalPayoffToSave = Object.values(currentPublicData.roundMap).reduce(
            (acc, round) => {
              const payoff =
                roleToSave === 'sender'
                  ? Number(round.senderPayoff ?? 0)
                  : Number(round.receiverPayoff ?? 0);
              return acc + payoff;
            },
            0,
          );
          break;

        case 'next_round':
          updates = handleNextRound(
            currentPublicData,
            config!,
            stageId,
            userId,
            payload,
          );
          roleToSave =
            currentPublicData.senderId === userId ? 'sender' : 'receiver';
          totalPayoffToSave = Object.values(currentPublicData.roundMap).reduce(
            (acc, round) => {
              const payoff =
                roleToSave === 'sender'
                  ? Number(round.senderPayoff ?? 0)
                  : Number(round.receiverPayoff ?? 0);
              return acc + payoff;
            },
            0,
          );
          break;

        default:
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Unknown action: ${action}`,
          );
      }
      if (Object.keys(updates).length > 0) {
        transaction.update(publicDataRef, updates);
      }
    });

    if (roleToSave) {
      await admin
        .firestore()
        .collection('experiments')
        .doc(experimentId)
        .collection('participants')
        .doc(privateIdForPath!)
        .collection('stageData')
        .doc(stageId)
        .set(
          {
            id: stageId,
            kind: StageKind.SENDER_RECEIVER,
            role: roleToSave,
            totalPayoff: totalPayoffToSave,
          },
          {merge: true},
        );
      const roleSurvey = SR_TO_ROLE_SURVEY_MAP[stageId];
      if (roleSurvey) {
        await admin
          .firestore()
          .collection('experiments')
          .doc(experimentId)
          .collection('participants')
          .doc(privateIdForPath!)
          .collection('stageData')
          .doc(roleSurvey.stageId)
          .set(
            {
              id: roleSurvey.stageId,
              kind: StageKind.SURVEY,
              answerMap: {
                [roleSurvey.questionId]: {
                  id: roleSurvey.questionId,
                  kind: SurveyQuestionKind.MULTIPLE_CHOICE,
                  choiceId:
                    roleToSave === 'sender'
                      ? 'sender_choice'
                      : 'receiver_choice',
                },
              },
            },
            {merge: true},
          );
      }
    }

    return {success: true};
  },
);
// -- ACTION HANDLERS --
function handleAssignRole(
  currentData: SenderReceiverStagePublicData,
  config: SenderReceiverStageConfig,
  stageId: string,
  userId: string,
  answerMap: Record<string, StageParticipantAnswer> = {}, // participant's private stage answers
  reqRole?: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  // 0. when already has a role, do nothing
  if (currentData.senderId === userId || currentData.receiverId === userId) {
    return updates;
  }

  // 1. find historical role from answerMap (private stage data)
  let historicalRole: 'sender' | 'receiver' | null = null;
  Object.values(answerMap).forEach((answer) => {
    // Only extract role if it is a Sender-Receiver stage and role is defined
    if (
      answer.kind === StageKind.SENDER_RECEIVER &&
      (answer as SenderReceiverStageParticipantAnswer).role
    ) {
      historicalRole = (answer as SenderReceiverStageParticipantAnswer).role;
    }
  });

  // 2. priority: historical role inheritance
  if (historicalRole) {
    // Strictly enforce the historical role; do not allow fallback to the other role
    if (historicalRole === 'sender') {
      if (!currentData.senderId) {
        updates.senderId = userId;
      } else if (currentData.senderId !== userId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Historical role mismatch: Sender slot occupied by another participant.',
        );
      }
    } else if (historicalRole === 'receiver') {
      if (!currentData.receiverId) {
        updates.receiverId = userId;
      } else if (currentData.receiverId !== userId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Historical role mismatch: Receiver slot occupied by another participant.',
        );
      }
    }
  }
  // 3. fallback: requested role (only if no history exists)
  else if (reqRole) {
    if (reqRole === 'sender' && !currentData.senderId)
      updates.senderId = userId;
    else if (reqRole === 'receiver' && !currentData.receiverId)
      updates.receiverId = userId;
    else
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Requested role ${reqRole} is not available.`,
      );
  }
  // 4. fallback: first-come-first-served (only if no history and no reqRole)
  else {
    if (!currentData.senderId) updates.senderId = userId;
    else if (!currentData.receiverId) updates.receiverId = userId;
    else
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Roles are full',
      );
  }

  const simulatedData = {...currentData, ...updates};
  const startUpdates = startGameIfReady(simulatedData, config, stageId);
  if (startUpdates) {
    Object.assign(updates, startUpdates);
  }

  return updates;
}

function handleStartGame(
  currentData: SenderReceiverStagePublicData,
  userId: string,
): Record<string, unknown> {
  const {isSender, isReceiver, roundIndex, roundData} = getPlayerContext(
    currentData,
    userId,
  );

  if (roundData.status !== 'WAITING_BOTH_START') return {};

  const updates: Record<string, unknown> = {};
  let shouldStart = false;

  if (isSender) {
    updates[`roundMap.${roundIndex}.senderReadyStart`] = true;
    if (roundData.receiverReadyStart) shouldStart = true;
  } else if (isReceiver) {
    updates[`roundMap.${roundIndex}.receiverReadyStart`] = true;
    if (roundData.senderReadyStart) shouldStart = true;
  }

  if (shouldStart) {
    const now = Timestamp.now();
    updates[`roundMap.${roundIndex}.status`] = 'WAITING_SENDER_DECIDE';
    updates[`roundMap.${roundIndex}.startTime`] = now;
    updates[`roundMap.${roundIndex}.senderUnlockedTime`] = now;
  }

  return updates;
}

function handleSenderSignal(
  currentData: SenderReceiverStagePublicData,
  config: SenderReceiverStageConfig,
  userId: string,
  payload: SenderSignalPayload = {},
): Record<string, unknown> {
  const {isSender, roundIndex, roundData} = getPlayerContext(
    currentData,
    userId,
  );

  if (!isSender)
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only sender can signal',
    );
  if (roundData.status !== 'WAITING_SENDER_DECIDE') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Not sender turn.`,
    );
  }

  const now = Timestamp.now();
  const serverReactionTime = calculateReactionTime(
    roundData.senderUnlockedTime,
    now,
  );

  // Priority order for senderReactionTimeSeconds:
  // 1. allowTextMessage: frontend-measured time to first textbox focus (excludes typing)
  // 2. allowButtonPress: frontend-measured time to last A/B button selection (excludes confirm delay)
  // 3. fallback: server-side senderSubmittedTime - senderUnlockedTime
  const reactionTime =
    config.allowTextMessage && payload?.textboxFocusReactionSeconds != null
      ? payload.textboxFocusReactionSeconds
      : !config.allowTextMessage &&
          config.allowButtonPress &&
          payload?.buttonSelectionReactionSeconds != null
        ? payload.buttonSelectionReactionSeconds
        : serverReactionTime;

  // senderChoice = actual choice sent to receiver (never null).
  // Payoff zeroing for requireParticipantClick is handled in calculatePayoffs via senderTimedOut.
  const senderChoice: 'A' | 'B' | null = payload?.senderChoice ?? null;
  const senderMessage: string | null = payload?.senderMessage ?? null;

  return {
    [`roundMap.${roundIndex}.senderChoice`]: senderChoice,
    [`roundMap.${roundIndex}.senderMessage`]: senderMessage,
    [`roundMap.${roundIndex}.senderDraftMessage`]:
      payload?.senderDraftMessage ?? null,
    [`roundMap.${roundIndex}.senderDraftChoice`]:
      payload?.senderDraftChoice ?? null,
    [`roundMap.${roundIndex}.senderSubmittedTime`]: now,
    [`roundMap.${roundIndex}.senderReactionTimeSeconds`]: reactionTime,
    [`roundMap.${roundIndex}.senderActiveTimeSeconds`]:
      payload?.activeTimeSeconds ?? null,
    [`roundMap.${roundIndex}.senderTimedOut`]: payload?.isTimedOut ?? false,
    [`roundMap.${roundIndex}.status`]: 'WAITING_RECEIVER_DECIDE',
    [`roundMap.${roundIndex}.receiverUnlockedTime`]: now,
  };
}

function handleReceiverSawMessage(
  currentData: SenderReceiverStagePublicData,
  userId: string,
): Record<string, unknown> {
  const {isReceiver, roundIndex, roundData} = getPlayerContext(
    currentData,
    userId,
  );

  if (
    !isReceiver ||
    roundData.status !== 'WAITING_RECEIVER_DECIDE' ||
    roundData.receiverSawMessageTime
  ) {
    return {};
  }

  return {
    [`roundMap.${roundIndex}.receiverSawMessageTime`]: Timestamp.now(),
  };
}

function handleReceiverChoice(
  currentData: SenderReceiverStagePublicData,
  config: SenderReceiverStageConfig,
  userId: string,
  payload: ReceiverChoicePayload = {},
): Record<string, unknown> {
  const {isReceiver, roundIndex, roundData} = getPlayerContext(
    currentData,
    userId,
  );

  if (!isReceiver)
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only receiver can choose',
    );
  if (roundData.status !== 'WAITING_RECEIVER_DECIDE') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Not receiver turn',
    );
  }

  const receiverChoice = payload?.receiverChoice ?? null;
  const receiverTimedOut = payload?.isTimedOut ?? false;
  const {senderPayoff, receiverPayoff} = calculatePayoffs(
    receiverChoice,
    roundData.trueState,
    config,
    roundData.senderTimedOut ?? false,
    receiverTimedOut,
  );
  const now = Timestamp.now();

  return {
    [`roundMap.${roundIndex}.receiverChoice`]: receiverChoice,
    [`roundMap.${roundIndex}.receiverSubmittedTime`]: now,
    [`roundMap.${roundIndex}.receiverReactionTimeSeconds`]:
      calculateReactionTime(roundData.receiverUnlockedTime, now),
    [`roundMap.${roundIndex}.receiverActiveTimeSeconds`]:
      payload?.activeTimeSeconds ?? null,
    [`roundMap.${roundIndex}.receiverTimedOut`]: payload?.isTimedOut ?? false,
    [`roundMap.${roundIndex}.senderPayoff`]: senderPayoff,
    [`roundMap.${roundIndex}.receiverPayoff`]: receiverPayoff,
    [`roundMap.${roundIndex}.status`]: 'SHOW_FEEDBACK',
  };
}

function handleNextRound(
  currentData: SenderReceiverStagePublicData,
  config: SenderReceiverStageConfig,
  stageId: string,
  userId: string,
  payload: NextRoundPayload = {},
): Record<string, unknown> {
  const {isSender, isReceiver, roundIndex, roundData} = getPlayerContext(
    currentData,
    userId,
  );

  if (roundData.status !== 'SHOW_FEEDBACK') return {};

  const updates: Record<string, unknown> = {};
  let shouldAdvance = false;

  if (isSender) {
    updates[`roundMap.${roundIndex}.senderReadyNext`] = true;
    if (roundData.receiverReadyNext) shouldAdvance = true;
  } else if (isReceiver) {
    updates[`roundMap.${roundIndex}.receiverReadyNext`] = true;
    if (roundData.senderReadyNext) shouldAdvance = true;
  }

  // Store attention check RT per role
  if (payload?.attentionCheckReactionTimeMs != null) {
    if (isSender) {
      updates[`roundMap.${roundIndex}.senderAttentionCheckReactionTimeMs`] =
        payload.attentionCheckReactionTimeMs;
    } else if (isReceiver) {
      updates[`roundMap.${roundIndex}.receiverAttentionCheckReactionTimeMs`] =
        payload.attentionCheckReactionTimeMs;
    }
  }

  if (!shouldAdvance) return updates;

  const nextRoundIndex = roundIndex + 1;
  if (nextRoundIndex > config.numRounds) {
    // Block end
    updates.currentRound = nextRoundIndex;
    return updates;
  }

  if (currentData.roundMap[nextRoundIndex]) {
    return updates;
  }

  const pairSeed = getPairSeed(currentData, stageId);
  const newRoundData = createNewRound(nextRoundIndex, config, pairSeed);

  updates.currentRound = nextRoundIndex;
  updates[`roundMap.${nextRoundIndex}`] = newRoundData;
  return updates;
}

/**
 * Helper function to determine if the user is sender or receiver, and get the current round data. Also handles permission checks for actions.
 */
function getPlayerContext(
  currentData: SenderReceiverStagePublicData,
  userId: string,
) {
  const isSender = currentData.senderId === userId;
  const isReceiver = currentData.receiverId === userId;

  if (!isSender && !isReceiver) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User is not a player in this game',
    );
  }

  const roundIndex = currentData.currentRound;
  const roundData = currentData.roundMap[roundIndex];

  if (!roundData) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Round data not initialized',
    );
  }

  return {isSender, isReceiver, roundIndex, roundData};
}
