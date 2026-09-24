/**
 * Waiting screen components for Sender-Receiver stage.
 * Contains: <sr-role-assignment>, <sr-instruction-screen>,
 *           <sr-waiting-both-start>, <sr-stage-finished>
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing, PropertyValues} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';

import {
  SenderReceiverRoundData,
  playNotificationSound,
} from '@deliberation-lab/utils';
import {convertMarkdownToHTML} from '../../../shared/utils';
import {styles} from './sr_waiting_screens.scss';

// --- Role Assignment ---

@customElement('sr-role-assignment')
export class SrRoleAssignment extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({type: Boolean}) isLoading = false;
  @property() roleLabel: string | null = null;

  override render() {
    if (this.isLoading) {
      return html`
        <div class="waiting-screen">
          <p>Joining game...</p>
          <md-icon class="loading-icon">sync</md-icon>
        </div>
      `;
    }

    const title = this.roleLabel ? 'Welcome Back' : '';
    const description = this.roleLabel
      ? html`You are still the <strong>${this.roleLabel}</strong>.`
      : html`Please join to be assigned a role.`;
    const btnLabel = this.roleLabel ? 'Continue' : 'Join Game';

    return html`
      <div class="waiting-screen">
        ${title ? html`<h3>${title}</h3>` : nothing}
        <p>${description}</p>
        <md-filled-button ?disabled=${this.isLoading} @click=${this.handleJoin}>
          ${btnLabel}
        </md-filled-button>
      </div>
    `;
  }

  private handleJoin() {
    this.dispatchEvent(
      new CustomEvent('sr-join-game', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// --- Instruction Screen ---

@customElement('sr-instruction-screen')
export class SrInstructionScreen extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({type: Boolean}) isSender = false;
  @property() roleLabel = '';
  @property() instructionContent = '';

  override render() {
    const title = `Instructions for ${this.roleLabel}`;

    return html`
      <div class="reading-panel">
        <h3>${title}</h3>
        <div class="instruction-box">
          ${unsafeHTML(convertMarkdownToHTML(this.instructionContent || ''))}
        </div>
        <div class="action-footer">
          <md-filled-button @click=${this.handleRead}>
            Continue
          </md-filled-button>
        </div>
      </div>
    `;
  }

  private handleRead() {
    this.dispatchEvent(
      new CustomEvent('sr-instructions-read', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// --- Waiting Both Start ---

@customElement('sr-waiting-both-start')
export class SrWaitingBothStart extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) round!: SenderReceiverRoundData;
  @property({type: Boolean}) isSender = false;
  @property() roleLabel = '';
  @property({type: Boolean}) isLoading = false;
  @property({type: Boolean}) canStart = true;
  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has('canStart') && this.canStart) {
      const audio = new Audio('/sounds/notification.wav');
      audio.play().catch((e) => console.warn('Audio blocked by browser', e));
    }
  }
  override render() {
    const amIReady = this.isSender
      ? this.round.senderReadyStart
      : this.round.receiverReadyStart;
    const partnerReady = this.isSender
      ? this.round.receiverReadyStart
      : this.round.senderReadyStart;

    return html`
      <div class="waiting-screen start-game-screen">
        <h1>Waiting for Partner⏳</h1>
        <p>
          The game will start once you and another player are ready in the room.
        </p>
        <p>
          A notification will play when your partner joins. Please stay in this
          web page, otherwise the notification sound cannot play.
        </p>
        <p>Click "Start" when both players are here.</p>
        <div class="ready-status">
          <div class="status-item ${amIReady ? 'ready' : ''}">
            <md-icon>
              ${amIReady ? 'check_circle' : 'radio_button_unchecked'}
            </md-icon>
            <span>You: ${amIReady ? 'Ready' : 'Not Ready'}</span>
          </div>
          <div class="status-item ${partnerReady ? 'ready' : ''}">
            <md-icon>
              ${partnerReady ? 'check_circle' : 'radio_button_unchecked'}
            </md-icon>
            <span>Partner: ${partnerReady ? 'Ready' : 'Not Ready'}</span>
          </div>
        </div>
        ${amIReady
          ? html`
              <div class="waiting-for-partner">
                <md-icon class="waiting-icon">hourglass_empty</md-icon>
                <p>Waiting for your partner to start...</p>
              </div>
            `
          : html`
              ${!this.canStart
                ? html`
                    <p class="audio-hint">
                      <md-icon>emoji_people</md-icon>
                      We've found a partner for you! Just waiting a moment for
                      their screen to load...
                    </p>
                  `
                : nothing}
              <md-filled-button
                @click=${this.handleStart}
                ?disabled=${this.isLoading || !this.canStart}
              >
                ${this.isLoading ? 'Starting...' : 'Start Game'}
              </md-filled-button>
            `}
      </div>
    `;
  }

  private handleStart() {
    this.dispatchEvent(
      new CustomEvent('sr-start-game', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// --- Stage Finished ---

@customElement('sr-stage-finished')
export class SrStageFinished extends MobxLitElement {
  @property({type: Boolean}) isLoading = false;

  override render() {
    return html`
      <div class="waiting-screen">
        <h3>Block Finished</h3>
        <p>This block is over. Please proceed to the next step.</p>
        <div class="stage-finished-footer">
          <md-filled-button
            ?disabled=${this.isLoading}
            @click=${this.handleNext}
          >
            ${this.isLoading ? 'Finished' : 'Next Step'}
          </md-filled-button>
        </div>
      </div>
    `;
  }

  private handleNext() {
    this.dispatchEvent(
      new CustomEvent('sr-next-step', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}
