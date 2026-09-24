import '../progress/progress_stage_completed';

import './stage_description';
import './stage_footer';

import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

import {InfoStageConfig, playNotificationSound} from '@deliberation-lab/utils';

import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {convertMarkdownToHTML} from '../../shared/utils';
import {styles} from './info_view.scss';

/** Info stage view for participants. */
@customElement('info-view')
export class InfoView extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @state() private hasPlayedAudio = false;
  @state() hasPassedAudioCheck = false;
  @property() stage: InfoStageConfig | null = null;

  override render() {
    if (!this.stage) {
      return nothing;
    }

    const infoLinesJoined = this.stage?.infoLines.join('\n\n');

    // Check if the next step should be blocked:
    // True if audio check is enabled but hasn't been passed yet.
    const isNextDisabled =
      this.stage.enableAudioCheck && !this.hasPassedAudioCheck;

    return html`
      <stage-description .stage=${this.stage}></stage-description>
      <div class="html-wrapper">
        <div class="info-block">
          ${unsafeHTML(convertMarkdownToHTML(infoLinesJoined, false))}
        </div>
        ${this.renderAudioCheck()}
        ${this.stage.youtubeVideoId
          ? html`
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/${this.stage.youtubeVideoId}"
                title="YouTube video player"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              >
              </iframe>
            `
          : nothing}
      </div>

      <stage-footer .disabled=${isNextDisabled}>
        ${this.stage.progress.showParticipantProgress
          ? html`<progress-stage-completed></progress-stage-completed>`
          : nothing}
      </stage-footer>
    `;
  }

  private renderAudioCheck() {
    if (!this.stage || !this.stage.enableAudioCheck) {
      return nothing;
    }

    // Disable the confirm button if the audio hasn't been played yet,
    // or if the check has already been passed.
    const isConfirmDisabled = !this.hasPlayedAudio || this.hasPassedAudioCheck;

    return html`
      <div
        class="audio-check-wrapper"
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; margin: 24px 0; text-align: center;"
      >
        <h2>Click to Play Audio</h2>

        <div
          class="audio-check-controls"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;"
        >
          <md-icon-button
            @click=${this.playAudioCheck}
            style="transform: scale(2); margin: 24px 0;"
          >
            <md-icon>circle_notifications</md-icon>
          </md-icon-button>

          <md-filled-tonal-button
            @click=${this.confirmAudioCheck}
            ?disabled=${isConfirmDisabled}
          >
            ${this.hasPassedAudioCheck
              ? 'Sound Confirmed'
              : 'I can hear the sound'}
          </md-filled-tonal-button>
        </div>
      </div>
    `;
  }

  playAudioCheck() {
    // You can replace this with any short audio clip you'd like to use for testing
    const testAudioPath = '/sounds/notification.wav';
    playNotificationSound(testAudioPath);

    // Mark as played to enable the confirm button
    this.hasPlayedAudio = true;
  }

  confirmAudioCheck() {
    // Mark as passed to enable the Next button in stage-footer
    this.hasPassedAudioCheck = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'info-view': InfoView;
  }
}
