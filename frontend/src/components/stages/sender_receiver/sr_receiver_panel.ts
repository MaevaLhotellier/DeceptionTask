/**
 * Receiver panel component for Sender-Receiver stage.
 * Handles receiver's view across all round statuses.
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';

import {
  SenderReceiverStageConfig,
  SenderReceiverRoundData,
  playNotificationSound,
} from '@deliberation-lab/utils';
import {formatTime} from '../../../shared/countdown.utils';
import {styles} from './sr_panel_shared.scss';
import {
  LabelConfig,
  RoundInfo,
  getOptionAPayoff,
  getOptionBPayoff,
} from './sr_types';

// Import child components
import './sr_payoff_display';
import './sr_chat_window';
import './sr_feedback_panel';

@customElement('sr-receiver-panel')
export class SrReceiverPanel extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) stage!: SenderReceiverStageConfig;
  @property({attribute: false}) round!: SenderReceiverRoundData;
  @property({attribute: false}) labels!: LabelConfig;
  @property({attribute: false}) roundInfo!: RoundInfo;
  @property() selectedOption: 'A' | 'B' | null = null;
  @property({type: Boolean}) hasConfirmedChoice = false;
  @property({type: Number}) countdownRemaining = 0;
  @property({type: Boolean}) isDecidingLoading = false;
  @property({type: Boolean}) showPayoffFeedback = false;
  @property({type: Number}) cumulativePayoff = 0;
  @property({type: Boolean}) amIReadyNext = false;
  @property({type: Number}) highlightIndex = -1;
  @property({type: Boolean}) isTutorialMode = false;
  @property({type: Boolean}) isTutorialStage = false;
  private _autoAdvanceFiredForRound = -1;
  private _soundFiredForRound = -1;

  override updated() {
    if (
      this.round?.status === 'SHOW_FEEDBACK' &&
      !this.showPayoffFeedback &&
      !this.isTutorialMode
    ) {
      const currentRound = this.roundInfo?.currentRound ?? 0;
      if (currentRound > 0 && this._autoAdvanceFiredForRound !== currentRound) {
        this._autoAdvanceFiredForRound = currentRound;
        this.dispatchEvent(
          new CustomEvent('sr-auto-advance', {bubbles: true, composed: true}),
        );
      }
    }
    if (
      this.isTutorialMode &&
      this.round?.status === 'WAITING_RECEIVER_DECIDE'
    ) {
      const currentRound = this.roundInfo?.currentRound ?? 0;
      if (currentRound > 0 && this._soundFiredForRound !== currentRound) {
        this._soundFiredForRound = currentRound;
        playNotificationSound('/sounds/notification.wav');
      }
    }
  }

  override render() {
    switch (this.round.status) {
      case 'WAITING_SENDER_DECIDE':
        return this.renderWaitingView();
      case 'WAITING_RECEIVER_DECIDE':
        return this.renderDecisionView();
      case 'SHOW_FEEDBACK':
        return this.renderFeedbackView();
      default:
        return html`<div>Debug: Unknown status ${this.round.status}</div>`;
    }
  }

  private hlClass(stepIndex: number): string {
    return this.highlightIndex === stepIndex
      ? 'tutorial-highlight active'
      : 'tutorial-highlight';
  }

  private renderWaitingView() {
    if (this.isTutorialStage) {
      return html`
        <div style="width: 100%;">
          <h3 style="text-align:center; margin-bottom: 12px;">
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h3>
          <img
            src="/advisor_example.png"
            alt="What the Advisor sees"
            style="width: 100%; border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant);"
          />
        </div>
      `;
    }

    return html`
      <div class="action-panel">
        <div class="waiting-panel">
          <h3>
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h3>
          <sr-chat-window
            .round=${this.round}
            .isSender=${false}
            .senderLabel=${this.labels.senderLabel}
            .allowTextMessage=${this.stage.allowTextMessage}
            chatMessage=""
            .hasConfirmedChoice=${false}
            .isContinueMode=${false}
            .senderButtonLabel1=${this.stage.senderButtonLabel1 ?? 'Option A'}
            .senderButtonLabel2=${this.stage.senderButtonLabel2 ?? 'Option B'}
          ></sr-chat-window>
          <div class="partner-countdown-display">
            <md-icon>hourglass_top</md-icon>
          </div>
        </div>
      </div>
    `;
  }

  private renderDecisionView() {
    return html`
      <div
        class="action-panel ${this.isTutorialMode ? 'interact-disabled' : ''}"
      >
        <div class="action-panel">
          <h3>
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h3>
          ${this.renderCountdown()}
          <p class="round-context-text">
            After observing <strong>${this.labels.optionBLabel}</strong>, the
            <strong>${this.labels.senderLabel}</strong> sent you a message.
          </p>

          <div class="${this.hlClass(0)}">
            <sr-chat-window
              .round=${this.round}
              .isSender=${false}
              .senderLabel=${this.labels.senderLabel}
              .allowTextMessage=${this.stage.allowTextMessage}
              chatMessage=""
              .hasConfirmedChoice=${false}
              .isContinueMode=${false}
              .senderButtonLabel1=${this.stage.senderButtonLabel1 ?? 'Option A'}
              .senderButtonLabel2=${this.stage.senderButtonLabel2 ?? 'Option B'}
            ></sr-chat-window>
          </div>

          <div class="${this.hlClass(1)}">
            <p class="action-instruction">
              ${this.stage.receiverChoiceInstruction ??
              'Please click on your choice:'}
            </p>
            <div class="cards-row">
              ${this.renderCardColumn('A')} ${this.renderCardColumn('B')}
            </div>
          </div>
          <div class="${this.hlClass(2)}">
            <div class="buttons-row">
              ${this.renderOptionButton('A')} ${this.renderOptionButton('B')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderFeedbackView() {
    if (this.showPayoffFeedback) {
      return html`
        <div
          class="action-panel ${this.isTutorialMode ? 'interact-disabled' : ''}"
        >
          <sr-feedback-panel
            .round=${this.round}
            myRole="receiver"
            .labels=${this.labels}
            .roundInfo=${this.roundInfo}
            .cumulativePayoff=${this.cumulativePayoff}
            .amIReady=${this.amIReadyNext}
            .tutorialStep=${this.highlightIndex}
            @sr-next-round=${this.bubbleEvent}
          ></sr-feedback-panel>
        </div>
      `;
    }
    return html`<div></div>`;
  }

  private renderCountdown() {
    if (this.countdownRemaining <= 0) return nothing;
    const isUrgent = this.countdownRemaining <= 10;
    return html`
      <div class="countdown-display ${isUrgent ? 'urgent' : ''}">
        <md-icon>timer</md-icon>
        <span>${formatTime(this.countdownRemaining)}</span>
      </div>
    `;
  }

  private renderCardColumn(option: 'A' | 'B') {
    const title =
      option === 'A' ? this.labels.optionALabel : this.labels.optionBLabel;
    const payoffData =
      option === 'A'
        ? getOptionAPayoff(this.stage)
        : getOptionBPayoff(this.stage, 1);

    return html`
      <div class="receiver-card-column">
        <sr-payoff-info-card
          .title=${title}
          .payoffData=${payoffData}
          showHighlight="all"
          viewerRole="receiver"
          .labels=${this.labels}
          .state1Label=${option === 'B' ? '🔴 Busy' : ''}
          .state2Label=${option === 'B' ? '🔵 Quiet' : ''}
        ></sr-payoff-info-card>
      </div>
    `;
  }

  private renderOptionButton(option: 'A' | 'B') {
    const btnLabel =
      option === 'A'
        ? (this.stage.receiverButtonLabel1 ?? 'Choose A')
        : (this.stage.receiverButtonLabel2 ?? 'Choose B');

    return html`
      <div class="button-wrapper">
        <md-filled-button
          class="signal-btn"
          @click=${() => this.handleChoice(option)}
          ?disabled=${this.isDecidingLoading || this.hasConfirmedChoice}
        >
          ${this.hasConfirmedChoice && this.selectedOption === option
            ? 'Waiting...'
            : btnLabel}
        </md-filled-button>
      </div>
    `;
  }

  private handleChoice(choice: 'A' | 'B') {
    this.dispatchEvent(
      new CustomEvent('sr-receiver-choice', {
        detail: {choice},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private bubbleEvent(e: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent(e.type, {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}
