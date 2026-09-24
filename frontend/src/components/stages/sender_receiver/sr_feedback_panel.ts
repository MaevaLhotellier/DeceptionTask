/**
 * Feedback panel component for Sender-Receiver stage.
 * Displays round results and payoffs.
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/web/button/filled-button.js';

import {SenderReceiverRoundData} from '@deliberation-lab/utils';
import {styles} from './sr_feedback_panel.scss';
import {Role, LabelConfig, RoundInfo} from './sr_types';

@customElement('sr-feedback-panel')
export class SrFeedbackPanel extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) round!: SenderReceiverRoundData;
  @property() myRole: Role = 'sender';
  @property({attribute: false}) labels!: LabelConfig;
  @property({attribute: false}) roundInfo!: RoundInfo;
  @property({type: Number}) cumulativePayoff = 0;
  @property({type: Boolean}) amIReady = false;
  @property({type: Number}) tutorialStep?: number;
  override render() {
    const isSender = this.myRole === 'sender';
    const partnerLabel = isSender
      ? this.labels.receiverLabel
      : this.labels.senderLabel;
    const myPayoff = isSender
      ? this.round.senderPayoff
      : this.round.receiverPayoff;
    const partnerPayoff = isSender
      ? this.round.receiverPayoff
      : this.round.senderPayoff;
    let actionDescription = '';
    if (isSender) {
      if (this.round.receiverChoice === 'A') {
        actionDescription = `The ${partnerLabel} chose ${this.labels.optionALabel}.`;
      } else if (this.round.receiverChoice === 'B') {
        actionDescription = `The ${partnerLabel} chose ${this.labels.optionBLabel}.`;
      } else {
        actionDescription = `The ${partnerLabel} made no choice.`;
      }
    } else {
      if (this.round.receiverChoice === 'A') {
        actionDescription = `You chose ${this.labels.optionALabel}.`;
      } else if (this.round.receiverChoice === 'B') {
        actionDescription = `You chose ${this.labels.optionBLabel}.`;
      } else {
        actionDescription = `You made no choice.`;
      }
    }
    const isResultsStep = this.tutorialStep === 0;
    const isNextRoundStep = this.tutorialStep === 1;
    return html`
      <div class="feedback-panel">
        <div
          class="results-section ${isResultsStep
            ? 'tutorial-highlight active'
            : 'tutorial-highlight'}"
        >
          <h3>
            Day ${this.roundInfo.currentRound}/${this.roundInfo.totalRounds}
            Results
          </h3>
          <p>${actionDescription}</p>
          <div class="score-card">
            <div class="label">
              ${isSender ? 'You' : this.labels.senderLabel} sent
            </div>
            <div class="score">
              <b
                >${this.round.senderChoice === 'A'
                  ? this.labels.senderButtonLabel1
                  : this.round.senderChoice === 'B'
                    ? this.labels.senderButtonLabel2
                    : '—'}</b
              >
            </div>
          </div>
          <div class="score-card">
            <div class="label">You earn</div>
            <div class="score"><b>${myPayoff}</b></div>
          </div>
          <div class="score-card">
            <div class="label">${partnerLabel} earns</div>
            <div class="score"><b>${partnerPayoff}</b></div>
          </div>

          <div class="cumulative-payoff">
            <span>Your Total Payoff: <b>${this.cumulativePayoff}</b></span>
          </div>
        </div>
        <div
          class="next-round-section ${isNextRoundStep
            ? 'tutorial-highlight active'
            : 'tutorial-highlight'}"
        >
          ${this.amIReady
            ? html`<div class="waiting-next-text">
                Waiting for ${partnerLabel} to continue...
              </div>`
            : html`<div class="next-round-wrapper">
                <md-filled-button @click=${this.handleNextRound}>
                  Next Round
                </md-filled-button>
              </div>`}
        </div>
      </div>
    `;
  }

  private handleNextRound() {
    this.dispatchEvent(
      new CustomEvent('sr-next-round', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}
