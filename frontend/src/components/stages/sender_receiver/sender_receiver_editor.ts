import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/switch/switch.js';
import '@material/web/divider/divider.js';

import {core} from '../../../core/core';
import {ExperimentEditor} from '../../../services/experiment.editor';
import {SenderReceiverStageConfig} from '@deliberation-lab/utils';
import {styles} from './sender_receiver_editor.scss';

@customElement('sender-receiver-editor')
export class SenderReceiverEditor extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];
  private readonly experimentEditor = core.getService(ExperimentEditor);

  @property() stage: SenderReceiverStageConfig | undefined = undefined;

  override render() {
    if (this.stage === undefined) return nothing;

    return html`
      <div class="editor-container">
        <!-- 1. Game Setup -->
        <details open>
          <summary class="collapsible-title">Game Setup</summary>
          <div class="section-content">
            <div class="settings-row">
              ${this.renderNumberInput(
                'Total Rounds',
                'numRounds',
                'Total number of game rounds',
              )}
              ${this.renderNumberInput(
                'True State 1 Probability (0–1)',
                'state1Probability',
                'Probability of State 1 occurring (0–1)',
              )}
            </div>
            <div class="matrix-grid">
              <div class="state-card option-a-card">
                <span class="state-label"
                  >SAFE OPTION (A) - UNIVERSAL BASELINE</span
                >
                <div class="input-stack">
                  ${this.renderNumberInput(
                    'Sender Payoff',
                    'payoffSenderChoiceA',
                  )}
                  ${this.renderNumberInput(
                    'Receiver Payoff',
                    'payoffReceiverChoiceA',
                  )}
                </div>
              </div>
              <div class="option-b-column">
                <div class="state-card state-1">
                  <span class="state-label"
                    >RISKY OPTION (B) - IF ${this.stage.state1Label}</span
                  >
                  <div class="input-stack">
                    ${this.renderNumberInput(
                      'Sender Payoff',
                      'payoffSenderChoiceB1',
                    )}
                    ${this.renderNumberInput(
                      'Receiver Payoff',
                      'payoffReceiverChoiceB1',
                    )}
                  </div>
                </div>
                <div class="state-card state-2">
                  <span class="state-label"
                    >RISKY OPTION (B) - IF ${this.stage.state2Label}</span
                  >
                  <div class="input-stack">
                    ${this.renderNumberInput(
                      'Sender Payoff',
                      'payoffSenderChoiceB2',
                    )}
                    ${this.renderNumberInput(
                      'Receiver Payoff',
                      'payoffReceiverChoiceB2',
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- 2. Instructions -->
        <details open>
          <summary class="collapsible-title">Instructions</summary>
          <div class="section-content">
            <div class="input-stack">
              ${this.renderLargeTextArea(
                'Sender Instructions',
                'senderInstructionDetail',
                "Sender's role instructions. Supports Markdown. Add image: ![description](https://image-url)",
              )}
              ${this.renderLargeTextArea(
                'Receiver Instructions',
                'receiverInstructionDetail',
                "Receiver's role instructions. Supports Markdown. Add image: ![description](https://image-url)",
              )}
            </div>
          </div>
        </details>

        <!-- 3. Sender Panel -->
        <details open>
          <summary class="collapsible-title">Sender Panel</summary>
          <div class="section-content">
            <div class="settings-row">
              ${this.renderNumberInput(
                'Time Limit (s)',
                'senderTimeLimitInSeconds',
                'Sender decision time limit in seconds. 0 = no limit',
              )}
              ${this.renderSenderDefaultSelect()}
            </div>
            ${this.renderTextInput(
              'True State Prefix',
              'trueStatePrefix',
              'Prefix shown before the state reveal, e.g. "Current state for"',
            )}
            ${this.renderToggle(
              'Require Participant Click',
              'requireParticipantClick',
              'Sender must explicitly click Confirm to submit',
            )}
            ${this.renderToggle(
              'Allow Button Press',
              'allowButtonPress',
              'Sender can send recommendations via buttons',
            )}
            ${this.stage.allowButtonPress
              ? html`
                  <div class="sub-fields">
                    <div class="settings-row">
                      ${this.renderTextInput(
                        'Signal 1 Label',
                        'senderButtonLabel1',
                        'Label for the Recommend A button',
                      )}
                      ${this.renderTextInput(
                        'Signal 2 Label',
                        'senderButtonLabel2',
                        'Label for the Recommend B button',
                      )}
                    </div>
                  </div>
                `
              : nothing}
            ${this.renderToggle(
              'Allow Direct Text',
              'allowTextMessage',
              'Sender can send free-text messages',
            )}
            <div class="settings-row">
              ${this.renderTextInput(
                'Default Message for A',
                'defaultMessageForA',
                'Message auto-sent by system when sender times out with option A',
              )}
              ${this.renderTextInput(
                'Default Message for B',
                'defaultMessageForB',
                'Message auto-sent by system when sender times out with option B',
              )}
            </div>
            ${this.renderToggle(
              'Enable System Recommendation',
              'enableTruthfulnessFeature',
              'System generates internal recommendations with configurable honesty; auto-submits on timeout',
            )}
            ${this.stage.enableTruthfulnessFeature
              ? html`
                  <div class="sub-fields">
                    <div class="settings-row">
                      <md-outlined-text-field
                        label="Truthfulness Options (comma-separated)"
                        supporting-text="Honesty probability values per round, e.g. 0, 0.5, 1"
                        .value=${(this.stage.truthfulnessOptions ?? []).join(
                          ', ',
                        )}
                        @input=${(e: InputEvent) => {
                          const raw = (e.target as HTMLInputElement).value;
                          const parsed = raw
                            .split(',')
                            .map((s) => parseFloat(s.trim()))
                            .filter((n) => !isNaN(n));
                          if (parsed.length > 0) {
                            this.updateStage({truthfulnessOptions: parsed});
                          }
                        }}
                      ></md-outlined-text-field>
                      ${this.renderTextInput(
                        'Recommendation Note',
                        'recommendationTextPrefix',
                        'Note appended after the system recommendation (e.g. "(system recommended)")',
                      )}
                    </div>
                    ${this.renderTextInput(
                      'Probability Slider Note',
                      'probabilityDisplayPrefix',
                      'Note shown below the A/B probability slider (leave empty for default)',
                    )}
                  </div>
                `
              : nothing}
            ${this.renderTextInput(
              'Signal Instruction',
              'senderSignalInstruction',
              'One-line instruction shown above the Send Signal button (leave empty to hide)',
            )}
          </div>
        </details>

        <!-- 4. Receiver Panel -->
        <details open>
          <summary class="collapsible-title">Receiver Panel</summary>
          <div class="section-content">
            <div class="settings-row">
              ${this.renderNumberInput(
                'Time Limit (s)',
                'receiverTimeLimitInSeconds',
                'Receiver decision time limit in seconds. 0 = no limit',
              )}
            </div>
            <div class="settings-row">
              ${this.renderTextInput(
                'Action 1 Label',
                'receiverButtonLabel1',
                'Label for the Choose A button',
              )}
              ${this.renderTextInput(
                'Action 2 Label',
                'receiverButtonLabel2',
                'Label for the Choose B button',
              )}
            </div>
            ${this.renderTextInput(
              'Choice Instruction',
              'receiverChoiceInstruction',
              'Instruction shown above the choice buttons',
            )}
          </div>
        </details>

        <!-- 5. Feedback -->
        <details open>
          <summary class="collapsible-title">Feedback</summary>
          <div class="section-content">
            ${this.renderToggle(
              'Show Payoff Feedback',
              'showPayoffFeedback',
              'Show payoff results to both players after each round',
            )}
            <md-outlined-text-field
              label="Attention Check Rounds (comma-separated)"
              supporting-text="Rounds where attention check popup appears, e.g. 3, 6, 9. Leave empty for no checks."
              .value=${(this.stage.attentionCheckRounds ?? []).join(', ')}
              @input=${(e: InputEvent) => {
                const raw = (e.target as HTMLInputElement).value;
                if (raw.trim() === '') {
                  this.updateStage({attentionCheckRounds: []});
                  return;
                }
                const parsed = raw
                  .split(',')
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n) && n > 0);
                this.updateStage({attentionCheckRounds: parsed});
              }}
            ></md-outlined-text-field>
          </div>
        </details>

        <!-- 6. Labels & Names (collapsed by default) -->
        <details>
          <summary class="collapsible-title">Labels &amp; Names</summary>
          <div class="section-content">
            <div class="settings-row">
              ${this.renderTextInput(
                'Sender Name',
                'SenderLabel',
                'Sender role name shown in the participant UI',
              )}
              ${this.renderTextInput(
                'Receiver Name',
                'ReceiverLabel',
                'Receiver role name',
              )}
            </div>
            <div class="settings-row">
              ${this.renderTextInput(
                'Option A Label',
                'optionALabel',
                'Name for option A used in payoff matrix and buttons',
              )}
              ${this.renderTextInput(
                'Option B Label',
                'optionBLabel',
                'Name for option B',
              )}
            </div>
            <div class="settings-row">
              ${this.renderTextInput(
                'State 1 Name',
                'state1Label',
                'Name for State 1 shown in payoff matrix',
              )}
              ${this.renderTextInput(
                'State 2 Name',
                'state2Label',
                'Name for State 2',
              )}
            </div>
          </div>
        </details>
      </div>
    `;
  }

  private renderTextInput(
    label: string,
    field: keyof SenderReceiverStageConfig,
    helper?: string,
  ) {
    return html`
      <md-outlined-text-field
        label=${label}
        supporting-text=${helper ?? ''}
        .value=${this.stage?.[field]?.toString() ?? ''}
        @input=${(e: InputEvent) =>
          this.updateStage({[field]: (e.target as HTMLInputElement).value})}
      >
      </md-outlined-text-field>
    `;
  }

  private renderLargeTextArea(
    label: string,
    field: keyof SenderReceiverStageConfig,
    helper?: string,
  ) {
    return html`
      <div class="textarea-container">
        <label class="textarea-label">${label}</label>
        <textarea
          class="custom-textarea"
          .value=${this.stage?.[field]?.toString() ?? ''}
          @input=${(e: InputEvent) =>
            this.updateStage({
              [field]: (e.target as HTMLTextAreaElement).value,
            })}
          placeholder="Enter detailed instructions here..."
        ></textarea>
        ${helper ? html`<span class="helper">${helper}</span>` : nothing}
      </div>
    `;
  }

  private renderNumberInput(
    label: string,
    field: keyof SenderReceiverStageConfig,
    helper?: string,
  ) {
    return html`
      <md-outlined-text-field
        label=${label}
        type="number"
        supporting-text=${helper ?? ''}
        .value=${this.stage?.[field]?.toString() ?? '0'}
        @input=${(e: InputEvent) =>
          this.updateStage({
            [field]: Number((e.target as HTMLInputElement).value),
          })}
      >
      </md-outlined-text-field>
    `;
  }

  private renderToggle(
    label: string,
    field: keyof SenderReceiverStageConfig,
    helper: string,
  ) {
    return html`
      <div class="switch-row">
        <div class="label-content">
          <span class="label-text">${label}</span>
          <span class="helper">${helper}</span>
        </div>
        <md-switch
          .selected=${!!this.stage?.[field]}
          @change=${(e: Event) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.updateStage({[field]: (e.target as any).selected})}
        >
        </md-switch>
      </div>
    `;
  }

  private renderSenderDefaultSelect() {
    return html`
      <md-outlined-select
        label="Default Sender Choice"
        supporting-text="Auto-submitted choice when timer runs out"
        .value=${this.stage?.defaultSenderChoice ?? 'random'}
        @change=${(e: Event) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.updateStage({defaultSenderChoice: (e.target as any).value})}
      >
        <md-select-option value="recommend_A">Recommend A</md-select-option>
        <md-select-option value="recommend_B">Recommend B</md-select-option>
        <md-select-option value="random">Random</md-select-option>
      </md-outlined-select>
    `;
  }

  private updateStage(updates: Partial<SenderReceiverStageConfig>) {
    if (!this.stage) return;
    this.experimentEditor.updateStage({...this.stage, ...updates});
  }
}
