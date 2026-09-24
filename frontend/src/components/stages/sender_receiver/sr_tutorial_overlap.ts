import {MobxLitElement} from '@adobe/lit-mobx';
import {CSSResultGroup, html, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {
  SenderReceiverStageConfig,
  SenderReceiverRoundData,
} from '@deliberation-lab/utils';
import {styles} from './sr_tutorial_overlap.scss';

import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';

interface TutorialStep {
  title: string;
  content: string;
  side: 'left' | 'right';
  imageUrl?: string;
}

@customElement('sr-tutorial-overlay')
export class SrTutorialOverlay extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  @property() role: 'sender' | 'receiver' = 'sender';
  @property({attribute: false}) stage!: SenderReceiverStageConfig;
  @property() gameStatus: string = 'WAITING_BOTH_START';
  @property({type: Boolean}) isFinished = false;
  @property({type: Number}) trueState: 1 | 2 = 1;
  @property({attribute: false}) round: SenderReceiverRoundData | null = null;
  @state() private currentStepIndex = 0;
  @state() private showPostComplete = false;

  override willUpdate(changedProperties: PropertyValues) {
    if (changedProperties.has('gameStatus')) {
      this.currentStepIndex = 0;
      this.showPostComplete = false;
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has('gameStatus')) {
      this.dispatchStepEvent();
    }
  }

  // Define interactive tutorial content based on role and game status
  private get steps(): TutorialStep[] {
    // Sender tutorial steps for different game states
    if (this.role === 'sender') {
      switch (this.gameStatus) {
        case 'WAITING_BOTH_START':
          return [
            {
              title: 'Game Starting',
              content:
                'Welcome! You are the Advisor. The game will begin once both players are ready. Click "Start Game" when you are ready.',
              side: 'right',
            },
          ];

        case 'WAITING_SENDER_DECIDE':
          const stateLabel =
            this.trueState === 1
              ? this.stage.state1Label
              : this.stage.state2Label;
          const receiverPayoffB =
            this.trueState === 1
              ? this.stage.payoffReceiverChoiceB1
              : this.stage.payoffReceiverChoiceB2;
          const senderPayoffB =
            this.trueState === 1
              ? this.stage.payoffSenderChoiceB1
              : this.stage.payoffSenderChoiceB2;
          return [
            {
              title: 'Round Progress',
              content:
                'Look at the pulsing blue frame below. Here is where you can keep an eye on the round number during the game!',
              side: 'right',
            },
            {
              title: 'Your Secret Info',
              content: `The new part you see pulsing is where you'll have access to your secret! Only YOU know the true state of the ${this.stage.optionBLabel}: it is ${stateLabel} today.`,
              side: 'right',
            },
            {
              title: 'Score Rules',
              content: `If the ${this.stage.ReceiverLabel} chooses ${this.stage.optionALabel}, they earn ${this.stage.payoffReceiverChoiceA} and you earn ${this.stage.payoffSenderChoiceA}. Because today is ${stateLabel}, if they choose ${this.stage.optionBLabel}, they earn ${receiverPayoffB} and you earn ${senderPayoffB}.`,
              side: 'right',
            },
            {
              title: 'Auto-Recommend',
              content:
                'During the game, you will have a limited time to make your decision.  If you do not submit in time, the system will automatically send a message. This bar shows the probability of which message will be sent. For example, in this game there is a 50% probability of either message being sent if you do not answer on time. There are other cases in wich the message "Beta market is Quiet" will be sent 100% of the time if you do not answer on time. There are other cases in wich the message "Beta market is Busy" will be sent 100% of the time. You will be informed when this probability changes.',
              side: 'right',
            },
            {
              title: 'Choose Your Market',
              content:
                ' By clicking one of the two buttons, you can choose the market you want to recommend to the vendor.',
              side: 'right',
            },
            {
              title: 'Final Confirm',
              content:
                'Here is your final step! Click this button to confirm and send your signal to the vendor.',
              side: 'right',
            },
          ];

        case 'WAITING_RECEIVER_DECIDE':
          return [
            {
              title: 'Waiting Phase',
              content:
                'You have sent your message to the Vendor. Now wait for them to make their decision. Below is an example of what Vendors see during their turn of the game. You will automatically change to the next step after they make their decision.',
              side: 'right',
            },
            {
              title: 'Waiting for Vendor',
              content:
                'You are waiting for the Vendor to choose a market. This may take some time, because it is the tutorial phase. However in the real game, the Vendor will have a limited time to send you a message, so please be patient!',
              side: 'right',
            },
          ];

        case 'SHOW_FEEDBACK':
          return [
            {
              title: 'Results',
              content:
                'Here you can see the results of this round - what the Vendor chose and your payoffs.',
              side: 'right',
            },
            {
              title: 'Next Round',
              content:
                'When both players are ready, you can proceed to the next round.',
              side: 'right',
            },
          ];

        default:
          return [
            {
              title: 'Tutorial',
              content: 'Tutorial content for this game state.',
              side: 'right',
            },
          ];
      }
    }

    // Receiver tutorial steps for different game states
    switch (this.gameStatus) {
      case 'WAITING_BOTH_START':
        return [
          {
            title: 'Game Starting',
            content:
              'Welcome! You are the Vendor. The game will begin once both players are ready. Click "Start Game" when you are ready.',
            side: 'right',
          },
        ];

      case 'WAITING_SENDER_DECIDE':
        return [
          {
            title: 'Waiting Phase',
            content:
              'The Advisor is discovering their panel and preparing a message for you. Below is a representation of what they see. You will automatically change to the next step after they send their message.',
            side: 'right',
          },
          {
            title: 'Your Role',
            content:
              'As the Vendor, you will be able to chose between two markets. Your choice will determine the earnings of both players.',
            side: 'right',
          },
        ];

      case 'WAITING_RECEIVER_DECIDE':
        return [
          {
            title: 'The Message',
            content: 'Here is the message the Advisor chose to send you.',
            side: 'right',
          },
          {
            title: 'Score Table',
            content:
              "Here is the score table that shows the potential earnings for both of you based on your choice. If you choose Alpha Market, you earn 30 and the advisor earns 20. If you choose Beta Market and it's busy, you earn 36 and the advisor earns 0. If you choose Beta Market and it's quiet, you earn 4 and the advisor earns 20.",
            side: 'right',
          },
          {
            title: 'Your Move',
            content:
              'Here is where you make the final choice. Click the button to confirm your decision.',
            side: 'right',
          },
        ];

      case 'SHOW_FEEDBACK':
        return [
          {
            title: 'Results',
            content:
              'Here you can see the results of this round - what you chose and your payoffs.',
            side: 'right',
          },
          {
            title: 'Next Round',
            content:
              'When both players are ready, you can proceed to the next round. First, press the "Complete" button of the tutorial box. Then, click the "next round" button to proceed.',
            side: 'right',
          },
        ];

      default:
        return [
          {
            title: 'Tutorial',
            content: 'Tutorial content for this game state.',
            side: 'right',
          },
        ];
    }
  }

  private handleNext(e: Event) {
    e.stopPropagation();
    const isLastStep = this.currentStepIndex === this.steps.length - 1;
    if (!isLastStep) {
      this.currentStepIndex++;
      this.dispatchStepEvent();
    } else {
      this.dispatchEvent(
        new CustomEvent('tutorial-finished', {bubbles: true, composed: true}),
      );
      this.showPostComplete = true;
      // dispatch -1 to remove all highlights
      this.dispatchEvent(
        new CustomEvent('tutorial-step-changed', {
          detail: {step: -1},
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleSeeAgain(e: Event) {
    e.stopPropagation();
    this.showPostComplete = false;
    this.currentStepIndex = 0;
    this.dispatchStepEvent();
  }

  private handleBack(e: Event) {
    e.stopPropagation();
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.dispatchStepEvent();
    }
  }

  private dispatchStepEvent() {
    console.log('[Overlay] dispatchStepEvent', this.currentStepIndex);
    this.dispatchEvent(
      new CustomEvent('tutorial-step-changed', {
        detail: {step: this.currentStepIndex},
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const isDecisionPhase = this.gameStatus === 'WAITING_SENDER_DECIDE';

    if (this.showPostComplete && isDecisionPhase) {
      const isSender = this.role === 'sender';
      const message = isSender
        ? 'Your turn! Select your choice by clicking one of the two buttons on the game interface, and proceed by clicking the confirm button.'
        : 'You are waiting for the Advisor to send you a message. This may take some time, because it is the tutorial phase. However in the real game, the Advisor will have a limited time to send you a message, so please be patient!';

      return html`
        <div
          class="tutorial-sidebar"
          @click=${(e: Event) => e.stopPropagation()}
        >
          <div class="tutorial-card">
            <p>${message}</p>
            <div class="card-footer">
              <md-outlined-button @click=${this.handleSeeAgain}>
                See the instructions again
              </md-outlined-button>
            </div>
          </div>
        </div>
      `;
    }

    const step = this.steps[this.currentStepIndex];
    const isLastStep = this.currentStepIndex === this.steps.length - 1;
    const nextBtnText = isLastStep ? 'COMPLETE' : 'NEXT';
    return html`
      <div class="tutorial-sidebar" @click=${(e: Event) => e.stopPropagation()}>
        <div class="tutorial-card">
          <div class="badge">
            STEP ${this.currentStepIndex + 1} / ${this.steps.length}
          </div>
          <h4>${step.title}</h4>
          <p>${step.content}</p>
          ${step.imageUrl
            ? html`<img
                class="tutorial-image"
                src=${step.imageUrl}
                alt=${step.title}
              />`
            : ''}
          <div class="card-footer">
            <md-outlined-button
              ?disabled=${this.currentStepIndex === 0}
              @click=${this.handleBack}
              >BACK</md-outlined-button
            >
            <md-filled-button @click=${this.handleNext}>
              ${nextBtnText}
            </md-filled-button>
          </div>
        </div>
      </div>
    `;
  }
}
