/**
 * Sender panel component for Sender-Receiver stage.
 * Handles sender's view across all round statuses.
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import '../../../pair-components/textarea';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
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

@customElement('sr-sender-panel')
export class SrSenderPanel extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) stage!: SenderReceiverStageConfig;
  @property({attribute: false}) round!: SenderReceiverRoundData;
  @property({attribute: false}) labels!: LabelConfig;
  @property({attribute: false}) roundInfo!: RoundInfo;
  @property() selectedOption: 'A' | 'B' | null = null;
  @property({type: Boolean}) hasConfirmedChoice = false;
  @property() chatMessage = '';
  @property({type: Number}) countdownRemaining = 0;
  @property({type: Boolean}) isDecidingLoading = false;
  @property({type: Boolean}) isContinueMode = false;
  @property({type: Boolean}) showPayoffFeedback = false;
  @property({type: Number}) cumulativePayoff = 0;
  @property({type: Boolean}) amIReadyNext = false;
  @property({type: Number}) highlightIndex = -1;
  @property({type: Boolean}) isTutorialMode = false;
  @property({type: Boolean}) isTutorialStage = false;
  // Deduplication guard: track which round we already dispatched auto-advance for.
  private _autoAdvanceFiredForRound = -1;
  private _soundFiredForRound = -1;

  override updated() {
    // Dispatch sr-auto-advance at most once per round when no feedback is shown.
    // Doing this in updated() (not render()) prevents repeated dispatches on
    // every re-render triggered by Firestore snapshot updates.
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
      this.round?.status === 'SHOW_FEEDBACK' &&
      this.showPayoffFeedback
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
        return this.renderDecisionView();
      case 'WAITING_RECEIVER_DECIDE':
        return this.renderWaitingView();
      case 'SHOW_FEEDBACK':
        return this.renderFeedbackView();
      default:
        return html`<div>Debug: Unknown Stage ${this.round.status}</div>`;
    }
  }

  private hlClass(stepIndex: number): string {
    return this.highlightIndex === stepIndex
      ? 'tutorial-highlight active'
      : 'tutorial-highlight';
  }

  private renderDecisionView() {
    const currentStatusLabel =
      this.round.trueState === 1
        ? this.labels.state1Label
        : this.labels.state2Label;

    return html`
      <div
        class="action-panel ${this.isTutorialMode ? 'interact-disabled' : ''}"
      >
        <div class="${this.hlClass(0)}">
          <h3>
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h3>
        </div>

        ${this.renderCountdown()}

        <div class="${this.hlClass(1)}">
          <div class="status-reveal">
            🏠${this.labels.optionBLabel}:
            <strong>${currentStatusLabel}</strong>
          </div>
        </div>

        <div class="${this.hlClass(2)}">
          <div class="cards-row">
            ${this.renderCardColumn('A')} ${this.renderCardColumn('B')}
          </div>
        </div>

        <div class="${this.hlClass(3)}">${this.renderProbabilitySlider()}</div>

        <div class="${this.hlClass(4)}">
          <div class="buttons-row">
            <div class="button-wrapper">
              ${this.renderOptionButton(
                'A',
                this.stage.senderButtonLabel1 ?? 'Recommend A',
                this.selectedOption === 'A',
              )}
            </div>
            <div class="button-wrapper">
              ${this.renderOptionButton(
                'B',
                this.stage.senderButtonLabel2 ?? 'Recommend B',
                this.selectedOption === 'B',
              )}
            </div>
          </div>
        </div>

        ${this.renderTextInput()} ${this.renderSubmitButton()}
      </div>
    `;
  }

  private renderWaitingView() {
    if (this.isTutorialStage) {
      return html`
        <div style="width: 100%;">
          <h3 style="text-align:center; margin-bottom: 12px;">
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h3>
          <img
            src="/vendor_example.png"
            alt="What the Vendor sees"
            style="width: 100%; border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant);"
          />
        </div>
      `;
    }

    return html`
      <div
        class="action-panel ${this.isTutorialMode ? 'interact-disabled' : ''}"
      >
        <div class="waiting-panel">
          <h1>
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
          </h1>
          <div class="partner-countdown-display">
            <md-icon>hourglass_top</md-icon>
          </div>
          <h1>
            <br />
            <span
              >Waiting for ${this.labels.receiverLabel} to make a
              decision...</span
            >
          </h1>
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
            myRole="sender"
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
    // Auto-advance when no feedback – handled in updated() to avoid
    // dispatching on every re-render.
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

  private renderSubmitButton() {
    // Determine if requirements are met before enabling the button
    const isTextRequirementMet =
      !this.stage.allowTextMessage || this.chatMessage.trim().length >= 5;
    const isButtonRequirementMet =
      !this.stage.allowButtonPress || this.selectedOption !== null;

    const isSubmitDisabled = this.isContinueMode
      ? false
      : !isButtonRequirementMet ||
        this.hasConfirmedChoice ||
        this.isDecidingLoading ||
        !isTextRequirementMet;

    const buttonText = this.isContinueMode
      ? 'Continue'
      : this.hasConfirmedChoice
        ? 'Waiting for timer...'
        : this.stage.allowTextMessage
          ? 'Send Message'
          : 'Confirm';

    return html`
      <div class="${this.hlClass(5)}">
        <div
          class="confirm-button-wrapper"
          style="margin-top: 24px; display: flex; flex-direction: column;"
        >
          <md-filled-button
            @click=${this.handleConfirm}
            ?disabled=${isSubmitDisabled}
            class="primary-action-btn"
          >
            ${buttonText}
          </md-filled-button>
          ${this.stage.senderSignalInstruction
            ? html`<p class="action-instruction">
                ${this.stage.senderSignalInstruction}
              </p>`
            : nothing}
        </div>
      </div>
    `;
  }
  private renderProbabilitySlider() {
    if (
      !this.stage.enableTruthfulnessFeature ||
      this.round.truthfulnessProbability == null
    ) {
      return nothing;
    }

    // Arrow reflects the fixed block-level probability (truthfulnessOptions value),
    // so it stays constant across all rounds within the same block.
    // 0% = always "Busy" end, 100% = always "Quiet" end.
    const arrowPct = Math.round(this.round.truthfulnessProbability * 100);
    const note =
      this.stage.probabilityDisplayPrefix ||
      'If no choice is made, the system will automatically send a message based on this probability.';

    return html`
      <div class="probability-slider">
        <div class="slider-labels">
          <span>100%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <div class="slider-above">
          <div class="slider-indicator" style="left: ${arrowPct}%">
            <div class="indicator-arrow"></div>
          </div>
        </div>
        <div class="slider-track"></div>
        <div class="slider-labels">
          <span>← Busy</span>
          <span>${note}</span>
          <span>Quiet →</span>
        </div>
      </div>
    `;
  }

  private renderCardColumn(option: 'A' | 'B') {
    const title =
      option === 'A' ? this.labels.optionALabel : this.labels.optionBLabel;
    const payoffData =
      option === 'A'
        ? getOptionAPayoff(this.stage)
        : getOptionBPayoff(this.stage, this.round.trueState);

    return html`
      <div class="sender-card-column">
        <sr-decision-card
          optionKey=${option}
          .title=${title}
          .payoffData=${payoffData}
          viewerRole="sender"
          .labels=${this.labels}
          .showTrueStateHighlight=${true}
          .state1Label=${option === 'B' ? '🔴 Busy' : ''}
          .state2Label=${option === 'B' ? '🔵 Quiet' : ''}
        ></sr-decision-card>
      </div>
    `;
  }

  private selectOption(option: 'A' | 'B') {
    if (this.hasConfirmedChoice) return;
    this.dispatchEvent(
      new CustomEvent('sr-select-option', {
        detail: {option},
        bubbles: true,
        composed: true,
      }),
    );
  }
  private renderTextInput() {
    if (!this.stage.allowTextMessage || this.isContinueMode) {
      return nothing;
    }

    return html`
      <div class="standalone-input-container">
        <pr-textarea
          size="small"
          placeholder="Draft your message"
          .value=${this.chatMessage}
          ?disabled=${this.hasConfirmedChoice}
          @input=${(e: Event) => {
            const value = (e.target as HTMLTextAreaElement).value;
            this.dispatchEvent(
              new CustomEvent('sr-typing', {
                detail: {value},
                bubbles: true,
                composed: true,
              }),
            );
          }}
          @focus=${() =>
            this.dispatchEvent(
              new CustomEvent('sr-textbox-focused', {
                bubbles: true,
                composed: true,
              }),
            )}
          @paste=${(e: ClipboardEvent) => e.preventDefault()}
          @copy=${(e: ClipboardEvent) => e.preventDefault()}
          @cut=${(e: ClipboardEvent) => e.preventDefault()}
        ></pr-textarea>
      </div>
    `;
  }
  /**
   * Renders the A/B option button if allowed by stage config.
   */
  private renderOptionButton(
    option: 'A' | 'B',
    btnLabel: string,
    isSelected: boolean,
  ) {
    if (!this.stage.allowButtonPress) {
      return nothing;
    }

    return isSelected
      ? html`
          <md-filled-button
            class="signal-btn"
            ?disabled=${this.hasConfirmedChoice}
            @click=${() => this.selectOption(option)}
          >
            <md-icon slot="icon">check_circle</md-icon>
            Send: ${btnLabel}
          </md-filled-button>
        `
      : html`
          <md-outlined-button
            class="signal-btn"
            ?disabled=${this.hasConfirmedChoice}
            @click=${() => this.selectOption(option)}
          >
            <md-icon slot="icon">radio_button_unchecked</md-icon>
            Send: ${btnLabel}
          </md-outlined-button>
        `;
  }
  // --- Event Handlers ---

  private handleTyping(e: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('sr-typing', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTextboxFocused() {
    this.dispatchEvent(
      new CustomEvent('sr-textbox-focused', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleConfirm() {
    this.dispatchEvent(
      new CustomEvent('sr-confirm-choice', {
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
