import {Type, type Static} from '@sinclair/typebox';
import {StageKind} from './stage';
import {
  StageProgressConfigSchema,
  StageTextConfigSchema,
} from './stage.schemas';

/** Shorthand for strict TypeBox object validation */
const strict = {additionalProperties: false} as const;

/** SenderReceiver stage config validation. */
export const SenderReceiverStageConfigData = Type.Object(
  {
    id: Type.String({minLength: 1}),
    kind: Type.Literal(StageKind.SENDER_RECEIVER),
    name: Type.String({minLength: 1}),
    descriptions: Type.Ref(StageTextConfigSchema),
    progress: Type.Ref(StageProgressConfigSchema),

    // Labels
    ReceiverLabel: Type.String(),
    SenderLabel: Type.String(),
    senderInstructionDetail: Type.String(),
    receiverInstructionDetail: Type.String(),
    senderButtonLabel1: Type.String(),
    senderButtonLabel2: Type.String(),
    receiverButtonLabel1: Type.String(),
    receiverButtonLabel2: Type.String(),
    state1Label: Type.String(),
    state2Label: Type.String(),
    optionALabel: Type.String(),
    optionBLabel: Type.String(),

    // Parameters
    numRounds: Type.Number(),
    state1Probability: Type.Number(),
    allowTextMessage: Type.Boolean(),
    allowButtonPress: Type.Boolean(),
    showPayoffFeedback: Type.Boolean(),
    requireParticipantClick: Type.Boolean(),

    senderTimeLimitInSeconds: Type.Union([Type.Number(), Type.Null()]),
    receiverTimeLimitInSeconds: Type.Union([Type.Number(), Type.Null()]),
    defaultMessageForA: Type.String(),
    defaultMessageForB: Type.String(),
    defaultSenderChoice: Type.Union([
      Type.Literal('recommend_A'),
      Type.Literal('recommend_B'),
      Type.Literal('random'),
    ]),

    // Truthfulness probability feature
    enableTruthfulnessFeature: Type.Boolean(),
    truthfulnessOptions: Type.Array(Type.Number()),
    recommendationTextPrefix: Type.String(),

    // In-panel customizable display text
    trueStatePrefix: Type.String(),
    probabilityDisplayPrefix: Type.String(),
    senderSignalInstruction: Type.String(),
    receiverChoiceInstruction: Type.String(),

    // Attention check
    attentionCheckRounds: Type.Array(Type.Number()),

    // Payoffs
    payoffSenderChoiceA: Type.Number(),
    payoffSenderChoiceB1: Type.Number(),
    payoffSenderChoiceB2: Type.Number(),
    payoffReceiverChoiceA: Type.Number(),
    payoffReceiverChoiceB1: Type.Number(),
    payoffReceiverChoiceB2: Type.Number(),
  },
  {$id: 'SenderReceiverStageConfig', ...strict},
);
