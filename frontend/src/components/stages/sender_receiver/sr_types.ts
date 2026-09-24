/**
 * Shared types and helper functions for Sender-Receiver stage components.
 */
import {SenderReceiverStageConfig} from '@deliberation-lab/utils';

// --- Payoff Data Types ---

export interface FixedPayoffData {
  type: 'fixed';
  sender: number | undefined;
  receiver: number | undefined;
}

export interface ConditionalPayoffData {
  type: 'conditional';
  state1Sender: number | undefined;
  state1Receiver: number | undefined;
  state2Sender: number | undefined;
  state2Receiver: number | undefined;
  trueState: 1 | 2;
  state1Label: string;
  state2Label: string;
}

export type PayoffData = FixedPayoffData | ConditionalPayoffData;
export type Role = 'sender' | 'receiver';

// --- Label & Round Config ---

export interface LabelConfig {
  senderLabel: string;
  receiverLabel: string;
  optionALabel: string;
  optionBLabel: string;
  state1Label: string;
  state2Label: string;
  senderButtonLabel1: string;
  senderButtonLabel2: string;
}

export interface RoundInfo {
  currentRound: number;
  totalRounds: number;
}

// --- Helper Functions ---

export function getLabelsFromConfig(
  stage: SenderReceiverStageConfig | null | undefined,
): LabelConfig {
  return {
    senderLabel: stage?.SenderLabel ?? 'Sender',
    receiverLabel: stage?.ReceiverLabel ?? 'Receiver',
    optionALabel: stage?.optionALabel ?? 'Option A',
    optionBLabel: stage?.optionBLabel ?? 'Option B',
    state1Label: stage?.state1Label ?? 'State 1',
    state2Label: stage?.state2Label ?? 'State 2',
    senderButtonLabel1: stage?.senderButtonLabel1 ?? 'Sender Button 1',
    senderButtonLabel2: stage?.senderButtonLabel2 ?? 'Sender Button 2',
  };
}

export function getOptionAPayoff(
  stage: SenderReceiverStageConfig | null | undefined,
): FixedPayoffData {
  return {
    type: 'fixed',
    sender: stage?.payoffSenderChoiceA,
    receiver: stage?.payoffReceiverChoiceA,
  };
}

export function getOptionBPayoff(
  stage: SenderReceiverStageConfig | null | undefined,
  trueState: 1 | 2,
): ConditionalPayoffData {
  const labels = getLabelsFromConfig(stage);
  return {
    type: 'conditional',
    state1Sender: stage?.payoffSenderChoiceB1,
    state1Receiver: stage?.payoffReceiverChoiceB1,
    state2Sender: stage?.payoffSenderChoiceB2,
    state2Receiver: stage?.payoffReceiverChoiceB2,
    trueState,
    state1Label: labels.state1Label,
    state2Label: labels.state2Label,
  };
}
