import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/web/icon/icon.js';
import {SenderReceiverRoundData} from '@deliberation-lab/utils';
import {styles} from './sr_chat_window.scss';

@customElement('sr-chat-window')
export class SrChatWindow extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) round!: SenderReceiverRoundData;
  @property({type: Boolean}) isSender = false;
  @property() senderLabel = 'Sender';
  @property({type: Boolean}) allowTextMessage = false;
  @property() senderButtonLabel1 = 'Beta Market is Busy';
  @property() senderButtonLabel2 = 'Beta Market is Quiet';

  private renderContentText() {
    if (this.round.senderMessage) return this.round.senderMessage;

    const isNoActionTaken = this.round.senderChoice === null;
    if (isNoActionTaken || this.allowTextMessage) {
      return html`<i style="opacity:0.5;"
        >${this.senderLabel} did not send a message</i
      >`;
    }

    if (this.round.senderChoice === 'A') return this.senderButtonLabel1;
    if (this.round.senderChoice === 'B') return this.senderButtonLabel2;

    return '';
  }

  private renderChatBody(isSenderTurnOver: boolean) {
    if (!isSenderTurnOver) {
      return html`
        <div class="chat-empty-state">
          <md-icon
            >${this.isSender ? 'clock_loader_40' : 'clock_loader_40'}</md-icon
          >
          <span>Waiting for ${this.senderLabel} to send a message...</span>
        </div>
      `;
    }
    return html`
      <div class="chat-content">
        <div class="content-text">${this.renderContentText()}</div>
      </div>
    `;
  }

  override render() {
    const isSenderTurnOver =
      this.round.status !== 'WAITING_SENDER_DECIDE' &&
      this.round.status !== 'WAITING_BOTH_START';

    return html`
      <div class="chat-info-area">
        <div class="chat-window-header">
          <md-icon>owl</md-icon>
          <span class="chat-title">Advisor sent:</span>
        </div>
        <div class="chat-window-body">
          ${this.renderChatBody(isSenderTurnOver)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sr-chat-window': SrChatWindow;
  }
}
