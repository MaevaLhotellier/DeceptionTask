import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {core} from '../../core/core';
import {AnalyticsService, ButtonClick} from '../../services/analytics.service';
import {ExperimentService} from '../../services/experiment.service';
import {ParticipantService} from '../../services/participant.service';
import {Pages, RouterService} from '../../services/router.service';
import {PROLIFIC_COMPLETION_URL_PREFIX} from '../../shared/constants';

import {
  ParticipantStatus,
  StageKind,
  playNotificationSound,
} from '@deliberation-lab/utils';

import {styles} from './popup.scss';

@customElement('transfer-popup')
class TransferPopup extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly analyticsService = core.getService(AnalyticsService);
  private readonly experimentService = core.getService(ExperimentService);
  private readonly participantService = core.getService(ParticipantService);
  private readonly routerService = core.getService(RouterService);

  @state() isAccepting = false;
  override firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties); // 保持调用父类方法的良好习惯

    const testAudioPath = '/sounds/notification.wav';
    playNotificationSound(testAudioPath);
  }
  private get isStageTransfer() {
    return !!this.participantService.profile?.stageTransferTargetId;
  }

  render() {
    return this.isStageTransfer
      ? this.renderStageTransfer()
      : this.renderCohortTransfer();
  }

  private renderCohortTransfer() {
    return html`
      <div class="overlay">
        <div class="popup">
          <div class="title">You have been transferred to a new group!</div>
          <div class="button-row">
            <div class="button-container">
              <pr-button
                color="primary"
                variant="tonal"
                ?loading=${this.isAccepting}
                @click=${this.handleYes}
              >
                Continue
              </pr-button>
              <p class="subtitle">
                This will redirect you to the next part of the experiment.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderStageTransfer() {
    return html`
      <div class="overlay">
        <div class="popup">
          <div class="title">
            Your partner has disconnected. We have moved you forward to the next
            stage.
          </div>
          <div class="button-row">
            <div class="button-container">
              <pr-button
                color="primary"
                variant="tonal"
                ?loading=${this.isAccepting}
                @click=${this.handleStageTransfer}
              >
                Continue
              </pr-button>
              <p class="subtitle">
                Your reward will still be processed as usual, based on your
                actual time spent.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async handleYes() {
    this.isAccepting = true;
    this.analyticsService.trackButtonClick(ButtonClick.TRANSFER_ACCEPT);
    await this.participantService.acceptParticipantTransfer();
    this.isAccepting = false;
  }

  private async handleNo() {
    if (!this.participantService.profile) return;

    this.analyticsService.trackButtonClick(ButtonClick.TRANSFER_REJECT);
    await this.participantService.updateExperimentFailure(
      ParticipantStatus.TRANSFER_DECLINED,
      true,
    );
  }

  private async handleStageTransfer() {
    this.isAccepting = true;
    await this.participantService.acceptParticipantStageTransfer();
    this.isAccepting = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transfer-popup': TransferPopup;
  }
}
