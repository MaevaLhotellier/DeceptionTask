/**
 * Orchestrator component for Sender-Receiver stage.
 * Manages state, timers, and network calls; delegates rendering to subcomponents.
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {core} from '../../../core/core';
import {CountdownTimer} from '../../../shared/countdown.utils';
import {CohortService} from '../../../services/cohort.service';
import {ParticipantService} from '../../../services/participant.service';
import {ParticipantAnswerService} from '../../../services/participant.answer';

import {
  SenderReceiverStageConfig,
  SenderReceiverRoundData,
  SenderReceiverStagePublicData,
  SenderReceiverStageParticipantAnswer,
  SurveyQuestionKind,
  StageKind,
} from '@deliberation-lab/utils';

import {styles} from './sender_receiver_participant_view.scss';
import {getLabelsFromConfig} from './sr_types';

// Import subcomponents
import './sr_attention_check';
import './sr_sender_panel';
import './sr_receiver_panel';
import './sr_waiting_screens';
import './sr_tutorial_overlap';

@customElement('sender-receiver-participant-view')
export class SenderReceiverParticipantView extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];
  private readonly participantService = core.getService(ParticipantService);
  private readonly cohortService = core.getService(CohortService);
  private readonly participantAnswerService = core.getService(
    ParticipantAnswerService,
  );

  // Track last submitted option and message
  private lastSubmittedOption: 'A' | 'B' | null = null;
  private lastSubmittedMessage: string = '';
  private lastStatusForDefaults: string = '';

  @property() stage: SenderReceiverStageConfig | null = null;
  @property() answer: SenderReceiverStageParticipantAnswer | null = null;

  // Loading states
  @state() isSignalingLoading = false;
  @state() isDecidingLoading = false;
  @state() isNextRoundLoading = false;

  // Input states
  @state() chatMessageA = '';
  @state() selectedOption: 'A' | 'B' | null = null;

  // Local confirmation state (for timer logic)
  @state() hasConfirmedChoice = false;
  @state() isUserTyping = false;
  @state() isContinueMode = false;

  // Lifecycle states
  @state() hasReadInstructions = false;
  @state() hasAttemptedAutoJoin = false;
  @state() detectedPreviousRole: 'sender' | 'receiver' | null = null;

  // Timer states
  @state() countdownRemaining: number = 0;
  private countdownTimer: CountdownTimer | null = null;

  @state() private highlightIndex = -1; //-1 means tutorial not active

  @state() private isTutorialGlobalDone = false;
  @state() private isTutorialCurrentStatusDone = false;

  @state() private isProgressingToNextStage = false;
  // Update trackers
  private decisionClickTimestamp: number | null = null;
  private textboxFocusTimestamp: number | null = null;
  private buttonSelectionTimestamp: number | null = null;
  private lastRoundForTimer: number = 0;
  private lastStatusForTimer: string = '';
  private lastRoundForDefaults: number = 0;
  private lastRoundForSawMessage: number = 0;
  private lastRoundForPageRender: number = 0;
  private lastStatusForPageRender: string = '';
  private pageRenderTimestamp: number = 0;
  private accumulatedActiveMs: number = 0;
  private attentionCheckReactionTimeMs: number = 0;
  private lastStageId: string = '';

  // Attention check
  @state() private showCustomAttentionCheck = false;
  @state() private hasTriggeredCheckInThisRound = false;

  // Inactivity detection: 2-min silence in SHOW_FEEDBACK → triggerInactivityCheck
  private hasStartedInactivityTimerThisRound = false;
  private _inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.cleanupTimers();
  }

  private cleanupTimers() {
    this.countdownTimer?.stop();
    if (this._inactivityTimer !== null) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  }

  private handleVisibilityChange = () => {
    if (!document.hidden) {
      this.lastRoundForTimer = 0;
      this.lastStatusForTimer = '';
      this.requestUpdate();
    }
  };

  private handleBeforeUnload = () => {
    const storageKey = this.getActiveTimeStorageKey();
    if (storageKey && this.pageRenderTimestamp > 0) {
      const totalMs =
        this.accumulatedActiveMs + (Date.now() - this.pageRenderTimestamp);
      sessionStorage.setItem(storageKey, String(totalMs));
    }
  };

  private playEffect(path: string) {
    const audio = new Audio(path);
    audio.play().catch((e) => console.warn('Audio blocked by browser', e));
  }

  private getActiveTimeStorageKey(): string | null {
    const publicData = this.cohortService.stagePublicDataMap[
      this.stage?.id ?? ''
    ] as SenderReceiverStagePublicData;
    if (!publicData) return null;
    const myId = this.participantService.profile?.publicId;
    const role = publicData.senderId === myId ? 'sender' : 'receiver';
    return `sr-active-${this.stage?.id}-${publicData.currentRound}-${role}-${myId}`;
  }

  protected override updated() {
    if (this.stage && this.participantService.profile) {
      this.detectPreviousRole();
      this.maybeInitCountdownAndDefaults();
    }

    if (!this.hasAttemptedAutoJoin && this.stage && !this.isSignalingLoading) {
      this.checkCurrentStageAutoJoin();
    }
  }

  // --- Initialization Logic ---

  private maybeInitCountdownAndDefaults() {
    if (this.stage!.id !== this.lastStageId) {
      this.lastStageId = this.stage!.id;
      this.lastRoundForDefaults = 0;
      this.lastStatusForDefaults = '';
      this.lastRoundForTimer = 0;
      this.lastStatusForTimer = '';
      this.lastRoundForPageRender = 0;
      this.lastStatusForPageRender = '';
      this.lastRoundForSawMessage = 0;
      this.pageRenderTimestamp = 0;
      this.accumulatedActiveMs = 0;
      this.hasReadInstructions =
        sessionStorage.getItem(`sr-instructions-read-${this.stage?.id}`) ===
        'true';
      this.isProgressingToNextStage =
        sessionStorage.getItem(
          `sr-progressed-${this.stage?.id}-${this.participantService.profile?.publicId}`,
        ) === 'true';
      this.isTutorialGlobalDone =
        sessionStorage.getItem(`sr-tutorial-done-${this.stage!.id}`) === 'true';
      this.isTutorialCurrentStatusDone = this.isTutorialGlobalDone;
    }

    const publicData = this.cohortService.stagePublicDataMap[
      this.stage!.id
    ] as SenderReceiverStagePublicData;
    if (!publicData) return;

    const round = publicData.roundMap[publicData.currentRound];
    if (!round) return;

    const myId = this.participantService.profile?.publicId;
    const isSender = publicData.senderId === myId;
    const isReceiver = publicData.receiverId === myId;

    const isMyTurn =
      (isSender && round.status === 'WAITING_SENDER_DECIDE') ||
      (isReceiver && round.status === 'WAITING_RECEIVER_DECIDE');

    const isPartnersTurn =
      (isSender && round.status === 'WAITING_RECEIVER_DECIDE') ||
      (isReceiver && round.status === 'WAITING_SENDER_DECIDE');

    // Timer Init
    const timerKey = `${publicData.currentRound}-${round.status}`;
    if (
      (isMyTurn || isPartnersTurn) &&
      !this.isDecidingLoading &&
      timerKey !== `${this.lastRoundForTimer}-${this.lastStatusForTimer}`
    ) {
      this.lastRoundForTimer = publicData.currentRound;
      this.lastStatusForTimer = round.status;
      this.initCountdownForRound(round, isSender, publicData);
    }

    // Stop invalid timers
    if (!isMyTurn && this.countdownTimer?.isRunning()) {
      this.countdownTimer.stop();
    }

    // Page Render Timestamp
    const pageRenderKey = `${publicData.currentRound}-${round.status}`;
    if (
      isMyTurn &&
      pageRenderKey !==
        `${this.lastRoundForPageRender}-${this.lastStatusForPageRender}`
    ) {
      this.lastRoundForPageRender = publicData.currentRound;
      this.lastStatusForPageRender = round.status;
      this.pageRenderTimestamp = Date.now();
      // Restore accumulated active time from sessionStorage (survives refresh)
      const storageKey = this.getActiveTimeStorageKey();
      this.accumulatedActiveMs = storageKey
        ? parseFloat(sessionStorage.getItem(storageKey) ?? '0')
        : 0;
    }

    // Record "Receiver Saw Message"
    if (
      isReceiver &&
      round.status === 'WAITING_RECEIVER_DECIDE' &&
      !round.receiverSawMessageTime &&
      publicData.currentRound !== this.lastRoundForSawMessage
    ) {
      this.lastRoundForSawMessage = publicData.currentRound;
      this.recordReceiverSawMessage();
    }

    // Reset Defaults on New Round
    if (
      publicData.currentRound !== this.lastRoundForDefaults ||
      round.status !== this.lastStatusForDefaults
    ) {
      const statusChanged = round.status !== this.lastStatusForDefaults;

      this.lastRoundForDefaults = publicData.currentRound;
      this.lastStatusForDefaults = round.status;
      this.selectedOption = null;
      this.chatMessageA = '';
      this.hasConfirmedChoice = false;
      this.decisionClickTimestamp = null;
      this.textboxFocusTimestamp = null;
      this.buttonSelectionTimestamp = null;
      this.isUserTyping = false;
      this.isContinueMode = false;
      this.hasTriggeredCheckInThisRound = false;
      this.attentionCheckReactionTimeMs = 0;
      this.isNextRoundLoading = false;
      this.hasStartedInactivityTimerThisRound = false;
      if (this._inactivityTimer !== null) {
        clearTimeout(this._inactivityTimer);
        this._inactivityTimer = null;
      }

      if (statusChanged && !this.isTutorialGlobalDone) {
        this.isTutorialCurrentStatusDone = false;
      }

      if (this.isTutorialGlobalDone) {
        this.highlightIndex = -1;
      }
    }
    // Attention check on configured rounds
    const checkRounds = this.stage?.attentionCheckRounds ?? [];
    if (
      checkRounds.includes(publicData.currentRound) &&
      round.status === 'SHOW_FEEDBACK' &&
      !this.hasTriggeredCheckInThisRound
    ) {
      this.showCustomAttentionCheck = true;
      this.hasTriggeredCheckInThisRound = true;
    }

    // Inactivity detection: if participant hasn't clicked Continue after 2 min
    // in SHOW_FEEDBACK, trigger a system attention check. The popup will
    // auto-boot after another 2 min of no response.
    const myReadyNext = isSender
      ? !!round.senderReadyNext
      : !!round.receiverReadyNext;
    if (
      round.status === 'SHOW_FEEDBACK' &&
      !myReadyNext &&
      !this.hasStartedInactivityTimerThisRound
    ) {
      this.hasStartedInactivityTimerThisRound = true;
      this._inactivityTimer = setTimeout(async () => {
        this._inactivityTimer = null;
        await this.participantService.triggerInactivityCheck();
      }, 120_000);
    }
  }

  private initCountdownForRound(
    round: SenderReceiverRoundData,
    isSender: boolean,
    publicData: SenderReceiverStagePublicData,
  ) {
    this.cleanupTimers();
    this.countdownRemaining = 0;

    const senderTimeLimit = this.stage?.senderTimeLimitInSeconds ?? 0;
    const receiverTimeLimit = this.stage?.receiverTimeLimitInSeconds ?? 0;
    const myTimeLimit = isSender ? senderTimeLimit : receiverTimeLimit;

    const isMyTurn =
      (isSender && round.status === 'WAITING_SENDER_DECIDE') ||
      (!isSender && round.status === 'WAITING_RECEIVER_DECIDE');

    if (isMyTurn && myTimeLimit && myTimeLimit > 0) {
      const startTimestamp = isSender
        ? round.senderUnlockedTime
        : round.receiverUnlockedTime;
      if (startTimestamp) {
        const role = isSender ? 'sender' : 'receiver';
        const myId = this.participantService.profile?.publicId ?? 'unknown';
        const timerCacheKey = `sr-timer-start-${this.stage!.id}-${publicData.currentRound}-${role}-${myId}`;
        let clientStartMs = parseFloat(
          sessionStorage.getItem(timerCacheKey) ?? '0',
        );
        if (!clientStartMs) {
          clientStartMs = Date.now();
          sessionStorage.setItem(timerCacheKey, String(clientStartMs));
        }
        const elapsedSeconds = (Date.now() - clientStartMs) / 1000;
        const remainingSeconds = Math.min(
          myTimeLimit,
          Math.max(0, myTimeLimit - elapsedSeconds),
        );

        if (remainingSeconds <= 0) {
          this.handleTimeoutSubmit(isSender);
          return;
        }

        this.countdownRemaining = Math.ceil(remainingSeconds);
        this.countdownTimer = new CountdownTimer({
          durationSeconds: Math.ceil(remainingSeconds),
          onTick: (remaining) => {
            this.countdownRemaining = remaining;
          },
          onComplete: () => {
            this.handleTimeoutSubmit(isSender);
          },
        });
        this.countdownTimer.start();
      }
    }
  }

  // --- Interaction Logic ---

  private isSenderRole(): boolean {
    const myId = this.participantService.profile?.publicId;
    const publicData = this.cohortService.stagePublicDataMap[
      this.stage!.id
    ] as SenderReceiverStagePublicData;
    return publicData?.senderId === myId;
  }

  // Returns the configured default sender choice, falling back to 'A'.
  private getDefaultSenderChoice(): 'A' | 'B' {
    if (this.stage?.defaultSenderChoice === 'recommend_A') return 'A';
    if (this.stage?.defaultSenderChoice === 'recommend_B') return 'B';
    return 'A';
  }

  private handleConfirmChoice() {
    if (!this.stage) return;
    if (this.stage.allowButtonPress && !this.selectedOption) return;

    this.decisionClickTimestamp = Date.now();
    this.hasConfirmedChoice = true;
    this.lastSubmittedOption = this.selectedOption;
    this.lastSubmittedMessage = this.chatMessageA;

    const isSender = this.isSenderRole();

    // Receiver submits immediately after confirming a choice.
    if (!isSender) {
      this.countdownTimer?.stop();
      this.countdownRemaining = 0;
      const choice = this.lastSubmittedOption ?? this.selectedOption ?? 'A';
      this.handleReceiverChoice(choice, false);
      return;
    }

    const limit = isSender
      ? (this.stage.senderTimeLimitInSeconds ?? 0)
      : (this.stage.receiverTimeLimitInSeconds ?? 0);

    if (limit <= 0 || this.countdownRemaining === 0) {
      this.handleTimeoutSubmit(isSender);
    }
  }

  private handleTimeoutSubmit(isSender: boolean) {
    if (!this.stage || this.isDecidingLoading) return;

    if (
      isSender &&
      this.stage.allowTextMessage &&
      this.isUserTyping &&
      !this.hasConfirmedChoice
    ) {
      this.countdownRemaining = 0;
      return;
    }

    if (isSender) {
      const publicData = this.cohortService.stagePublicDataMap[
        this.stage.id
      ] as SenderReceiverStagePublicData;
      const round = publicData?.roundMap[publicData.currentRound];
      const sysChoice =
        round?.systemRecommendation ?? this.getDefaultSenderChoice();
      const sysMessage = round?.systemRecommendationMessage || '';

      const choice = this.hasConfirmedChoice
        ? (this.lastSubmittedOption ?? this.getDefaultSenderChoice())
        : sysChoice;
      const message = this.hasConfirmedChoice
        ? this.lastSubmittedMessage
        : sysMessage;

      this.handleSenderSignalWithText(
        choice,
        message,
        !this.hasConfirmedChoice,
        !this.hasConfirmedChoice,
        !this.hasConfirmedChoice ? this.chatMessageA || undefined : undefined,
        this.selectedOption ?? undefined,
      );
    } else {
      const choice = this.hasConfirmedChoice
        ? (this.lastSubmittedOption ?? this.selectedOption ?? 'A')
        : Math.random() < 0.5
          ? 'A'
          : 'B';
      this.handleReceiverChoice(choice, !this.hasConfirmedChoice);
    }
  }

  // --- Render ---

  override render() {
    if (!this.stage) return html`<div>Loading content...</div>`;

    const publicData = this.cohortService.stagePublicDataMap[this.stage.id];
    if (!publicData || publicData.kind !== StageKind.SENDER_RECEIVER) {
      return html`<div>Loading public data...</div>`;
    }

    const myId = this.participantService.profile?.publicId;
    if (!myId) return html`<div>Loading authentication...</div>`;

    const isSender = myId === publicData.senderId;
    const isReceiver = myId === publicData.receiverId;
    const labels = getLabelsFromConfig(this.stage);

    // 1. Role assignment
    if (!isSender && !isReceiver) {
      const roleLabel = this.detectedPreviousRole
        ? this.detectedPreviousRole === 'sender'
          ? labels.senderLabel
          : labels.receiverLabel
        : null;
      return html`
        <sr-role-assignment
          .isLoading=${this.isSignalingLoading}
          .roleLabel=${roleLabel}
          @sr-join-game=${() =>
            this.assignedRole(
              publicData as SenderReceiverStagePublicData,
              myId,
              this.detectedPreviousRole ?? undefined,
            )}
        ></sr-role-assignment>
      `;
    }

    // 2. Instructions
    if (!this.hasReadInstructions) {
      const roleLabel = isSender ? labels.senderLabel : labels.receiverLabel;
      const content = isSender
        ? this.stage.senderInstructionDetail
        : this.stage.receiverInstructionDetail;
      return html`
        <sr-instruction-screen
          .isSender=${isSender}
          .roleLabel=${roleLabel}
          .instructionContent=${content}
          @sr-instructions-read=${() => {
            this.hasReadInstructions = true;
            sessionStorage.setItem(
              `sr-instructions-read-${this.stage?.id}`,
              'true',
            );
          }}
        ></sr-instruction-screen>
      `;
    }

    // 3. Stage completion
    const srPublicData = publicData as SenderReceiverStagePublicData;
    const roundNumber = srPublicData.currentRound ?? 1;
    if (roundNumber > this.stage.numRounds) {
      return html`
        <sr-stage-finished
          .isLoading=${this.isProgressingToNextStage}
          @sr-next-step=${async () => {
            if (this.isProgressingToNextStage) return;
            this.isProgressingToNextStage = true;
            sessionStorage.setItem(
              `sr-progressed-${this.stage?.id}-${this.participantService.profile?.publicId}`,
              'true',
            );
            try {
              await this.participantService.progressToNextStage();
            } catch (e) {
              console.error(e);
              this.isProgressingToNextStage = false;
              sessionStorage.removeItem(
                `sr-progressed-${this.stage?.id}-${this.participantService.profile?.publicId}`,
              );
            }
          }}
        ></sr-stage-finished>
      `;
    }

    // 4. Game panels
    const round = srPublicData.roundMap[roundNumber];
    const roundStatus = round?.status ?? 'WAITING_BOTH_START';
    const roundInfo = {
      currentRound: roundNumber,
      totalRounds: this.stage.numRounds,
    };

    // isTutorialMode: controls the interact-disabled mask on game panels
    // mask is lifted only after user completes the tutorial for the CURRENT gameStatus
    const isTutorialStage =
      this.stage.name.toLowerCase().includes('tutorial') && roundNumber === 1;
    const isTutorialMode = isTutorialStage && !this.isTutorialCurrentStatusDone;
    console.log('[Tutorial]', {
      stageName: this.stage.name,
      roundNumber,
      roundStatus,
      isTutorialStage,
      isTutorialCurrentStatusDone: this.isTutorialCurrentStatusDone,
      isTutorialGlobalDone: this.isTutorialGlobalDone,
      isTutorialMode,
    });

    return html`
      <div
        class="${isTutorialStage ? 'tutorial-layout' : ''}"
        style="width: 100%;"
      >
        <div class="tutorial-main-content">
          <sr-attention-check
            .show=${this.showCustomAttentionCheck}
            @sr-attention-confirmed=${(e: CustomEvent) => {
              this.attentionCheckReactionTimeMs = e.detail.reactionTimeMs;
              this.showCustomAttentionCheck = false;
            }}
          ></sr-attention-check>
          ${roundStatus === 'WAITING_BOTH_START'
            ? html`
                <sr-waiting-both-start
                  .round=${round ?? {
                    senderReadyStart: false,
                    receiverReadyStart: false,
                  }}
                  .isSender=${isSender}
                  .roleLabel=${isSender
                    ? labels.senderLabel
                    : labels.receiverLabel}
                  .isLoading=${this.isSignalingLoading}
                  .canStart=${!!(
                    srPublicData.senderId && srPublicData.receiverId
                  )}
                  @sr-start-game=${() => this.handleStartGame()}
                ></sr-waiting-both-start>
              `
            : isSender
              ? html`
                  <sr-sender-panel
                    .stage=${this.stage}
                    .round=${round}
                    .labels=${labels}
                    .roundInfo=${roundInfo}
                    .selectedOption=${this.selectedOption}
                    .hasConfirmedChoice=${this.hasConfirmedChoice}
                    .chatMessage=${this.chatMessageA}
                    .countdownRemaining=${this.countdownRemaining}
                    .isDecidingLoading=${this.isDecidingLoading}
                    .isContinueMode=${this.isContinueMode}
                    .showPayoffFeedback=${!!this.stage.showPayoffFeedback}
                    .cumulativePayoff=${this.getCumulativePayoff(true)}
                    .amIReadyNext=${!!round.senderReadyNext}
                    .highlightIndex=${this.highlightIndex}
                    .isTutorialMode=${isTutorialMode}
                    .isTutorialStage=${isTutorialStage}
                    @sr-select-option=${(e: CustomEvent) => {
                      if (!this.hasConfirmedChoice) {
                        this.selectedOption = e.detail.option;
                        if (this.buttonSelectionTimestamp === null) {
                          this.buttonSelectionTimestamp = Date.now();
                        }
                      }
                    }}
                    @sr-typing=${(e: CustomEvent) =>
                      this.handleTyping(e.detail.value)}
                    @sr-textbox-focused=${() => this.handleTextboxFocused()}
                    @sr-confirm-choice=${() => this.handleConfirmChoice()}
                    @sr-next-round=${() => this.handleNextRound()}
                    @sr-auto-advance=${() =>
                      setTimeout(() => this.handleNextRound(), 0)}
                  ></sr-sender-panel>
                `
              : html`
                  <sr-receiver-panel
                    .stage=${this.stage}
                    .round=${round}
                    .labels=${labels}
                    .roundInfo=${roundInfo}
                    .selectedOption=${this.selectedOption}
                    .hasConfirmedChoice=${this.hasConfirmedChoice}
                    .countdownRemaining=${this.countdownRemaining}
                    .isDecidingLoading=${this.isDecidingLoading}
                    .showPayoffFeedback=${!!this.stage.showPayoffFeedback}
                    .cumulativePayoff=${this.getCumulativePayoff(false)}
                    .amIReadyNext=${!!round.receiverReadyNext}
                    .highlightIndex=${this.highlightIndex}
                    .isTutorialMode=${isTutorialMode}
                    .isTutorialStage=${isTutorialStage}
                    @sr-receiver-choice=${(e: CustomEvent) => {
                      this.selectedOption = e.detail.choice;
                      this.handleConfirmChoice();
                    }}
                    @sr-next-round=${() => this.handleNextRound()}
                    @sr-auto-advance=${() =>
                      setTimeout(() => this.handleNextRound(), 0)}
                  ></sr-receiver-panel>
                `}
        </div>
        ${isTutorialStage
          ? html`
              <sr-tutorial-overlay
                .role=${isSender ? 'sender' : 'receiver'}
                .stage=${this.stage}
                .gameStatus=${roundStatus}
                .trueState=${round.trueState}
                .isFinished=${this.isTutorialGlobalDone}
                @tutorial-step-changed=${(e: CustomEvent) => {
                  console.log(
                    '[Parent] tutorial-step-changed received',
                    e.detail.step,
                  );
                  this.highlightIndex = e.detail.step;
                }}
                @tutorial-finished=${() => {
                  this.isTutorialCurrentStatusDone = true;
                  if (roundStatus === 'SHOW_FEEDBACK') {
                    this.isTutorialGlobalDone = true;
                    sessionStorage.setItem(
                      `sr-tutorial-done-${this.stage?.id}`,
                      'true',
                    );
                  }
                  this.highlightIndex = -1;
                }}
              ></sr-tutorial-overlay>
            `
          : nothing}
      </div>
    `;
  }

  // --- Helpers ---

  private getActiveTimeSeconds(): number {
    if (this.pageRenderTimestamp === 0) return 0;
    const endTime = this.decisionClickTimestamp || Date.now();
    return (
      (this.accumulatedActiveMs + endTime - this.pageRenderTimestamp) / 1000
    );
  }

  /** Time from page render to first textbox focus (seconds). Null if never focused. */
  private getTextboxFocusReactionSeconds(): number | null {
    if (this.pageRenderTimestamp === 0 || this.textboxFocusTimestamp === null) {
      return null;
    }
    return (
      (this.accumulatedActiveMs +
        this.textboxFocusTimestamp -
        this.pageRenderTimestamp) /
      1000
    );
  }

  /** Time from page render to last A/B button selection (seconds). Null if never selected. */
  private getButtonSelectionReactionSeconds(): number | null {
    if (
      this.pageRenderTimestamp === 0 ||
      this.buttonSelectionTimestamp === null
    ) {
      return null;
    }
    return (
      (this.accumulatedActiveMs +
        this.buttonSelectionTimestamp -
        this.pageRenderTimestamp) /
      1000
    );
  }

  private getCumulativePayoff(isSender: boolean): number {
    const publicData = this.cohortService.stagePublicDataMap[
      this.stage!.id
    ] as SenderReceiverStagePublicData;
    if (!publicData?.roundMap) return 0;
    return Object.values(publicData.roundMap).reduce(
      (acc, r) =>
        acc + (Number(isSender ? r.senderPayoff : r.receiverPayoff) || 0),
      0,
    );
  }

  private detectPreviousRole() {
    const myId = this.participantService.profile?.publicId;
    if (!myId) return;
    let foundRole: 'sender' | 'receiver' | null = null;
    for (const [sId, sData] of Object.entries(
      this.cohortService.stagePublicDataMap,
    )) {
      if (sId === this.stage!.id) continue;
      if (sData.kind !== StageKind.SENDER_RECEIVER) continue;
      const srData = sData as SenderReceiverStagePublicData;
      if (srData.senderId === myId) foundRole = 'sender';
      if (srData.receiverId === myId) foundRole = 'receiver';
    }
    const currentPublic = this.cohortService.stagePublicDataMap[
      this.stage!.id
    ] as SenderReceiverStagePublicData;
    if (currentPublic) {
      if (
        foundRole === 'sender' &&
        currentPublic.senderId &&
        currentPublic.senderId !== myId
      )
        foundRole = null;
      if (
        foundRole === 'receiver' &&
        currentPublic.receiverId &&
        currentPublic.receiverId !== myId
      )
        foundRole = null;
    }
    if (this.detectedPreviousRole !== foundRole)
      this.detectedPreviousRole = foundRole;
  }

  private checkCurrentStageAutoJoin() {
    const publicData = this.cohortService.stagePublicDataMap[this.stage!.id] as
      | SenderReceiverStagePublicData
      | undefined;
    const myId = this.participantService.profile?.publicId;
    if (!publicData || !myId) return;
    if (publicData.senderId === myId || publicData.receiverId === myId) {
      this.hasAttemptedAutoJoin = true;
      return;
    }
    if (publicData.senderId && publicData.receiverId) {
      this.hasAttemptedAutoJoin = true;
      return;
    }
    this.hasAttemptedAutoJoin = true;
  }

  // --- Network ---

  private async assignedRole(
    publicData: SenderReceiverStagePublicData,
    myId: string,
    requestedRole?: 'sender' | 'receiver',
  ) {
    if (this.isSignalingLoading) return;
    this.isSignalingLoading = true;
    try {
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'assign_role',
        payload: {participantId: myId, requestedRole},
      });
    } catch (e) {
      console.error('[View] Failed to assign role:', e);
    } finally {
      this.isSignalingLoading = false;
    }
  }

  private async handleStartGame() {
    if (this.isSignalingLoading) return;
    this.isSignalingLoading = true;
    try {
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'start_game',
        payload: {participantId: this.participantService.profile?.publicId},
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.isSignalingLoading = false;
    }
  }

  private async handleSenderSignalWithText(
    label: 'A' | 'B' | null,
    message: string,
    isTimedOut: boolean,
    isSystemMessage = false,
    senderDraftMessage?: string,
    senderDraftChoice?: 'A' | 'B',
  ) {
    if (this.isDecidingLoading) return;
    this.isDecidingLoading = true;
    try {
      const textboxFocusReactionSeconds = this.getTextboxFocusReactionSeconds();
      const buttonSelectionReactionSeconds =
        this.getButtonSelectionReactionSeconds();
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'sender_signal',
        payload: {
          senderChoice: label,
          senderMessage:
            isSystemMessage || this.stage?.allowTextMessage
              ? message
              : undefined,
          participantId: this.participantService.profile?.publicId,
          activeTimeSeconds: this.getActiveTimeSeconds(),
          isTimedOut,
          senderDraftMessage: senderDraftMessage ?? undefined,
          senderDraftChoice: senderDraftChoice ?? undefined,
          textboxFocusReactionSeconds: textboxFocusReactionSeconds ?? undefined,
          buttonSelectionReactionSeconds:
            buttonSelectionReactionSeconds ?? undefined,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.isDecidingLoading = false;
    }
  }

  private async handleReceiverChoice(choice: 'A' | 'B', isTimedOut: boolean) {
    if (this.isDecidingLoading) return;
    this.isDecidingLoading = true;
    try {
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'receiver_choice',
        payload: {
          receiverChoice: choice,
          participantId: this.participantService.profile?.publicId,
          activeTimeSeconds: this.getActiveTimeSeconds(),
          isTimedOut,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.isDecidingLoading = false;
    }
  }

  private async recordReceiverSawMessage() {
    try {
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'receiver_saw_message',
        payload: {participantId: this.participantService.profile?.publicId},
      });
    } catch (e) {
      console.error(e);
    }
  }

  private async handleNextRound() {
    if (this.isNextRoundLoading) return;
    this.isNextRoundLoading = true;
    try {
      this.cleanupTimers();
      await this.participantService.submitSenderReceiverAction({
        stageId: this.stage!.id,
        action: 'next_round',
        payload: {
          participantId: this.participantService.profile?.publicId,
          attentionCheckReactionTimeMs:
            this.attentionCheckReactionTimeMs > 0
              ? this.attentionCheckReactionTimeMs
              : undefined,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.isNextRoundLoading = false;
    }
  }

  private handleTyping(value: string) {
    this.chatMessageA = value;
    if (value.length > 0) {
      this.isUserTyping = true;
    }
  }

  private handleTextboxFocused() {
    if (this.textboxFocusTimestamp === null) {
      this.textboxFocusTimestamp = Date.now();
    }
  }
}
