/**
 * Payoff display components for Sender-Receiver stage.
 * Contains: <sr-payoff-table>, <sr-decision-card>, <sr-payoff-info-card>
 */
import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {styles} from './sr_payoff_display.scss';
import {PayoffData, Role, LabelConfig} from './sr_types';

// --- Payoff Table ---

@customElement('sr-payoff-table')
export class SrPayoffTable extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property({attribute: false}) payoffData!: PayoffData;
  @property() highlightMode: boolean | 'all' = true;
  @property() viewerRole: Role = 'sender';
  @property({attribute: false}) labels!: LabelConfig;
  @property() state1Label = '';
  @property() state2Label = '';

  override render() {
    const firstLabel =
      this.viewerRole === 'sender'
        ? 'You earn'
        : `${this.labels.senderLabel} earns`;
    const secondLabel =
      this.viewerRole === 'sender'
        ? `${this.labels.receiverLabel} earns`
        : 'You earn';

    if (this.payoffData.type === 'fixed') {
      const shouldHighlight =
        this.highlightMode === 'all' || this.highlightMode === true;
      return html`
        <div class="payoff-details-container">
          <div class="payoff-row ${shouldHighlight ? 'highlight-row' : ''}">
            <div class="role-payoff">
              <span>${firstLabel}:</span> <b>${this.payoffData.sender}</b>
            </div>
            <div class="role-payoff">
              <span>${secondLabel}:</span> <b>${this.payoffData.receiver}</b>
            </div>
          </div>
        </div>
      `;
    }

    // Conditional payoff
    const getStateClass = (state: 1 | 2) => {
      if (this.highlightMode === 'all') return 'highlight-row';
      if (this.highlightMode === false) return '';
      return this.payoffData.type === 'conditional' &&
        this.payoffData.trueState === state
        ? 'highlight-row'
        : 'dimmed-row';
    };

    return html`
      <div class="payoff-details-container">
        <div class="payoff-row ${getStateClass(1)}">
          ${this.state1Label
            ? html`<div class="state-label">${this.state1Label}</div>`
            : ''}
          <div class="role-payoff">
            <span>${firstLabel}:</span>
            <b>${this.payoffData.state1Sender}</b>
          </div>
          <div class="role-payoff">
            <span>${secondLabel}:</span>
            <b>${this.payoffData.state1Receiver}</b>
          </div>
        </div>
        <div class="payoff-row ${getStateClass(2)}">
          ${this.state2Label
            ? html`<div class="state-label">${this.state2Label}</div>`
            : ''}
          <div class="role-payoff">
            <span>${firstLabel}:</span>
            <b>${this.payoffData.state2Sender}</b>
          </div>
          <div class="role-payoff">
            <span>${secondLabel}:</span>
            <b>${this.payoffData.state2Receiver}</b>
          </div>
        </div>
      </div>
    `;
  }
}

// --- Decision Card (pure display) ---

@customElement('sr-decision-card')
export class SrDecisionCard extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property() optionKey: 'A' | 'B' = 'A';
  @property() title = '';
  @property({attribute: false}) payoffData!: PayoffData;
  @property() viewerRole: Role = 'sender';
  @property({attribute: false}) labels!: LabelConfig;
  @property({type: Boolean}) showTrueStateHighlight = true;
  @property() state1Label = '';
  @property() state2Label = '';

  override render() {
    const highlightMode = this.showTrueStateHighlight ? true : 'all';

    return html`
      <div class="decision-card">
        <div class="card-header">
          <h4>${this.title}</h4>
          <sr-payoff-table
            .payoffData=${this.payoffData}
            .highlightMode=${highlightMode}
            .viewerRole=${this.viewerRole}
            .labels=${this.labels}
            .state1Label=${this.state1Label}
            .state2Label=${this.state2Label}
          ></sr-payoff-table>
        </div>
      </div>
    `;
  }
}

// --- Payoff Info Card (Receiver view) ---

@customElement('sr-payoff-info-card')
export class SrPayoffInfoCard extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property() title = '';
  @property({attribute: false}) payoffData!: PayoffData;
  @property() showHighlight: boolean | 'all' = false;
  @property() viewerRole: Role = 'receiver';
  @property({attribute: false}) labels!: LabelConfig;
  @property() state1Label = '';
  @property() state2Label = '';

  override render() {
    return html`
      <div class="info-card">
        <h4>${this.title}</h4>
        <div class="payoff-info-content">
          <sr-payoff-table
            .payoffData=${this.payoffData}
            .highlightMode=${this.showHighlight}
            .viewerRole=${this.viewerRole}
            .labels=${this.labels}
            .state1Label=${this.state1Label}
            .state2Label=${this.state2Label}
          ></sr-payoff-table>
        </div>
      </div>
    `;
  }
}
