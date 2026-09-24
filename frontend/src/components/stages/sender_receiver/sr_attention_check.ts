import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';

import {styles} from './sr_attention_check.scss';

@customElement('sr-attention-check')
export class SrAttentionCheck extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({type: Boolean}) show = false;

  private shownAt = 0;

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('show') && this.show) {
      this.shownAt = Date.now();
    }
  }

  override render() {
    if (!this.show) return nothing;

    return html`
      <div class="custom-attention-overlay">
        <div class="attention-card">
          <md-icon>visibility</md-icon>
          <h3>Attention Check</h3>
          <p>
            The experiment is in progress. Please confirm that you are still
            active.
          </p>
          <md-filled-button @click=${this.handleConfirm}>
            I am here
          </md-filled-button>
        </div>
      </div>
    `;
  }

  private handleConfirm() {
    const reactionTimeMs = Date.now() - this.shownAt;
    this.dispatchEvent(
      new CustomEvent('sr-attention-confirmed', {
        detail: {reactionTimeMs},
        bubbles: true,
        composed: true,
      }),
    );
  }
}
